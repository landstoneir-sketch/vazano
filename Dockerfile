# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm install --global npm@11.16.0 --no-audit --no-fund
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run prisma:generate && npm run build

FROM builder AS production-dependencies
RUN npm prune --omit=dev

FROM dependencies AS migration-runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 vazano
COPY --chown=vazano:nodejs apps/api/prisma ./apps/api/prisma
COPY --chown=vazano:nodejs apps/api/src/modules/auth/domain/mobile.ts ./apps/api/src/modules/auth/domain/mobile.ts
RUN npm run prisma:generate
USER vazano
CMD ["npm", "run", "prisma:deploy"]

FROM ${NODE_IMAGE} AS api-runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 vazano
COPY --from=production-dependencies --chown=vazano:nodejs /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=vazano:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=vazano:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=vazano:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=vazano:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=vazano:nodejs /app/package.json ./package.json
USER vazano
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3001/v1/health/ready >/dev/null || exit 1
CMD ["node", "apps/api/dist/src/main.js"]

FROM ${NODE_IMAGE} AS web-runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server.js"]
