import { createHash } from "node:crypto";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { getConfig } from "../config/store";
import { envStr } from "../env";
import { withTenant } from "../tenancy";

/**
 * Tenant başına izole bilgi tabanı (pgvector). Her retrieval WHERE tenantId içerir VE
 * RLS'li rolle çalışır (iki kat koruma). Tenant'lar arası retrieval/eğitim YASAK.
 */
export const DIMS = 256;

function tokens(text: string): string[] {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

/** Deterministik mock embedding: kelime + 3-gram hashing, L2 normalize. */
export function mockEmbed(text: string): number[] {
  const v = new Array<number>(DIMS).fill(0);
  const add = (s: string, w: number) => {
    const h = createHash("md5").update(s).digest();
    const idx = h.readUInt16BE(0) % DIMS;
    v[idx] = (v[idx] ?? 0) + w;
  };
  for (const t of tokens(text)) {
    add(`w:${t}`, 1);
    for (let i = 0; i + 3 <= t.length; i++) add(`g:${t.slice(i, i + 3)}`, 0.3);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embed(text: string): Promise<number[]> {
  if (envStr("LLM_PROVIDER", "mock") !== "bedrock") return mockEmbed(text);
  const models = await getConfig("bedrock.models");
  const client = new BedrockRuntimeClient({ region: models.region });
  const res = await client.send(
    new InvokeModelCommand({
      modelId: models.embedding,
      contentType: "application/json",
      body: JSON.stringify({ inputText: text.slice(0, 8000), dimensions: DIMS, normalize: true }),
    }),
  );
  const json = JSON.parse(new TextDecoder().decode(res.body)) as { embedding: number[] };
  return json.embedding;
}

export function toVectorLiteral(v: number[]): string {
  return `[${v.map((x) => (Number.isFinite(x) ? x.toFixed(6) : "0")).join(",")}]`;
}

export function chunkText(text: string, size = 800, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // Kısa metinlerde cümle/başlık bazlı parçalama (SSS tipi içerik için daha isabetli).
  if (clean.length <= size * 2) {
    const parts = clean.split(/(?<=[.!?])\s+(?=\p{Lu})/u).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += size - overlap) {
    out.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
  }
  return out;
}

export type SourceType = "manual" | "pdf" | "docx" | "url" | "catalog_csv" | "message";

/** Metin kaynağını parçalara ayırıp tenant kapsamında indeksler. */
export async function ingestText(tenantId: string, input: { type: SourceType; uri: string; text: string; messageId?: string }) {
  const chunks = chunkText(input.text);
  const vectors = await Promise.all(chunks.map(embed));
  return withTenant(tenantId, async (tx) => {
    const source = await tx.knowledgeSource.create({
      data: { tenantId, type: input.type, uri: input.uri, status: "ready", messageId: input.messageId ?? null },
    });
    for (let i = 0; i < chunks.length; i++) {
      await tx.$executeRaw`
        INSERT INTO knowledge_chunks (id, "tenantId", "sourceId", content, embedding, "messageId", "createdAt")
        VALUES (${`${source.id}_${i}`}, ${tenantId}, ${source.id}, ${chunks[i]}, ${toVectorLiteral(vectors[i]!)}::vector, ${input.messageId ?? null}, now())`;
    }
    return { sourceId: source.id, chunks: chunks.length };
  });
}

/** Ürün kataloğu CSV'si: her satır bir parça. */
export async function ingestCatalogCsv(tenantId: string, uri: string, csv: string) {
  const [header, ...rows] = csv.split(/\r?\n/).filter(Boolean);
  const cols = (header ?? "").split(",").map((c) => c.trim());
  const text = rows.map((r) => r.split(",").map((v, i) => `${cols[i] ?? `alan${i}`}: ${v.trim()}`).join("; ")).join("\n");
  return ingestText(tenantId, { type: "catalog_csv", uri, text });
}

export type Retrieved = { id: string; content: string; score: number };

export async function retrieve(tenantId: string, query: string, k = 4): Promise<Retrieved[]> {
  const q = toVectorLiteral(await embed(query));
  return withTenant(tenantId, (tx) =>
    tx.$queryRaw<Retrieved[]>`
      SELECT id, content, (1 - (embedding <=> ${q}::vector))::float8 AS score
      FROM knowledge_chunks
      WHERE "tenantId" = ${tenantId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${q}::vector
      LIMIT ${k}`,
  );
}

const STOP = new Set(["kac", "ne", "mi", "mu", "nasil", "nedir", "var", "icin", "ve", "ile", "bir", "bu", "da", "de", "ben", "siz", "acaba", "midir", "mudur"]);
const stem = (t: string) => t.slice(0, 4);

/**
 * Sözcük kapsaması (0..1): sorgudaki içerik sözcüklerinin (Türkçe ekler için 4 harflik kök)
 * parçada geçme oranı. Güven = max(vektör benzerliği, kapsama) — hibrit retrieval güveni.
 */
export function lexicalCoverage(query: string, content: string): number {
  const q = [...new Set(tokens(query).filter((t) => !STOP.has(t)).map(stem))];
  if (!q.length) return 0;
  const c = new Set(tokens(content).map(stem));
  return q.filter((t) => c.has(t)).length / q.length;
}

export async function retrieveWithConfidence(tenantId: string, query: string, k = 4) {
  const hits = await retrieve(tenantId, query, k);
  const scored = hits.map((h) => ({ ...h, confidence: Math.max(h.score, lexicalCoverage(query, h.content)) }));
  scored.sort((a, b) => b.confidence - a.confidence);
  return scored;
}
