# Crew Tanks: one container serves the built client and the Socket.IO game server.
FROM node:20-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    CI=true
RUN corepack enable
WORKDIR /app

# Install first (cache layer), then copy sources and build the client.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
# Dev dependencies are needed: the server runs through tsx and the client needs Vite to build.
RUN NODE_ENV=development pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["pnpm", "start"]
