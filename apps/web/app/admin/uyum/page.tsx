import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { iysPenaltyBands } from "@infulancer/core/compliance/iys";
import { TRANSFER_TARGETS } from "@infulancer/core/compliance/kvkk";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { requireActor } from "@/lib/auth-guard";
import { DocLink } from "@/components/docs/doc-components";
import { StatusCards } from "@/components/ui/status-cards";
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
  const kvkkMissing = settings.filter((st) => !TRANSFER_TARGETS.every((t) => filings.some((f) => f.tenantId === st.tenantId && f.transferTarget === t.key && f.receiptS3Key))).length;
  const kvkkOk = settings.length > 0 && kvkkMissing === 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Uyum"
        description="Dört kart yeşilse tüm markalar yasal olarak hazır."
        actions={
          <div className="flex gap-2">
            <RunJobButton job="iys-register" label="İYS kuyruğunu şimdi gönder" />
            <RunJobButton job="iys-sla" label="Süre kontrolü" />
          </div>
        }
      />
      <StatusCards
        items={[
          { title: "İYS kuyruğu", state: pending.length === 0 ? "ok" : pending.some((e) => e.dueAt < now) ? "bad" : "warn", value: `${pending.length} bekliyor`, text: "3 iş günü içinde İYS'ye iletilmeli.", href: "#iys", action: "Kuyruğu gör" },
          { title: "KVKK makbuzları", state: kvkkOk ? "ok" : "warn", value: kvkkOk ? "Tamam" : `${kvkkMissing} marka eksik`, text: "Makbuzsuz marka canlıya geçemez.", href: "#kvkk", action: "Eksikleri gör" },
          { title: "Reklam etiketi (23/A)", state: checks.length === 0 ? "ok" : "bad", value: `${checks.length} uyumsuz`, text: "Etiketsiz içerikle kampanya yayına alınmaz.", href: "#md23a", action: "İçerikleri gör" },
          { title: "Politika bayrakları", state: flags.some((f) => f.blocking) ? "bad" : "ok", value: `${flags.filter((f) => f.blocking).length} engelleyici`, text: "Yasaklı dikey beyanı gönderimi durdurur.", href: "#bayraklar", action: "Bayrakları gör" },
        ]}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card interactive={false} className="flex scroll-mt-24 flex-col gap-3" id="iys">
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
        <DocLink slug="iys-ticari-elektronik-ileti" />
      </Card>

      <Card interactive={false} className="flex scroll-mt-24 flex-col gap-3" id="kvkk">
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
        <DocLink slug="kvkk-yurtdisi-aktarim" />
      </Card>

      <Card interactive={false} className="flex scroll-mt-24 flex-col gap-3" id="md23a">
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
        <DocLink slug="reklam-aciklamasi-23a" />
      </Card>

      <Card interactive={false} className="flex scroll-mt-24 flex-col gap-3" id="bayraklar">
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
