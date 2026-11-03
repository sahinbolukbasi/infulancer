import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { buildPain001Xml, buildPayoutCsv, type BankInstruction } from "@infulancer/core/domain/bank-file";
import { requireApiActor } from "@/lib/auth-guard";
import { jsonError } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Banka ödeme talimatı dosyası (yalnız ADMIN): ?batch=<PayoutBatch id>&format=csv|xml.
 * Platform para göndermez; dosya internet bankacılığına yüklenir.
 */
export async function GET(req: Request) {
  const auth = await requireApiActor("ADMIN");
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  const batchId = url.searchParams.get("batch") ?? "";
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  if (!batchId || batchId.length > 64) return jsonError(400, "Ödeme listesi (batch) belirtin.");
  if (format !== "csv" && format !== "xml") return jsonError(400, "Biçim csv veya xml olmalı.");

  const batch = await prisma.payoutBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      createdAt: true,
      requests: {
        where: { status: { in: ["ODEME_LISTESINDE", "GONDERILDI"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, amountKurus: true, ibanSnapshot: true, ibanHolderSnapshot: true },
      },
    },
  });
  if (!batch) return jsonError(404, "Ödeme listesi bulunamadı.");
  if (batch.requests.length === 0) return jsonError(404, "Ödeme listesinde talep yok.");

  const rows: BankInstruction[] = batch.requests.map((r) => ({
    id: r.id,
    recipient: r.ibanHolderSnapshot,
    iban: r.ibanSnapshot,
    amountKurus: r.amountKurus,
    description: `Influencer hizmet bedeli ${r.id.slice(-8).toUpperCase()}`,
  }));

  const now = new Date();
  const body =
    format === "csv"
      ? buildPayoutCsv(rows)
      : buildPain001Xml(rows, { messageId: `INF-${batch.id}`, createdAt: now, executionDate: now });

  await audit.append({
    actor: toAuditActor(auth.actor),
    action: "PAYOUT_BATCH_EXPORT",
    entityType: "PayoutBatch",
    entityId: batch.id,
    data: { format, count: rows.length, totalKurus: rows.reduce((s, r) => s + r.amountKurus, 0) },
  });

  const day = now.toISOString().slice(0, 10);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="odeme-talimati-${day}-${batch.id.slice(-8)}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
