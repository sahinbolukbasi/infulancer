import { prisma } from "@infulancer/core/db";
import { reconcileStaleJobs } from "@infulancer/core/creative/fal";
import { tenantCurrency } from "@infulancer/core/creative/tenant";
import { EDIT_ACTIONS, EDIT_LABEL, pipelineJobs, type EditAction } from "@infulancer/core/creative/edit";
import { requireApiActor } from "@/lib/auth-guard";
import { ownTenant } from "@/lib/creative-tenant";
import { modelName } from "@/lib/creative-models";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const labelFor = (modelKey: string) => {
  const a = (Object.keys(EDIT_ACTIONS) as EditAction[]).find((k) => EDIT_ACTIONS[k].modelKey === modelKey);
  return a ? EDIT_LABEL[a] : modelName(modelKey);
};
/**
 * Üretim/düzenleme ilerlemesi (yalnız kendi hesabının işi). Zincirli düzenlemede tüm adımlar ve
 * henüz başlamamış adımlar döner. Başarısız adımda bloke iade edildiği için refunded=true.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActor("ADMIN", "BRAND", "INFLUENCER");
  if (auth.response) return auth.response;
  const { id } = await params;
  const root = await prisma.creativeJob.findUnique({ where: { id } });
  if (!root || root.tenantId !== ownTenant(auth.actor)) return Response.json({ error: "Bulunamadı." }, { status: 404 });
  const jobs = await pipelineJobs(root.parentJobId ?? root.id);
  const holds = await prisma.creditHold.findMany({ where: { id: { in: jobs.map((j) => j.creditHoldId).filter((x): x is string => !!x) } }, select: { id: true, credits: true, status: true } });
  const holdOf = new Map(holds.map((h) => [h.id, h]));
  const assets = await prisma.generatedAsset.findMany({ where: { jobId: { in: jobs.map((j) => j.id) } }, select: { id: true, jobId: true } });
  const assetOf = new Map(assets.map((a) => [a.jobId, a.id]));
  const last = jobs[jobs.length - 1]!;
  const pending = Array.isArray(last.pipeline) ? (last.pipeline as { action: EditAction }[]) : [];
  const steps = [
    ...jobs.map((j) => {
      const h = j.creditHoldId ? holdOf.get(j.creditHoldId) : undefined;
      return {
        id: j.id,
        label: labelFor(j.modelKey),
        status: j.status,
        error: j.status === "FAILED" || j.status === "REJECTED" ? j.rejectReason : null,
        amount: h ? Number(h.credits) : null,
        charged: h?.status === "charged",
        refunded: h?.status === "released",
        assetId: assetOf.get(j.id) ?? null,
      };
    }),
    ...pending.map((p, i) => ({ id: `bekliyor-${i}`, label: EDIT_LABEL[p.action] ?? p.action, status: "WAITING", error: null, amount: null, charged: false, refunded: false, assetId: null })),
  ];
  const failed = steps.some((s) => s.status === "FAILED" || s.status === "REJECTED");
  const done = !failed && pending.length === 0 && last.status === "COMPLETED";
  // Webhook gecikirse fal kuyruğunu sorgulayarak sonuçlandır (bloke takılı kalmasın).
  if (!done && !failed) void reconcileStaleJobs({ olderThanMs: 60_000 }).catch(() => {});
  return Response.json(
    { currency: await tenantCurrency(root.tenantId), done, failed, steps, finalAssetId: done ? (assetOf.get(last.id) ?? null) : null, chainError: root.rejectReason && root.status === "COMPLETED" ? root.rejectReason : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
