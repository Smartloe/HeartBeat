import hashlib
import os
import secrets
import sqlite3
import time
from collections import defaultdict
from datetime import datetime, timedelta

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, RedirectResponse, Response
from pydantic import BaseModel

BASE_URL = os.getenv("TUNEHUB_BASE_URL", "https://music-dl.sayqz.com")
DB_PATH = os.getenv(
    "TUNEHUB_DB_PATH", os.path.join(os.path.dirname(__file__), "tunehub.sqlite")
)

# 反爬配置
RATE_LIMIT_REQUESTS = 60  # 每分钟请求数
RATE_LIMIT_WINDOW = 60  # 时间窗口（秒）
MAX_LOGIN_ATTEMPTS = 5  # 最大登录尝试次数
LOCKOUT_TIME = 300  # 锁定时间（秒）

# 频率限制存储
rate_limit_store: dict[str, list[float]] = defaultdict(list)
login_attempts: dict[str, dict] = {}  # {ip: {attempts: int, locked_until: float}}

# 可疑User-Agent黑名单
SUSPICIOUS_UA_PATTERNS = [
    "bot",
    "crawler",
    "spider",
    "scraper",
    "python",
    "curl",
    "wget",
    "http",
    "java",
    "go-http",
    "headless",
    "phantom",
    "selenium",
    "puppeteer",
    "postman",
]

app = FastAPI(title="TuneHub API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def anti_spider_middleware(request: Request, call_next):
    """反爬虫中间件"""
    start_time = time.time()
    ip = request.client.host if request.client else "unknown"
    path = request.url.path
    method = request.method
    user_agent = request.headers.get("user-agent", "unknown")
    
    # 记录请求
    blocked = False
    block_reason = ""
    
    # 检查IP黑名单
    with get_conn() as conn:
        blacklisted = conn.execute(
            "SELECT expires_at FROM ip_blacklist WHERE ip = ?",
            (ip,)
        ).fetchone()
        
        if blacklisted:
            expires_at = blacklisted["expires_at"]
            if expires_at and datetime.fromisoformat(expires_at) > datetime.utcnow():
                blocked = True
                block_reason = "IP已被封禁"
            else:
                # 过期了，删除记录
                conn.execute("DELETE FROM ip_blacklist WHERE ip = ?", (ip,))
                conn.commit()
    
    # 检查User-Agent
    if not blocked:
        ua_valid, ua_reason = check_user_agent(user_agent)
        if not ua_valid:
            blocked = True
            block_reason = ua_reason
    
    # 检查频率限制
    if not blocked and path.startswith("/api/"):
        rate_limit_ok, rate_limit_reason = check_rate_limit(ip)
        if not rate_limit_ok:
            blocked = True
            block_reason = rate_limit_reason
    
    # 检查登录锁定
    if not blocked and path.startswith("/auth/login"):
        lockout_ok, lockout_reason = check_ip_lockout(ip)
        if not lockout_ok:
            blocked = True
            block_reason = lockout_reason
    
    # 如果被阻止，返回错误
    if blocked:
        # 记录到访问日志
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO access_logs (ip, path, method, user_agent, status_code, created_at, blocked)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (ip, path, method, user_agent[:500], 403, datetime.utcnow().isoformat(), 1)
            )
            conn.commit()
        
        return JSONResponse(
            {"code": 403, "message": block_reason or "访问被拒绝"},
            status_code=403
        )
    
    # 处理请求
    response = await call_next(request)
    
    # 记录访问日志（异步处理）
    process_time = time.time() - start_time
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO access_logs (ip, path, method, user_agent, status_code, created_at, blocked)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (ip, path, method, user_agent[:500], response.status_code, datetime.utcnow().isoformat(), 0)
        )
        conn.commit()
    
    return response


class AuthPayload(BaseModel):
    username: str
    password: str


class FavoritePayload(BaseModel):
    id: str
    source: str
    name: str
    artist: str


class ProfilePayload(BaseModel):
    nickname: str | None = None
    signature: str | None = None
    avatar_url: str | None = None


