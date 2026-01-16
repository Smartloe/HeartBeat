# HeartBeat
不用会员，随心所动

前后端分离的音乐播放器项目，包含 React 前端与 FastAPI 后端。

## 项目结构

- `frontend/`：React + Vite 前端
- `backend/`：FastAPI 后端（SQLite 持久化）
- `TuneHub API Documentation.md`：第三方 API 文档

## 前端运行

```bash
cd frontend
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0 --port 5173
```

环境变量：

- `VITE_API_BASE`：后端地址，例如 `http://localhost:8000`

## 后端运行

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

环境变量：

- `TUNEHUB_BASE_URL`：上游 TuneHub API 地址（默认 `https://music-dl.sayqz.com`）
- `TUNEHUB_DB_PATH`：SQLite 文件路径（默认 `backend/app/tunehub.sqlite`）

## 常用接口

- `GET /health`：健康检查
- `POST /auth/register`：注册
- `POST /auth/login`：登录
- `POST /auth/logout`：退出
- `GET /profile`：获取个人资料
- `PUT /profile`：更新个人资料
- `POST /auth/password`：修改密码
- `GET /favorites`：收藏列表
- `POST /favorites`：添加收藏
- `DELETE /favorites?id=...&source=...`：移除收藏

## 备注

- 首次运行会自动创建 SQLite 表结构。
- 前端请确保 `VITE_API_BASE` 与后端端口一致。
