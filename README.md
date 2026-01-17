# HeartBeat 🎵
不用会员，随心所动

一个前后端分离的音乐播放器项目，支持网易云音乐、QQ音乐、酷我音乐三大平台，提供完整的用户系统、音乐搜索、播放、收藏等功能。

## ✨ 功能特性

### 🎶 音乐功能
- 支持网易云音乐、QQ音乐、酷我音乐三大平台
- 音乐搜索与播放
- 歌词同步显示
- 音乐榜单查看
- 音频可视化效果
- 播放模式：顺序、循环、单曲、随机

### 👤 用户系统
- 用户注册与登录
- 个人资料管理
- 音乐收藏功能
- 登录日志记录
- 密码修改

### 🛡️ 安全特性
- 请求频率限制（防爬虫）
- User-Agent检测
- IP黑名单管理
- 登录失败锁定
- 完整的访问日志

## 🏗️ 项目结构

```
HeartBeat/
├── frontend/              # React + Vite 前端
│   ├── src/              # 前端源代码
│   ├── public/           # 静态资源
│   ├── package.json      # 前端依赖
│   ├── Dockerfile       # 前端Docker配置（新增）
│   ├── nginx.conf       # 生产环境Nginx配置（新增）
│   └── vite.config.js   # Vite配置
├── backend/              # FastAPI 后端
│   ├── app/             # 后端应用代码
│   │   ├── main.py      # 主程序
│   │   └── tunehub.sqlite # 数据库文件
│   ├── Dockerfile       # 后端Docker配置（新增）
│   └── requirements.txt  # Python依赖
data/                    # Docker数据持久化目录（新增）
logs/                    # Docker日志持久化目录（新增）
├── docker-compose.yml        # 主Docker Compose配置（新增）
├── docker-compose.prod.yml   # 生产环境配置（新增）
├── .env.example         # 环境变量示例
├── .gitignore           # Git忽略文件
├── README.md            # 项目说明
└── TuneHub API Documentation.md  # 第三方API文档
```

## 🚀 快速开始

### 环境要求
- Node.js 18+ (前端)
- Python 3.8+ (后端)
- npm 或 yarn (包管理)
- Docker & Docker Compose v2.0+ (可选，用于容器化部署)

## 🐳 容器化部署 (推荐)

### Ubuntu 22 安装 Docker (首次部署)

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

安装后使用 `docker compose` 命令。若已安装独立版 Compose，也可使用 `docker-compose`。

### 生产环境一键部署

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/HeartBeat.git
cd HeartBeat

# 2. 创建必要的目录
mkdir -p data/heartbeat logs/heartbeat

# 3. 启动所有服务
docker compose up -d

# 4. 查看服务状态
docker compose ps

# 5. 查看日志
docker compose logs -f
```

服务启动后：
- 前端：http://localhost
- 后端API：http://localhost:8000
- 文档：http://localhost:8000/docs

### 开发环境容器化启动

```bash
# 启动开发环境（包含热重载）
docker-compose --profile development up

# 或者分别启动前端和后端开发容器
docker-compose up heartbeat-frontend-dev heartbeat-backend-dev
```

### 常用Docker命令

```bash
# 启动服务
 docker-compose up -d

# 停止服务
docker-compose down

# 重启特定服务
docker-compose restart heartbeat-backend

# 查看日志
docker-compose logs -f heartbeat-backend

# 进入容器
docker-compose exec heartbeat-backend sh

# 重新构建镜像
docker-compose build --no-cache

# 清理所有容器和镜像
docker-compose down --rmi all --volumes

# 生产环境部署（使用生产配置）
docker-compose -f docker-compose.prod.yml up -d
```

## 🛠️ 传统部署方式

### 1. 前端运行

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.development

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:5173` 启动。

### 2. 后端运行

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端将在 `http://localhost:8000` 启动。

## ⚙️ 环境变量配置

### 前端环境变量 (.env.development)
```env
VITE_API_BASE=http://localhost:8000
```

### 后端环境变量
```bash
# 通过环境变量设置
export TUNEHUB_BASE_URL=https://music-dl.sayqz.com
export TUNEHUB_DB_PATH=backend/app/tunehub.sqlite
```

## 📡 API 接口文档

后端启动后，访问 `http://localhost:8000/docs` 查看完整的 API 文档（Swagger UI）。

### 主要接口

#### 用户认证
- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录
- `POST /auth/logout` - 退出登录
- `GET /auth/me` - 获取当前用户信息

