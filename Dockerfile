# ===== 构建阶段：编译前端 =====
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖清单
COPY package.json package-lock.json ./

# 安装所有依赖（含 devDependencies，构建需要）
RUN npm ci

# 复制源码和共享模块
COPY src ./src
COPY shared ./shared
COPY public ./public
COPY index.html vite.config.js ./

# 构建前端产物到 dist/
RUN npm run build

# ===== 运行阶段：只装生产依赖 + 启动服务 =====
FROM node:20-alpine AS runner

WORKDIR /app

# 安装生产依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY shared ./shared

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# 启动服务
CMD ["node", "server/index.js"]
