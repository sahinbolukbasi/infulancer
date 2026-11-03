import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { freeTierStatus } from "@infulancer/core/messaging/cost";
import { qualityLabel, statusLabel } from "@infulancer/core/messaging/templates";
import { tierCapacity } from "@infulancer/core/messaging/tiers";
import { EMBEDDED_SIGNUP_VERSION } from "@infulancer/core/channels/onboarding";
import { tiktokDmNotice } from "@infulancer/core/tiktok/index";
import { UNVERIFIED_FACTS } from "@infulancer/core/unverified";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote, UnverifiedBadge } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Kanallar" };

const num = new Intl.NumberFormat("tr-TR");

export default async function AdminChannelsPage() {
  await requireActor("ADMIN");
  const [connections, numbers, templates, brands] = await Promise.all([
    prisma.channelConnection.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.whatsAppNumber.findMany(),
    prisma.messageTemplate.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
  ]);
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const quotas = await Promise.all(numbers.map(async (n) => ({ n, q: await freeTierStatus(n.phoneNumberId) })));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Kanallar" description={`WhatsApp (Embedded Signup ${EMBEDDED_SIGNUP_VERSION}), Instagram ve Messenger bağlantıları, template sağlığı ve mesaj kotası.`} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="WhatsApp numaraları">
        {quotas.map(({ n, q }) => (
          <Card key={n.id} interactive={false} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{brandName.get(n.tenantId) ?? n.tenantId}</CardTitle>
              <StatusDot tone={n.paymentMethod === "payment_method_confirmed" ? "active" : "critical"}>
                {n.paymentMethod === "payment_method_confirmed" ? "Onboarding tamam" : "Ödeme yöntemi bekleniyor"}
              </StatusDot>
            </div>
            <p className="text-sm text-fg-muted">{n.displayNumber ?? n.phoneNumberId}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-fg-muted">Mesaj limiti (portföy)</dt>
                <dd className="tabular-nums">
                  {n.messagingLimit} · {Number.isFinite(tierCapacity(n.messagingLimit)) ? `${num.format(tierCapacity(n.messagingLimit))} tekil alıcı / 24 sa` : "sınırsız"}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">Ücretsiz servis mesajı (bu ay)</dt>
                <dd className="tabular-nums">
                  {num.format(q.remaining)} / {num.format(q.free)} kaldı{q.exhaustAt ? ` · tahmini bitiş ${fmtDate(q.exhaustAt)}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">Kalite</dt>
                <dd>{n.qualityRating ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">
                  Throughput
                  <UnverifiedBadge title={UNVERIFIED_FACTS.waThroughput} />
                </dt>
                <dd>{n.throughputLevel ?? "Meta bildirimi bekleniyor"}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </section>
      <InfoNote>
        Messaging limiti business portfolio düzeyindedir ve portföydeki tüm numaralar arasında paylaşılır; numara eklemek kapasite eklemez. Ücretsiz 1.000 servis mesajı numara
        başınadır ve numaralar arasında paylaşılmaz — bu yüzden her markaya ayrı numara bağlanır.
      </InfoNote>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Bağlantılar</CardTitle>
        <ul className="flex flex-col divide-y divide-border text-sm">
          {connections.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                {brandName.get(c.tenantId) ?? c.tenantId} · {c.provider}
              </span>
              <span className="text-fg-muted">
                Son doğrulama: {c.lastVerifiedAt ? fmtDateTime(c.lastVerifiedAt) : "—"}
                {c.lastError ? ` · ${c.lastError}` : ""}
              </span>
              <StatusDot tone={c.status === "ACTIVE" ? "active" : c.status === "REVOKED" ? "critical" : "muted"}>{c.status}</StatusDot>
            </li>
          ))}
        </ul>
      </Card>

      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Template’ler</CardTitle>
        <p className="text-[13px] text-fg-muted">
          Kalite Orta olunca gönderim hızı %50’ye kısılır; Düşük olunca gönderim otomatik durur. 1. duraklatma 3 saat, 2. duraklatma 6 saat; 3. duraklatmada template devre dışı kalır.
        </p>
        <table className="w-full text-sm">
          <caption className="sr-only">Template durumu ve kalitesi</caption>
          <thead>
            <tr className="border-b border-border text-left text-fg-muted">
              <th className="py-2 font-normal">Marka</th>
              <th className="py-2 font-normal">Template</th>
              <th className="py-2 font-normal">Kategori</th>
              <th className="py-2 font-normal">Durum</th>
              <th className="py-2 font-normal">Kalite</th>
              <th className="py-2 font-normal">Hız</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-border">
                <td className="py-2">{brandName.get(t.tenantId)}</td>
                <td className="py-2">{t.name}</td>
                <td className="py-2">{t.containsPromotion && t.category !== "marketing" ? `${t.category} (promosyon → ticari)` : t.category}</td>
                <td className="py-2">{statusLabel[t.status]}</td>
                <td className="py-2">
                  <StatusDot tone={t.quality === "LOW" ? "critical" : t.quality === "MEDIUM" ? "muted" : "active"}>{qualityLabel[t.quality]}</StatusDot>
                </td>
                <td className="py-2 tabular-nums">%{Math.round(Number(t.sendRateFactor) * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Kanal kısıtları</CardTitle>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-fg-muted">
          <li>Meta ailesinde 24 saat dışına çıkabilen tek uyumlu giden kanal onaylı WhatsApp template’idir. Instagram’dan toplu duyuru gönderilemez.</li>
          <li>Messenger/Instagram’da 24 saat sonrası yalnız temsilci yanıtı (HUMAN_AGENT, 7 gün) mümkündür; promosyon, drip veya sepet hatırlatma yapılamaz.</li>
          <li>{tiktokDmNotice}</li>
          <li>
            {UNVERIFIED_FACTS.igRateLimits} <UnverifiedBadge />
          </li>
          <li>
            {UNVERIFIED_FACTS.tiktokRateLimits} <UnverifiedBadge />
          </li>
          <li>
            {UNVERIFIED_FACTS.appReviewDuration} <UnverifiedBadge />
          </li>
          <li>Meta fiyat değişiklikleri yalnız 1 Ocak, 1 Nisan, 1 Temmuz ve 1 Ekim’de yürürlüğe girer (tarife kartı için 1 ay, fiyat modeli eki için 3 ay, model değişikliği için 6 ay önceden bildirim).</li>
        </ul>
      </Card>
    </div>
  );
}
