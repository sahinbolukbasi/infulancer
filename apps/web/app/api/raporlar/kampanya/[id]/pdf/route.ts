import { loadBrandCampaignReport } from "@infulancer/core/access/brand-report";
import { isDomainError } from "@infulancer/core/domain/errors";
import { requireApiActor } from "@/lib/auth-guard";
import { renderCampaignReportPdf } from "@/lib/pdf/campaign-report";
import { jsonError } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kampanya raporu PDF (ADMIN veya kampanyanın markası). Başka markanın kampanyası → 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActor("ADMIN", "BRAND");
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!id || id.length > 64) return jsonError(404, "Kampanya bulunamadı.");

  let report;
  try {
    report = await loadBrandCampaignReport(auth.actor, id);
  } catch (err) {
    if (isDomainError(err) && (err.code === "BULUNAMADI" || err.code === "YETKISIZ")) {
      return jsonError(404, "Kampanya bulunamadı.");
    }
    throw err;
  }

  const pdf = await renderCampaignReportPdf(report);
  const day = new Date().toISOString().slice(0, 10);
  const fileName = `${report.campaign.slug}-rapor-${day}.pdf`;
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]/g, "_")}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    },
  });
}
