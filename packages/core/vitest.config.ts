import { defineConfig } from "vitest/config";

// Entegrasyon testleri yerel Postgres'teki ayrı test veritabanına (…_test) karşı sırayla çalışır.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/env.ts"],
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
