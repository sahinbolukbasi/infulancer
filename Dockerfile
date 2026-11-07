# Tek imaj: Next.js web uygulaması + core betikleri (migrasyon, seed, agent job'ları).
# Fargate ARM64 üzerinde çalışır.
FROM node:24.14.0-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/core/prisma packages/core/prisma
COPY packages/core/prisma.config.ts packages/core/
RUN npm ci
COPY . .
# Yalnız derleme aşaması için yer tutucular (bağlantı kurulmaz); çalışma zamanı değerleri
# Secrets Manager'dan gelir ve bu aşamadan son imaja taşınmaz.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    AUDIT_DATABASE_URL=postgresql://build:build@localhost:5432/build_audit \
    AUTH_SECRET=build-only-placeholder S3_BUCKET=build \
    npm run build -w @infulancer/web

FROM node:24.14.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# openssl+zip: Apple Wallet .pkpass imzası · ffmpeg: Creative stüdyo video düzenleme (AI maliyeti yok).
RUN apt-get update && apt-get install -y --no-install-recommends openssl zip ffmpeg && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
RUN chmod +x docker/entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
