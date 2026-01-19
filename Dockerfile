# 多阶段构建 - 第一阶段：构建
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml* ./

# 安装 pnpm
RUN npm install -g pnpm@10

# 安装依赖（只在 package.json 变化时重建）
RUN pnpm install --frozen-lockfile

# 复制配置文件（只在配置变化时重建）
COPY astro.config.mjs tsconfig.json package.json ./

# 复制源代码和资源（只在代码变化时重建）
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/ ./scripts/

# 构建项目
RUN pnpm run build

# 多阶段构建 - 第二阶段：运行
FROM node:20-alpine AS runner

# 设置工作目录
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 astro

# 复制构建产物
COPY --from=builder --chown=astro:nodejs /app/dist ./dist
COPY --from=builder --chown=astro:nodejs /app/package.json ./package.json

# 设置环境变量
ENV NODE_ENV=production \
    PORT=4321 \
    HOST=0.0.0.0

# 暴露端口
EXPOSE 4321

# 切换到非 root 用户
USER astro

# 启动应用
CMD ["node", "./dist/server/entry.mjs"]
