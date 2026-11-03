#!/bin/sh
# Konteyner girişi. Argüman verilmezse: veritabanı hazırlığı + web sunucusu.
# Argüman verilirse (ör. agent job'ı) doğrudan o komut çalışır.
set -e
cd /app

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

npx tsx packages/core/scripts/bootstrap.ts ensure-audit-db
npm run db:migrate
npm run audit:migrate
if [ "${SEED_ON_START:-false}" = "true" ]; then
  npx tsx packages/core/scripts/bootstrap.ts seed-if-empty
fi

exec npm run start -w @infulancer/web -- -p "${PORT:-3000}" -H 0.0.0.0
