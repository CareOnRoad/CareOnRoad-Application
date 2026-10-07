# syntax=docker/dockerfile:1

# Debian supplies glibc for the sherpa-onnx native addon.
FROM node:24-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --global "$(node --print 'require("./package.json").packageManager')"
RUN pnpm --filter @careonroad/api... install --frozen-lockfile

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
COPY apps/api ./apps/api
RUN pnpm run build:api

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/api/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/api/.next/static ./apps/api/.next/static
COPY --from=builder --chown=node:node /app/apps/api/models ./apps/api/models
COPY --from=builder --chown=node:node /app/apps/api/scripts/asr-smoke.mjs /app/apps/api/scripts/run-payment-workers.mjs ./apps/api/scripts/
WORKDIR /app/apps/api
USER node
# Fail the image build if tracing omitted the native addon or its shared libraries.
RUN node -e "require('node:assert/strict').equal(typeof require('sherpa-onnx-node').OfflineRecognizer, 'function')"
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/v1/internal/health/live', {signal: AbortSignal.timeout(3000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
