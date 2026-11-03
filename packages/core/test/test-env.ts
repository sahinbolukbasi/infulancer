import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Test ortamı: .env'deki bağlantıdan türetilen ayrı _test veritabanları, mock sağlayıcılar. */
export function testEnv(): Record<string, string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const envFile = path.resolve(here, "../../../.env");
  const base = process.env.TEST_DATABASE_URL ?? (existsSync(envFile) ? readFileSync(envFile, "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1] : undefined);
  if (!base) throw new Error("TEST_DATABASE_URL veya .env DATABASE_URL gerekli");
  const u = new URL(base);
  const db = u.pathname.slice(1).replace(/_test$/, "");
  const test = new URL(base);
  test.pathname = `/${db}_test`;
  const audit = new URL(base);
  audit.pathname = `/${db}_test_audit`;
  return {
    DATABASE_URL: test.toString(),
    AUDIT_DATABASE_URL: audit.toString(),
    LLM_PROVIDER: "mock",
    META_API_MODE: "mock",
    IYS_MODE: "mock",
    FAL_MODE: "mock",
    SOCIAL_SYNC_MODE: "mock",
    C2PA_MODE: "mock",
    OBJECT_STORE: "memory",
    VAULT_MODE: "local",
    VAULT_DIR: path.join(tmpdir(), "infulancer-test-vault"),
    META_APP_SECRET: "test-app-secret",
    WEBHOOK_REQUIRE_SIGNATURE: "true",
    AUTH_SECRET: "test-auth-secret",
    S3_BUCKET: "test",
    EVENT_MODE: "inline",
    LINK_CHECK_MODE: "mock",
    MIN_PAYOUT_KURUS: "50000",
    HOLD_DAYS: "0",
  };
}