class PasswordPayload(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountPayload(BaseModel):
    password: str


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS favorites (
                username TEXT NOT NULL,
                track_id TEXT NOT NULL,
                source TEXT NOT NULL,
                name TEXT NOT NULL,
                artist TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (username, track_id, source),
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                username TEXT PRIMARY KEY,
                nickname TEXT,
                signature TEXT,
                avatar_url TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS login_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                device TEXT NOT NULL,
                ip TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username)
            )
            """
        )
        conn.commit()


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()


def check_rate_limit(ip: str) -> tuple[bool, str]:
    """检查请求频率限制"""
    now = time.time()
    
    # 清理过期记录
    rate_limit_store[ip] = [
        t for t in rate_limit_store[ip] 
        if now - t < RATE_LIMIT_WINDOW
    ]
    
    # 检查是否超过限制
    if len(rate_limit_store[ip]) >= RATE_LIMIT_REQUESTS:
        return False, "请求过于频繁，请稍后再试"
    
    # 记录本次请求
    rate_limit_store[ip].append(now)
    return True, ""


def check_ip_lockout(ip: str) -> tuple[bool, str]:
    """检查IP是否被锁定"""
    if ip in login_attempts:
        attempt_data = login_attempts[ip]
        if attempt_data["locked_until"] and time.time() < attempt_data["locked_until"]:
            remaining = int(attempt_data["locked_until"] - time.time())
            return False, f"登录失败次数过多，请{remaining}秒后再试"
    return True, ""


def record_failed_login(ip: str):
    """记录登录失败"""
    if ip not in login_attempts:
        login_attempts[ip] = {"attempts": 0, "locked_until": None}
    
    login_attempts[ip]["attempts"] += 1
    
    if login_attempts[ip]["attempts"] >= MAX_LOGIN_ATTEMPTS:
        login_attempts[ip]["locked_until"] = time.time() + LOCKOUT_TIME


def reset_login_attempts(ip: str):
    """重置登录尝试"""
    if ip in login_attempts:
        login_attempts[ip]["attempts"] = 0
        login_attempts[ip]["locked_until"] = None


def check_user_agent(user_agent: str) -> tuple[bool, str]:
    """检查User-Agent"""
    if not user_agent:
        return False, "缺少User-Agent"
    
    ua_lower = user_agent.lower()
    for pattern in SUSPICIOUS_UA_PATTERNS:
        if pattern in ua_lower:
            return False, "检测到异常User-Agent"
    
    return True, ""


@app.on_event("startup")
def startup() -> None:
    init_db()
    init_rate_limit_table()


def init_rate_limit_table() -> None:
    """初始化频率限制相关的数据库表"""
    with get_conn() as conn:
        # 创建IP黑名单表
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ip_blacklist (
                ip TEXT PRIMARY KEY,
                reason TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT
            )
            """
        )
        # 创建访问日志表
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT NOT NULL,
                path TEXT NOT NULL,
                method TEXT NOT NULL,
                user_agent TEXT,
                status_code INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                blocked BOOLEAN DEFAULT 0
            )
            """
        )
        conn.commit()


def get_username_from_token(request: Request) -> str | None:
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        return None
    with get_conn() as conn:
        row = conn.execute(
            "SELECT username FROM sessions WHERE token = ?",
            (token,),
        ).fetchone()
    return row["username"] if row else None


async def forward_request(
    path: str, params: list[tuple[str, str]] | None = None, follow_redirects: bool = True
) -> httpx.Response:
    url = f"{BASE_URL}{path}"
    async with httpx.AsyncClient(follow_redirects=follow_redirects, timeout=20) as client:
        return await client.get(url, params=params)


def build_response(upstream: httpx.Response) -> Response:
    content_type = upstream.headers.get("content-type", "application/json")
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=content_type,
    )


@app.get("/api/")
async def api_proxy(request: Request):
    params = list(request.query_params.multi_items())
    request_type = request.query_params.get("type", "")

    if request_type in {"url", "pic"}:
        upstream = await forward_request("/api/", params=params, follow_redirects=False)
        location = upstream.headers.get("location")
        if location:
            headers = {}
            if "x-source-switch" in upstream.headers:
                headers["x-source-switch"] = upstream.headers["x-source-switch"]
            return RedirectResponse(url=location, status_code=302, headers=headers)
        return build_response(upstream)

    if request_type == "lrc":
        upstream = await forward_request("/api/", params=params, follow_redirects=True)
        return PlainTextResponse(content=upstream.text, status_code=upstream.status_code)

    upstream = await forward_request("/api/", params=params, follow_redirects=True)
    return build_response(upstream)


@app.post("/auth/register")
async def register(payload: AuthPayload):
    username = payload.username.strip()
    if not username or not payload.password:
        return JSONResponse(
            {"code": 400, "message": "用户名或密码不能为空"}, status_code=400
        )
    salt = secrets.token_hex(8)
    password_hash = hash_password(payload.password, salt)
    created_at = datetime.utcnow().isoformat()
    try:
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
                (username, password_hash, salt, created_at),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        return JSONResponse({"code": 409, "message": "账号已存在"}, status_code=409)
    return JSONResponse(
        {"code": 200, "message": "注册成功", "data": {"username": username}}
    )


@app.post("/auth/login")
async def login(request: Request, payload: AuthPayload):
    username = payload.username.strip()
    device = request.headers.get("user-agent", "unknown")
    ip = request.client.host if request.client else "unknown"
    
    # 检查IP锁定状态
    lockout_ok, lockout_reason = check_ip_lockout(ip)
    if not lockout_ok:
        return JSONResponse({"code": 429, "message": lockout_reason}, status_code=429)
    
    with get_conn() as conn:
        row = conn.execute(
            "SELECT password_hash, salt FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    
    if not row:
        record_failed_login(ip)
        remaining = MAX_LOGIN_ATTEMPTS - login_attempts[ip]["attempts"]
        return JSONResponse(
            {"code": 401, "message": f"账号或密码错误，剩余尝试次数：{remaining}"}, 
            status_code=401
        )
    
    expected = hash_password(payload.password, row["salt"])
    if expected != row["password_hash"]:
        record_failed_login(ip)
        remaining = MAX_LOGIN_ATTEMPTS - login_attempts[ip]["attempts"]
        return JSONResponse(
            {"code": 401, "message": f"账号或密码错误，剩余尝试次数：{remaining}"}, 
            status_code=401
        )
    
    # 登录成功，重置尝试次数
    reset_login_attempts(ip)
    
    token = secrets.token_urlsafe(24)
    created_at = datetime.utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (token, username, created_at) VALUES (?, ?, ?)",
            (token, username, created_at),
        )
        conn.execute(
            "INSERT INTO login_logs (username, device, ip, created_at) VALUES (?, ?, ?, ?)",
            (username, device, ip, created_at),
        )
        conn.commit()
    return JSONResponse(
        {"code": 200, "message": "登录成功", "data": {"token": token, "username": username}}
    )


@app.get("/auth/me")
async def me(request: Request):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    return JSONResponse({"code": 200, "data": {"username": username}})


@app.post("/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        return JSONResponse({"code": 200, "message": "已退出"})
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
    return JSONResponse({"code": 200, "message": "已退出"})


@app.post("/auth/delete")
async def delete_account(request: Request, payload: DeleteAccountPayload):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT password_hash, salt FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not row:
            return JSONResponse({"code": 404, "message": "账号不存在"}, status_code=404)
        expected = hash_password(payload.password, row["salt"])
        if expected != row["password_hash"]:
            return JSONResponse({"code": 400, "message": "密码错误"}, status_code=400)
        conn.execute("DELETE FROM sessions WHERE username = ?", (username,))
        conn.execute("DELETE FROM favorites WHERE username = ?", (username,))
        conn.execute("DELETE FROM profiles WHERE username = ?", (username,))
        conn.execute("DELETE FROM login_logs WHERE username = ?", (username,))
        conn.execute("DELETE FROM users WHERE username = ?", (username,))
        conn.commit()
    return JSONResponse({"code": 200, "message": "账号已注销"})


@app.get("/profile")
async def get_profile(request: Request):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT nickname, signature, avatar_url FROM profiles WHERE username = ?",
            (username,),
        ).fetchone()
    data = {
        "nickname": row["nickname"] if row else "",
        "signature": row["signature"] if row else "",
        "avatar_url": row["avatar_url"] if row else "",
        "username": username,
    }
    return JSONResponse({"code": 200, "data": data})


@app.put("/profile")
async def update_profile(request: Request, payload: ProfilePayload):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    updated_at = datetime.utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO profiles (username, nickname, signature, avatar_url, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                nickname = excluded.nickname,
                signature = excluded.signature,
                avatar_url = excluded.avatar_url,
                updated_at = excluded.updated_at
            """,
            (
                username,
                payload.nickname or "",
                payload.signature or "",
                payload.avatar_url or "",
                updated_at,
            ),
        )
        conn.commit()
    return JSONResponse({"code": 200, "message": "资料已更新"})


