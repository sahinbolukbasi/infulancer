import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { testEnv } from "./test-env";

/** Test veritabanını şemaya getirir (migrate deploy + audit). */
export default function setup() {
  const env = { ...process.env, ...testEnv() };
  const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  execSync("npx prisma migrate deploy", { cwd, env, stdio: "pipe" });
  execSync("npx tsx scripts/audit-migrate.ts", { cwd, env, stdio: "pipe" });
}
