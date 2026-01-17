# HeartBeat 后端 Dockerfile

# 构建阶段 - 使用官方Python运行时作为基础镜像
FROM python:3.11-slim AS builder

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制requirements文件
COPY app/requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# ==================== 生产阶段 ====================
FROM python:3.11-slim AS production

# 设置工作目录
WORKDIR /app

# 创建非root用户
RUN addgroup --system app && adduser --system app --group

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="$PATH:/home/app/.local/bin"

# 安装运行时依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制已安装的Python包
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 创建数据存储目录
RUN mkdir -p /app/app && chown -R app:app /app

# 复制应用代码
COPY --chown=app:app backend/app /app/app

# 切换到非root用户
USER app

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动应用
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ==================== 开发阶段 ====================
FROM builder AS development

# 安装开发依赖
COPY backend/app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt uvicorn[standard]

# 创建应用用户
RUN addgroup --system app && adduser --system app --group
RUN mkdir -p /app/app && chown -R app:app /app

# 复制应用代码
COPY --chown=app:app backend/app /app/app

# 暴露端口
EXPOSE 8000

# 开发模式启动命令（热重载）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ==================== 测试阶段 ====================
FROM builder AS test

# 安装测试依赖
COPY backend/app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt pytest pytest-cov httpx

# 复制应用代码和测试文件
COPY backend/app /app/app
COPY tests /app/tests

# 运行测试
CMD ["pytest", "-v", "--tb=short", "--cov=app", "tests/"]

# ==================== 构建阶段说明 ====================
# builder      : 安装所有依赖，用于构建
# development  : 开发环境，支持热重载
# test         : 运行单元测试
# production   : 生产环境，最简镜像

# 使用示例：
# 开发环境： docker build -f backend/Dockerfile -t heartbeat-backend:dev --target development .
# 生产环境： docker build -f backend/Dockerfile -t heartbeat-backend:prod --target production .
# 运行测试： docker build -f backend/Dockerfile -t heartbeat-backend:test --target test .

# 生产环境安全特性：
# 1. 使用非root用户运行应用
# 2. 最小化基础镜像（python:3.11-slim）
# 3. 设置健康检查
# 4. 禁用Python字节码缓存
# 5. 启用非缓冲输出

# 环境变量说明：
# TUNEHUB_BASE_URL    : 上游API地址
# TUNEHUB_DB_PATH     : 数据库文件路径
# PYTHONUNBUFFERED    : Python输出缓冲控制
# PYTHONDONTWRITEBYTECODE : 禁用字节码缓存