@app.get("/login-logs")
async def get_login_logs(request: Request):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT device, ip, created_at
            FROM login_logs
            WHERE username = ?
            ORDER BY created_at DESC
            LIMIT 20
            """,
            (username,),
        ).fetchall()
    data = [
        {
            "device": row["device"],
            "ip": row["ip"],
            "time": row["created_at"],
        }
        for row in rows
    ]
    return JSONResponse({"code": 200, "data": {"list": data}})


@app.post("/auth/password")
async def change_password(request: Request, payload: PasswordPayload):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT password_hash, salt FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not row:
            return JSONResponse({"code": 404, "message": "用户不存在"}, status_code=404)
        if hash_password(payload.current_password, row["salt"]) != row["password_hash"]:
            return JSONResponse({"code": 400, "message": "原密码错误"}, status_code=400)
        new_salt = secrets.token_hex(8)
        new_hash = hash_password(payload.new_password, new_salt)
        conn.execute(
            "UPDATE users SET password_hash = ?, salt = ? WHERE username = ?",
            (new_hash, new_salt, username),
        )
        conn.commit()
    return JSONResponse({"code": 200, "message": "密码已更新"})


@app.get("/favorites")
async def list_favorites(request: Request):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT track_id, source, name, artist
            FROM favorites
            WHERE username = ?
            ORDER BY created_at DESC
            """,
            (username,),
        ).fetchall()
    data = [
        {
            "id": row["track_id"],
            "source": row["source"],
            "name": row["name"],
            "artist": row["artist"],
        }
        for row in rows
    ]
    return JSONResponse({"code": 200, "data": {"list": data}})