#### 个人资料
- `GET /profile` - 获取个人资料
- `PUT /profile` - 更新个人资料
- `POST /auth/password` - 修改密码
- `GET /login-logs` - 查看登录日志

#### 音乐功能
- `GET /api/?type=search&keyword=...&source=...` - 搜索音乐
- `GET /api/?type=toplists&source=...` - 获取音乐榜单
- `GET /api/?type=lrc&id=...&source=...` - 获取歌词
- `GET /api/?type=url&id=...&source=...` - 获取音乐播放地址
- `GET /api/?type=pic&id=...&source=...` - 获取专辑封面

#### 收藏功能
- `GET /favorites` - 获取收藏列表
- `POST /favorites` - 添加收藏
- `DELETE /favorites?id=...&source=...` - 移除收藏

#### 系统状态
- `GET /health` - 健康检查
- `GET /status` - 系统状态

#### 反爬虫管理（需要登录）
- `GET /admin/access-logs` - 查看访问日志
- `GET /admin/blacklist` - 查看黑名单
- `POST /admin/blacklist` - 添加IP到黑名单
- `DELETE /admin/blacklist?ip=...` - 从黑名单移除IP
- `GET /admin/stats` - 查看反爬统计信息

## 🛡️ 反爬虫保护

项目内置了多层反爬虫保护机制：

### 1. 频率限制
- 每个IP每分钟最多60个请求
- 超出限制返回 403 错误

### 2. User-Agent检测
- 检测可疑的User-Agent（bot, crawler, spider等）
- 缺少User-Agent会被拦截

### 3. 登录保护
- 每个IP最多5次登录尝试
- 失败5次后锁定5分钟
- 显示剩余尝试次数

### 4. IP黑名单
- 支持手动管理IP黑名单
- 可设置有效期
- 自动清理过期记录

### 5. 访问日志
- 记录所有请求信息
- 支持查询和分析

## 🔧 开发说明

### 数据库
- 使用 SQLite 作为数据库
- 首次运行自动创建表结构
- 数据库文件：`backend/app/tunehub.sqlite`

### 前端开发
```bash
cd frontend
npm run dev      # 开发模式
npm run build    # 生产构建
npm run preview  # 预览构建结果
```

### 后端开发
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📊 项目配置

### 反爬虫配置（backend/app/main.py）
```python
RATE_LIMIT_REQUESTS = 60      # 每分钟请求数
RATE_LIMIT_WINDOW = 60        # 时间窗口（秒）
MAX_LOGIN_ATTEMPTS = 5        # 最大登录尝试次数
LOCKOUT_TIME = 300            # 锁定时间（秒）
```

### 前端配置（frontend/vite.config.js）
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
})
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目仅供学习交流使用，请勿用于商业用途。

## 🙏 致谢

- [TuneHub API](https://music-dl.sayqz.com) - 提供音乐数据
- FastAPI - 优秀的Python Web框架
- React + Vite - 现代前端开发工具链

## 🐳 Docker 部署

项目完整支持 Docker 容器化部署，包含以下特性：

### Docker 配置文件
- `Dockerfile` (frontend) - 前端多阶段构建Dockerfile
- `Dockerfile` (backend) - 后端生产级Dockerfile
- `docker-compose.yml` - 标准部署配置
- `docker-compose.prod.yml` - 生产环境优化配置
- `nginx.conf` - 前端生产环境Nginx配置

### Docker 特性
- 🔒 安全：使用非root用户运行，最小化权限
- 📦 优化：多阶段构建，减小镜像体积
- 💾 持久化：数据库和日志持久化存储
- 🛡️ 健康检查：自动监控服务状态
- 🔥 热重载：开发环境支持代码热重载
- 🚀 水平扩展：生产环境支持容器水平扩展
- 📊 日志管理：集中式日志配置

### 生产环境建议

1. **SSL配置**：配置HTTPS证书
   ```bash
   # 创建SSL证书目录
   mkdir -p nginx/ssl
   cp your-cert.crt nginx/ssl/
   cp your-key.key nginx/ssl/
   ```

2. **负载均衡**：使用nginx作为反向代理
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **监控告警**：配置容器监控
   ```bash
   docker-compose --profile monitoring up
   ```

4. **自动部署**：集成CI/CD
   ```
   # 示例GitHub Actions配置
   - docker-compose build
   - docker-compose up -d
   ```

## 📞 支持

如有问题或建议，请提交 Issue 或 Pull Request。
