import { createHash } from "node:crypto";
import pg from "pg";
import { requireEnv } from "./env";

/**
 * Bağımsız, değiştirilemez audit log (infulancer_audit DB).
 * Her satır bir önceki satırın hash'ine zincirlenir: hash = sha256(prev_hash + canonicalJSON(satır)).
 */

export type AuditActor = {
  /** Kullanıcı id'si; sistem/agent işlemlerinde null. */
  id: string | null;
  role: string;
};

export type AuditInput = {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
};

export type AuditRecord = {
  id: string;
  at: Date;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
};

const globalForAudit = globalThis as unknown as { __infulancerAuditPool?: pg.Pool };

function pool(): pg.Pool {
  if (!globalForAudit.__infulancerAuditPool) {
    globalForAudit.__infulancerAuditPool = new pg.Pool({
      connectionString: requireEnv("AUDIT_DATABASE_URL"),
      max: 5,
    });
  }
  return globalForAudit.__infulancerAuditPool;
}

/** Anahtarları sıralı, deterministik JSON. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

// Tüm audit yazımlarını tek zincirde serileştiren advisory lock anahtarı.
const AUDIT_LOCK_KEY = 7_311_204;

export async function append(input: AuditInput): Promise<{ id: string; hash: string }> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [AUDIT_LOCK_KEY]);
    const prev = await client.query<{ hash: string }>(
      "SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1",
    );
    const prevHash = prev.rows[0]?.hash ?? null;
    const at = new Date();
    const data = input.data ?? {};
    const payload = canonicalJson({
      at: at.toISOString(),
      actorId: input.actor.id,
      actorRole: input.actor.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      data,
    });
    const hash = createHash("sha256")
      .update((prevHash ?? "") + payload)
      .digest("hex");
    const res = await client.query<{ id: string }>(
      `INSERT INTO audit_log (at, actor_id, actor_role, action, entity_type, entity_id, data, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9) RETURNING id`,
      [
        at,
        input.actor.id,
        input.actor.role,
        input.action,
        input.entityType,
        input.entityId,
        canonicalJson(data),
        prevHash,
        hash,
      ],
    );
    await client.query("COMMIT");
    return { id: String(res.rows[0]!.id), hash };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

type AuditRow = {
  id: string;
  at: Date;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  data: Record<string, unknown>;
  prev_hash: string | null;
  hash: string;
};

export async function list(filter: {
  entityType: string;
  entityId: string;
  limit?: number;
}): Promise<AuditRecord[]> {
  const res = await pool().query<AuditRow>(
    `SELECT id, at, actor_id, actor_role, action, entity_type, entity_id, data, prev_hash, hash
       FROM audit_log WHERE entity_type = $1 AND entity_id = $2
       ORDER BY id DESC LIMIT $3`,
    [filter.entityType, filter.entityId, filter.limit ?? 200],
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    at: r.at,
    actorId: r.actor_id,
    actorRole: r.actor_role,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    data: r.data,
    prevHash: r.prev_hash,
    hash: r.hash,
  }));
}

/** Birden çok varlığın kayıtları tek sorguda (ör. marka + kampanyaları + atamaları), en yeni önce. */
export async function listMany(filter: { entities: { entityType: string; entityIds: string[] }[]; limit?: number }): Promise<AuditRecord[]> {
  const groups = filter.entities.filter((e) => e.entityIds.length > 0);
  if (groups.length === 0) return [];
  const params: unknown[] = [];
  const where = groups
    .map((g) => {
      params.push(g.entityType, g.entityIds);
      return `(entity_type = $${params.length - 1} AND entity_id = ANY($${params.length}::text[]))`;
    })
    .join(" OR ");
  params.push(Math.min(filter.limit ?? 200, 1000));
  const res = await pool().query<AuditRow>(
    `SELECT id, at, actor_id, actor_role, action, entity_type, entity_id, data, prev_hash, hash
       FROM audit_log WHERE ${where}
       ORDER BY id DESC LIMIT $${params.length}`,
    params,
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    at: r.at,
    actorId: r.actor_id,
    actorRole: r.actor_role,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    data: r.data,
    prevHash: r.prev_hash,
    hash: r.hash,
  }));
}
/** Script'ler için havuzu kapatır. */
export async function closeAuditPool(): Promise<void> {
  await globalForAudit.__infulancerAuditPool?.end();
  globalForAudit.__infulancerAuditPool = undefined;
}

export const audit = { append, list, listMany };
