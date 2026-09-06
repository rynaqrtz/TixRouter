FROM node:22-alpine AS build
WORKDIR /repo
RUN npm install -g pnpm@9.15.9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/constants/package.json packages/constants/
COPY packages/db/package.json packages/db/
COPY packages/executors/package.json packages/executors/
COPY packages/pricing/package.json packages/pricing/
COPY packages/providers/package.json packages/providers/
COPY packages/translator/package.json packages/translator/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN pnpm --filter ./apps/api deploy --prod /out
RUN mkdir /out/web-dist && cp -r apps/web/dist/. /out/web-dist

FROM node:22-alpine
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/rynarouter.db
ENV WEB_DIST_PATH=/app/web-dist
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
VOLUME /data
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/index.js"]
