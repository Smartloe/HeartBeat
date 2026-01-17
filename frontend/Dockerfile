# HeartBeat 前端 Dockerfile

# 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:alpine AS production

# 复制nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

# 复制构建结果到nginx网页目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]

# 开发阶段
FROM node:18-alpine AS development
WORKDIR /app

# 安装所有依赖（包含开发依赖）
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 暴露开发端口
EXPOSE 5173

# 启动开发服务器
CMD ["npm", "run", "dev"]

# 测试阶段
FROM node:18-alpine AS test
WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 运行测试
CMD ["npm", "run", "test"]

# 多阶段构建：
# 1. development: 用于开发和本地测试
# 2. test: 用于运行测试
# 3. builder: 用于构建生产版本
# 4. production: 用于生产环境部署

# 使用示例：
# 开发环境： docker build -t heartbeat-frontend:dev --target development .
# 生产环境： docker build -t heartbeat-frontend:prod .
# 运行测试： docker build -t heartbeat-frontend:test --target test .