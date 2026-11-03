/**
 * Konteyner başlangıç yardımcıları (idempotent).
 *   tsx scripts/bootstrap.ts ensure-audit-db   → audit veritabanı yoksa oluşturur
 *   tsx scripts/bootstrap.ts seed-if-empty     → hiç kullanıcı yoksa seed çalıştırır;
 *                                               ek modül verisi yoksa yalnız onu yükler
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { requireEnv } from "../src/env";

const here = path.dirname(fileURLToPath(import.meta.url));

async function ensureAuditDb() {
  const auditUrl = new URL(requireEnv("AUDIT_DATABASE_URL"));
  const dbName = auditUrl.pathname.replace(/^\//, "");
  if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) throw new Error(`Geçersiz audit DB adı: ${dbName}`);
  const client = new pg.Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();
  try {
    const found = await client.query("select 1 from pg_database where datname = $1", [dbName]);
    if (found.rowCount === 0) {
      // Ad yukarıda doğrulandı; CREATE DATABASE parametre kabul etmez.
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`bootstrap: ${dbName} oluşturuldu`);
    } else {
      console.log(`bootstrap: ${dbName} mevcut`);
    }
  } finally {
    await client.end();
  }
}

async function seedIfEmpty() {
  const client = new pg.Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();
  let users = 0;
  try {
    const res = await client.query('select count(*)::int as n from "User"');
    users = res.rows[0]?.n ?? 0;
  } finally {
    await client.end();
  }
  if (users > 0) {
    const c2 = new pg.Client({ connectionString: requireEnv("DATABASE_URL") });
    await c2.connect();
    let cfg = 0;
    try {
      cfg = (await c2.query("select count(*)::int as n from config_values")).rows[0]?.n ?? 0;
    } finally {
      await c2.end();
    }
    if (cfg === 0) {
      const r = spawnSync("npx", ["tsx", path.join(here, "seed-addon-run.ts")], { stdio: "inherit", cwd: path.resolve(here, "..") });
      if (r.status !== 0) throw new Error("seed-addon başarısız");
      return;
    }
    console.log(`bootstrap: ${users} kullanıcı var, seed atlandı`);
    return;
  }
  const r = spawnSync("npx", ["tsx", path.join(here, "seed.ts")], { stdio: "inherit", cwd: path.resolve(here, "..") });
  if (r.status !== 0) throw new Error("seed başarısız");
}

const cmd = process.argv[2];
const run = cmd === "ensure-audit-db" ? ensureAuditDb : cmd === "seed-if-empty" ? seedIfEmpty : null;
if (!run) {
  console.error("Kullanım: bootstrap.ts ensure-audit-db | seed-if-empty");
  process.exit(1);
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
