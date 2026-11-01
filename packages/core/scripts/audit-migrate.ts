import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { requireEnv } from "../src/env";

// audit/*.sql dosyalarını sırayla, idempotent olarak uygular.
const here = path.dirname(fileURLToPath(import.meta.url));
const files = ["001_audit_log.sql"];

async function main() {
  const client = new pg.Client({ connectionString: requireEnv("AUDIT_DATABASE_URL") });
  await client.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(path.resolve(here, "../audit", file), "utf8");
      await client.query(sql);
      console.log(`audit: ${file} uygulandı`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
