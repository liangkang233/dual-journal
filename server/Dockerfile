# 使用 Debian 基础镜像（包含构建工具，适合原生依赖编译）
FROM node:20-bookworm-slim

# 安装 curl（用于 healthcheck）和 python3/make/g++（用于 better-sqlite3 编译）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      python3 \
      make \
      g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖清单并安装（利用 Docker 缓存层）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 复制服务器源码和静态文件
COPY src/ ./src/
COPY public/ ./public/

# 创建数据目录和上传目录，设置权限
RUN mkdir -p /app/data /app/uploads && \
    chown -R node:node /app

# 切换到非 root 用户
USER node

# 暴露端口
EXPOSE 8787

# 健康检查（10s 间隔，3 次失败标记为 unhealthy）
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

# 启动命令
CMD ["node", "src/index.js"]
