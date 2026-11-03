import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { adPenaltyCopy } from "@infulancer/core/compliance/disclosure";
import { iysPenaltyBands } from "@infulancer/core/compliance/iys";
import { TRANSFER_TARGETS } from "@infulancer/core/compliance/kvkk";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { PageGuide } from "@/components/ui/page-guide";
import { RunJobButton } from "@/components/forms/operations-forms";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Uyum" };

export default async function AdminCompliancePage() {
  await requireActor("ADMIN");
  const now = new Date();
  const [pending, consents, filings, settings, flags, brands, checks] = await Promise.all([
    prisma.consentEvent.findMany({ where: { processedAt: null }, include: { consent: true }, orderBy: { dueAt: "asc" }, take: 100 }),
    prisma.consent.groupBy({ by: ["tenantId", "state"], _count: true }),
    prisma.crossBorderFiling.findMany(),
    prisma.tenantSettings.findMany(),
    prisma.tenantPolicyFlag.findMany(),
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.disclosureCheck.findMany({ where: { compliant: false }, orderBy: { checkedAt: "desc" }, take: 50 }),
  ]);
  const name = new Map(brands.map((b) => [b.id, b.name]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Uyum"
        description="İYS onay kapısı, KVKK yurt dışı aktarım bildirimleri, md. 23/A reklam açıklaması ve politika bayrakları."
        actions={
          <div className="flex gap-2">
            <RunJobButton job="iys-register" label="İYS kuyruğunu şimdi gönder" />
            <RunJobButton job="iys-sla" label="Süre kontrolü" />
          </div>
        }
      />
      <PageGuide
        what="Yasal yükümlülüklerin tek ekranı. Sistem bu kuralları sert blok olarak uygular: İYS onayı olmayan kişiye kampanya mesajı gitmez, “Reklam/Tanıtım” etiketi olmayan içerikle kampanya yayına alınmaz, KVKK makbuzu yüklenmeyen marka canlı moda geçemez."
        why="Bu sayfa bloklananları, süresi yaklaşan kayıtları ve eksik bildirimleri gösterir; cezalar alıcı/içerik başına uygulanır."
        steps={[
          { label: "Tüm onay kayıtları 3 iş günü içinde İYS’ye iletildi", done: pending.length === 0, hint: `${pending.length} kayıt bekliyor` },
          { label: "Tüm markaların KVKK bildirim makbuzu yüklendi", done: settings.length > 0 && settings.every((s) => TRANSFER_TARGETS.every((t) => filings.some((f) => f.tenantId === s.tenantId && f.transferTarget === t.key && f.receiptS3Key))), hint: "Marka panelinde Uyum sayfasından yüklenir" },
          { label: "md. 23/A uyumsuz içerik yok", done: checks.length === 0, hint: `${checks.length} uyumsuz kare/içerik` },
          { label: "Engelleyici politika bayrağı yok", done: !flags.some((f) => f.blocking), hint: "Yasaklı dikey beyanı olan markaların gönderimi durur" },
        ]}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>İYS kuyruğu (3 iş günü SLA)</CardTitle>
          {pending.length === 0 ? (
            <p className="text-sm text-fg-passive">Bekleyen kayıt yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {pending.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {name.get(e.consent.tenantId)} · {e.consent.recipient} · {e.consent.state}
                  </span>
                  <StatusDot tone={e.dueAt <= now ? "critical" : "muted"}>Son tarih {fmtDateTime(e.dueAt)}</StatusDot>
                  {e.lastError ? <span className="w-full text-[13px] text-critical">{e.lastError}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Onay durumu (marka bazında)</CardTitle>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {consents.map((c) => (
              <li key={`${c.tenantId}-${c.state}`} className="flex justify-between py-2">
                <span>{name.get(c.tenantId)}</span>
                <span className="tabular-nums">
                  {c.state}: {c._count}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-fg-muted">RET kayıtları terminaldir: panelden, CSV ile veya doğrudan veritabanında silinemez ya da üzerine yazılamaz. Delil kayıtları 10 yıl saklanır.</p>
        </Card>
      </section>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>6563 md. 12 ceza bantları (2026, alıcı başına)</CardTitle>
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {iysPenaltyBands.map((b) => (
            <li key={b.label} className="flex justify-between gap-3 border-b border-border py-2">
              <span>{b.label}</span>
              <span className="tabular-nums text-fg-muted">{b.range}</span>
            </li>
          ))}
        </ul>
        <InfoNote>Cezalar alıcı başına uygulanır: 50.000 alıcılı onaysız bir kampanya küçük bir şirket için varoluşsal risktir. (Toplu gönderimde 10× çarpan iddiası doğrulanmadı.)</InfoNote>
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>KVKK standart sözleşme bildirimleri</CardTitle>
        <ul className="flex flex-col divide-y divide-border text-sm">
          {settings.map((s) => {
            const fs = filings.filter((f) => f.tenantId === s.tenantId);
            return (
              <li key={s.tenantId} className="flex flex-col gap-1 py-3">
                <span className="flex justify-between">
                  <span>{name.get(s.tenantId)}</span>
                  <StatusDot tone={s.mode === "production" ? "active" : "muted"}>{s.mode === "production" ? "Canlı" : "Sandbox"}</StatusDot>
                </span>
                {TRANSFER_TARGETS.map((t) => {
                  const f = fs.find((x) => x.transferTarget === t.key);
                  return (
                    <span key={t.key} className="text-[13px] text-fg-muted">
                      {t.label}: {f?.receiptS3Key ? "makbuz yüklendi" : f ? `bekleniyor (son tarih ${fmtDateTime(f.dueAt)})` : "sözleşme imzalanmadı"}
                    </span>
                  );
                })}
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-fg-muted">Bildirmeme cezası 90.308 – 1.806.377 TL. Makbuz yüklenmeden marka canlı moda geçemez.</p>
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>md. 23/A — uyumsuz içerikler</CardTitle>
        {checks.length === 0 ? (
          <p className="text-sm text-fg-passive">Uyumsuz içerik yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {checks.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 py-2">
                <a className="underline-offset-4 hover:underline" href={`/admin/teslimler/${c.deliverableId}`}>
                  İçerik {c.deliverableId.slice(-6)} · kare {c.frameIndex + 1}
                </a>
                <span className="text-[13px] text-fg-muted">{c.issues.join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
        <InfoNote>
          Reklam ihlali cezası {adPenaltyCopy.range}. {adPenaltyCopy.example} {adPenaltyCopy.note}
        </InfoNote>
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Politika bayrakları</CardTitle>
        {flags.length === 0 ? (
          <p className="text-sm text-fg-passive">Bayrak yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {flags.map((f) => (
              <li key={f.id} className="flex justify-between py-2">
                <span>
                  {name.get(f.tenantId)} · {f.detail ?? f.flag}
                </span>
                <StatusDot tone={f.blocking ? "critical" : "muted"}>{f.blocking ? "Gönderim engelli" : "Kısıtlı dikey"}</StatusDot>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
