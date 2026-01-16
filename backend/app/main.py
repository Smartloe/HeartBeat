import hashlib
import os
import secrets
import sqlite3
from datetime import datetime

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, RedirectResponse, Response
from pydantic import BaseModel

BASE_URL = os.getenv("TUNEHUB_BASE_URL", "https://music-dl.sayqz.com")
DB_PATH = os.getenv(
    "TUNEHUB_DB_PATH", os.path.join(os.path.dirname(__file__), "tunehub.sqlite")
)

app = FastAPI(title="TuneHub API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.on_event("startup")
def startup() -> None:
    init_db()


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
    with get_conn() as conn:
        row = conn.execute(
            "SELECT password_hash, salt FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    if not row:
        return JSONResponse({"code": 401, "message": "账号或密码错误"}, status_code=401)
    expected = hash_password(payload.password, row["salt"])
    if expected != row["password_hash"]:
        return JSONResponse({"code": 401, "message": "账号或密码错误"}, status_code=401)
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
