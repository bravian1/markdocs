FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/markdown-core/package.json packages/markdown-core/
COPY packages/editor/package.json packages/editor/
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @markdocs/web exec next build

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 MARKDOCS_ROOT=/data/docs
COPY --from=build /app /app
EXPOSE 3000
VOLUME ["/data/docs"]
WORKDIR /app/apps/web
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]