@app.post("/favorites")
async def add_favorite(request: Request, payload: FavoritePayload):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    created_at = datetime.utcnow().isoformat()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO favorites (username, track_id, source, name, artist, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                payload.id,
                payload.source,
                payload.name,
                payload.artist,
                created_at,
            ),
        )
        conn.commit()
    return JSONResponse({"code": 200, "message": "已收藏"})


@app.delete("/favorites")
async def remove_favorite(request: Request):
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    track_id = request.query_params.get("id")
    source = request.query_params.get("source")
    if not track_id or not source:
        return JSONResponse({"code": 400, "message": "缺少参数"}, status_code=400)
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM favorites WHERE username = ? AND track_id = ? AND source = ?",
            (username, track_id, source),
        )
        conn.commit()
    return JSONResponse({"code": 200, "message": "已取消收藏"})


@app.get("/status")
async def status():
    return JSONResponse(
        {
            "code": 200,
            "data": {
                "status": "running",
                "platforms": {
                    "netease": {"enabled": True},
                    "kuwo": {"enabled": True},
                    "qq": {"enabled": True},
                },
            },
        }
    )


@app.get("/health")
async def health_check():
    return JSONResponse({"code": 200, "data": {"status": "healthy"}})


@app.get("/stats")
async def stats(request: Request):
    params = list(request.query_params.multi_items())
    upstream = await forward_request("/stats", params=params, follow_redirects=True)
    return build_response(upstream)


@app.get("/stats/summary")
async def stats_summary(request: Request):
    params = list(request.query_params.multi_items())
    upstream = await forward_request("/stats/summary", params=params, follow_redirects=True)
    return build_response(upstream)


@app.get("/stats/platforms")
async def stats_platforms(request: Request):
    params = list(request.query_params.multi_items())
    upstream = await forward_request("/stats/platforms", params=params, follow_redirects=True)
    return build_response(upstream)


@app.get("/stats/qps")
async def stats_qps(request: Request):
    params = list(request.query_params.multi_items())
    upstream = await forward_request("/stats/qps", params=params, follow_redirects=True)
    return build_response(upstream)


@app.get("/stats/trends")
async def stats_trends(request: Request):
    params = list(request.query_params.multi_items())
    upstream = await forward_request("/stats/trends", params=params, follow_redirects=True)
    return build_response(upstream)


@app.get("/stats/types")
async def stats_types(request: Request):
    params = list(request.query_params.multi_items())
    upstream = await forward_request("/stats/types", params=params, follow_redirects=True)
    return build_response(upstream)


# ==================== 管理接口 ====================

@app.get("/admin/access-logs")
async def get_access_logs(
    request: Request, 
    limit: int = 100,
    blocked_only: bool = False
):
    """获取访问日志（需要认证）"""
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    
    with get_conn() as conn:
        query = """
            SELECT ip, path, method, user_agent, status_code, created_at, blocked
            FROM access_logs
        """
        params = []
        
        if blocked_only:
            query += " WHERE blocked = 1"
        
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        rows = conn.execute(query, params).fetchall()
    
    data = [
        {
            "ip": row["ip"],
            "path": row["path"],
            "method": row["method"],
            "user_agent": row["user_agent"],
            "status_code": row["status_code"],
            "created_at": row["created_at"],
            "blocked": bool(row["blocked"]),
        }
        for row in rows
    ]
    return JSONResponse({"code": 200, "data": {"list": data}})


