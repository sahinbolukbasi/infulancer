import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { handoffReasonLabels, type HandoffReason } from "@infulancer/core/assistant/runtime";
import { AssistantForm } from "@/components/agent/agent-forms";
import { KnowledgeForm } from "@/components/inbox/inbox-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { assistantsFor } from "@/lib/assistants";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Asistanlar" };
export const dynamic = "force-dynamic";

/** Markanın sohbet asistanları: ne yapar, ne kadar konuşma çözdü, neden aktardı, ayarlar ve bilgi tabanı. */
export default async function BrandAssistantsPage() {
  const actor = await requireActor("BRAND");
  const t = actor.brandId!;
  const [items, sources, chunks] = await Promise.all([
    assistantsFor(t),
    prisma.knowledgeSource.findMany({ where: { tenantId: t, type: { not: "message" } }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.knowledgeChunk.count({ where: { tenantId: t } }),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Asistanlar" description="WhatsApp ve Instagram’da müşterilerinize otomatik cevap veren yapay zekâ asistanları. Her asistan yalnız sizin bilgi tabanınızı kullanır." />
      <InfoNote>
        Nasıl çalışır: Müşteri yazar → asistan bilgi tabanınızda cevap arar → güven eşiğinin üstündeyse cevaplar, değilse (veya müşteri temsilci isterse, şikâyet/hassas konu varsa) konuşmayı
        Gelen kutusu’ndaki bir temsilciye aktarır. Aktarılan konuşmalar için AI ücreti alınmaz.
      </InfoNote>

      <section className="flex flex-col gap-4" aria-label="Asistanlar">
        {items.map((a) => (
          <Card key={a.template.key} interactive={false} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>{a.template.name}</CardTitle>
                <p className="max-w-2xl text-[13px] text-fg-muted">{a.template.description}</p>
              </div>
              <StatusDot tone={a.values.enabled ? "active" : "passive"}>{a.values.enabled ? "Açık" : a.configured ? "Kapalı" : "Kurulmadı"}</StatusDot>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <span>
                <span className="text-fg-muted">Son 30 gün çözülen: </span>
                <span className="tabular-nums">{a.handled}</span>
              </span>
              <span className="text-fg-muted">
                Aktarma nedenleri: {a.handoffs.length ? a.handoffs.map((h) => `${handoffReasonLabels[h.reason as HandoffReason] ?? h.reason} (${h.count})`).join(", ") : "—"}
              </span>
            </div>
            <details className="rounded-[8px] border border-border" open={!a.configured && a.template.key === "brand_faq"}>
              <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">{a.configured ? "Ayarları düzenle" : "Kur ve aç"}</summary>
              <div className="border-t border-border p-4">
                <AssistantForm values={a.values} />
              </div>
            </details>
          </Card>
        ))}
      </section>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Bilgi tabanı</CardTitle>
        <p className="text-[13px] text-fg-muted">
          Asistanların cevaplarken kullandığı tek kaynak. Kargo, iade, stok, mağaza saatleri, fiyatlar gibi bilgileri ekleyin. {sources.length} kaynak · {chunks} bilgi parçası.
        </p>
        {sources.length ? (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>{s.uri.replace(/^manual:\/\//, "")}</span>
                <span className="text-fg-muted">{fmtDate(s.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <KnowledgeForm />
      </Card>
    </div>
  );
}
