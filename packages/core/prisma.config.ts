import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

// Repo kökündeki .env dosyasını yükle (dotenv bağımlılığı olmadan).
const here = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(here, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: path.join(here, "prisma/schema.prisma"),
  migrations: {
    path: path.join(here, "prisma/migrations"),
    seed: "tsx scripts/seed.ts",
  },
  datasource: {
    // `prisma generate` bağlantı gerektirmez; .env yoksa yer tutucu kullanılır.
    url: process.env.DATABASE_URL ?? "postgresql://placeholder@localhost:5432/placeholder",
  },
});