@app.post("/admin/blacklist")
async def add_to_blacklist(request: Request):
    """添加IP到黑名单（需要认证）"""
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    
    data = await request.json()
    ip = data.get("ip")
    reason = data.get("reason", "恶意访问")
    hours = data.get("hours", 24)
    
    if not ip:
        return JSONResponse({"code": 400, "message": "缺少IP地址"}, status_code=400)
    
    created_at = datetime.utcnow().isoformat()
    expires_at = (datetime.utcnow() + timedelta(hours=hours)).isoformat()
    
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO ip_blacklist (ip, reason, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (ip, reason, created_at, expires_at)
        )
        conn.commit()
    
    # 清除该IP的频率限制记录
    if ip in rate_limit_store:
        del rate_limit_store[ip]
    if ip in login_attempts:
        del login_attempts[ip]
    
    return JSONResponse({"code": 200, "message": f"IP {ip} 已添加到黑名单，有效期{hours}小时"})


@app.delete("/admin/blacklist")
async def remove_from_blacklist(request: Request):
    """从黑名单移除IP（需要认证）"""
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    
    ip = request.query_params.get("ip")
    if not ip:
        return JSONResponse({"code": 400, "message": "缺少IP地址"}, status_code=400)
    
    with get_conn() as conn:
        conn.execute("DELETE FROM ip_blacklist WHERE ip = ?", (ip,))
        conn.commit()
    
    return JSONResponse({"code": 200, "message": f"IP {ip} 已从黑名单移除"})


@app.get("/admin/blacklist")
async def get_blacklist(request: Request):
    """获取黑名单列表（需要认证）"""
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT ip, reason, created_at, expires_at
            FROM ip_blacklist
            ORDER BY created_at DESC
            """
        ).fetchall()
    
    data = [
        {
            "ip": row["ip"],
            "reason": row["reason"],
            "created_at": row["created_at"],
            "expires_at": row["expires_at"],
            "is_expired": datetime.fromisoformat(row["expires_at"]) < datetime.utcnow() if row["expires_at"] else False
        }
        for row in rows
    ]
    return JSONResponse({"code": 200, "data": {"list": data}})


@app.get("/admin/stats")
async def get_admin_stats(request: Request):
    """获取反爬统计信息（需要认证）"""
    username = get_username_from_token(request)
    if not username:
        return JSONResponse({"code": 401, "message": "未登录"}, status_code=401)
    
    with get_conn() as conn:
        # 总请求数
        total_requests = conn.execute("SELECT COUNT(*) as count FROM access_logs").fetchone()["count"]
        
        # 被阻止的请求数
        blocked_requests = conn.execute("SELECT COUNT(*) as count FROM access_logs WHERE blocked = 1").fetchone()["count"]
        
        # 今日请求
        today = datetime.utcnow().date().isoformat()
        today_requests = conn.execute(
            "SELECT COUNT(*) as count FROM access_logs WHERE DATE(created_at) = ?",
            (today,)
        ).fetchone()["count"]
        
        # 黑名单IP数
        blacklist_count = conn.execute("SELECT COUNT(*) as count FROM ip_blacklist").fetchone()["count"]
        
        # 访问最多的IP（最近24小时）
        top_ips = conn.execute(
            """
            SELECT ip, COUNT(*) as count
            FROM access_logs
            WHERE datetime(created_at) > datetime('now', '-24 hours')
            GROUP BY ip
            ORDER BY count DESC
            LIMIT 10
            """
        ).fetchall()
    
    return JSONResponse({
        "code": 200,
        "data": {
            "total_requests": total_requests,
            "blocked_requests": blocked_requests,
            "today_requests": today_requests,
            "blacklist_count": blacklist_count,
            "block_rate": f"{(blocked_requests/total_requests*100):.2f}%" if total_requests > 0 else "0%",
            "top_ips": [{"ip": row["ip"], "count": row["count"]} for row in top_ips],
            "active_rate_limits": len(rate_limit_store),
            "locked_ips": len([ip for ip, data in login_attempts.items() if data.get("locked_until")])
        }
    })
