# 运行镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 和 lockfile
COPY package.json pnpm-lock.yaml* ./

# 安装 pnpm
RUN npm install -g pnpm@10

# 安装 production 依赖
RUN pnpm install --prod --frozen-lockfile

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 astro

# 复制构建产物
COPY --chown=astro:nodejs dist ./dist

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
