import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = path.join(import.meta.dirname, "../..");

// Yerel geliştirmede tek .env repo kökündedir; Next yalnız apps/web/.env* okur.
// process.loadEnvFile mevcut değişkenleri ezmez (ör. Lambda ortam değişkenleri).
const rootEnv = path.join(repoRoot, ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo kökü: standalone çıktısı workspace paketlerini de izler.
  outputFileTracingRoot: repoRoot,
  // PDF raporu fontları fs'den okunur; standalone çıktısına dahil edilmeli.
  outputFileTracingIncludes: { "/api/raporlar/kampanya/[id]/pdf": ["./assets/fonts/**"] },
  transpilePackages: ["@infulancer/core"],
  serverExternalPackages: ["pg", "@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
