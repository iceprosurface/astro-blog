ARG NODE_IMAGE=node:20-alpine

FROM ${NODE_IMAGE} AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
RUN pnpm install --prod --frozen-lockfile

FROM ${NODE_IMAGE} AS runner

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 astro

COPY --chown=astro:nodejs dist ./dist

ENV NODE_ENV=production \
    PORT=4321 \
    HOST=0.0.0.0

EXPOSE 4321

USER astro

CMD ["node", "./dist/server/entry.mjs"]
