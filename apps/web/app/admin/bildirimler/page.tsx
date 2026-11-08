import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { NOTIF_EVENTS } from "@infulancer/core/notify/catalog";
import { channelStatus } from "@infulancer/core/notify/channels";
import { envStr } from "@infulancer/core/env";
import { AnnouncementForm, RuleForm, ShortLinkForm, TemplateForm } from "@/components/notify/notify-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { StatusCards } from "@/components/ui/status-cards";
import { StatusDot } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Bildirimler" };
export const dynamic = "force-dynamic";
const chTr: Record<string, string> = { INAPP: "Sistem içi", EMAIL: "E-posta", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram" };
const stTr: Record<string, string> = { QUEUED: "Kuyrukta", SENT: "Gönderildi", MOCKED: "Mock", FAILED: "Hata", SKIPPED: "Atlandı" };

export default async function AdminNotificationsPage() {
  const tt = await getTT();
  await requireAdmin();
  const [rules, templates, logs, links] = await Promise.all([
    prisma.notificationRule.findMany(),
    prisma.notificationTemplate.findMany(),
    prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.shortLink.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const ch = channelStatus();
  const base = envStr("APP_URL", "").replace(/\/$/, "");
  const ruleMap = new Map(rules.map((r) => [r.eventKey, r]));
  const tplMap = new Map(templates.map((t) => [`${t.eventKey}:${t.channel}`, t]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("Bildirimler")} description={tt("Hangi olayda hangi kanaldan (sistem içi, e-posta, WhatsApp, Instagram) bildirim gideceğini ve şablonları yönetin.")} />
      <StatusCards
        items={[
          { title: "Sistem içi", state: "ok", value: "Aktif", text: "her zaman açık" },
          { title: "E-posta", state: ch.EMAIL ? "ok" : "warn", value: ch.EMAIL ? "Canlı" : "Mock", text: ch.EMAIL ? "gönderim açık" : "EMAIL_PROVIDER + doğrulanmış alan adı gerekir" },
          { title: "WhatsApp", state: ch.WHATSAPP ? "ok" : "warn", value: ch.WHATSAPP ? "Canlı" : "Mock", text: ch.WHATSAPP ? "gönderim açık" : "WHATSAPP_ACCESS_TOKEN gerekir" },
          { title: "Instagram", state: ch.INSTAGRAM ? "ok" : "warn", value: ch.INSTAGRAM ? "Canlı" : "Mock", text: ch.INSTAGRAM ? "gönderim açık" : "INSTAGRAM_ACCESS_TOKEN gerekir" },
        ]}
      />
      <Tabs
        label={tt("Bildirim bölümleri")}
        tabs={[
          {
            id: "kurallar",
            label: "Kurallar ve şablonlar",
            content: (
              <div className="flex flex-col gap-4">
                {NOTIF_EVENTS.map((e) => {
                  const rule = ruleMap.get(e.key);
                  const active = (rule?.channels as string[] | undefined) ?? e.defaultChannels;
                  return (
                    <Card key={e.key} interactive={false} className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle>{e.label}</CardTitle>
                        <code className="text-[11px] text-fg-passive">{e.key}</code>
                      </div>
                      <RuleForm eventKey={e.key} active={active} enabled={rule?.enabled ?? true} />
                      <details className="rounded-[8px] border border-border">
                        <summary className="cursor-pointer px-3 py-2 text-[13px] text-fg-muted hover:text-fg">{tt("Şablonları düzenle (")}{Object.keys(e.templates).length}{" "}{tt("kanal)")}</summary>
                        <div className="flex flex-col gap-4 border-t border-border p-3">
                          {(Object.keys(e.templates) as (keyof typeof e.templates)[]).map((channel) => {
                            const saved = tplMap.get(`${e.key}:${channel}`);
                            const def = e.templates[channel]!;
                            return (
                              <div key={channel} className="flex flex-col gap-1">
                                <span className="text-[12px] font-medium text-fg-muted">{chTr[channel]}</span>
                                <TemplateForm eventKey={e.key} channel={channel} subject={saved?.subject ?? def.subject ?? null} body={saved?.body ?? def.body} vars={e.vars} />
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </Card>
                  );
                })}
              </div>
            ),
          },
          {
            id: "duyuru",
            label: "Özel duyuru",
            content: (
              <Card interactive={false} className="flex flex-col gap-3">
                <CardTitle>{tt("Toplu duyuru gönder")}</CardTitle>
                <p className="text-[13px] text-fg-muted">{tt("Seçilen kitleye ANNOUNCEMENT olayının açık kanallarından duyuru gider.")}</p>
                <AnnouncementForm />
              </Card>
            ),
          },
          {
            id: "linkler",
            label: `Kısa linkler (${links.length})`,
            content: (
              <div className="flex flex-col gap-4">
                <Card interactive={false} className="flex flex-col gap-3">
                  <CardTitle>{tt("Link kısalt")}</CardTitle>
                  <ShortLinkForm />
                </Card>
                {links.length ? (
                  <Card interactive={false} className="flex flex-col gap-2">
                    <CardTitle>{tt("Linkler ve tıklamalar")}</CardTitle>
                    <ul className="flex flex-col divide-y divide-line text-sm">
                      {links.map((l) => (
                        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span className="flex min-w-0 flex-col">
                            <span className="font-mono text-[13px]">{base}/l/{l.slug}</span>
                            <span className="truncate text-[12px] text-fg-muted">{l.label ? `${l.label} · ` : ""}{l.targetUrl}</span>
                          </span>
                          <span className="tabular-nums text-[13px]">{l.clicks}{" "}{tt("tıklama")}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}
              </div>
            ),
          },
          {
            id: "log",
            label: "Gönderim kaydı",
            content: (
              <Card interactive={false} className="flex flex-col gap-2">
                <CardTitle>{tt("Son gönderimler")}</CardTitle>
                {logs.length === 0 ? (
                  <p className="text-sm text-fg-passive">{tt("Henüz gönderim yok.")}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line text-sm">
                    {logs.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="flex flex-col">
                          <span>{l.eventKey} · {chTr[l.channel]}</span>
                          <span className="text-[12px] text-fg-muted">{l.toAddress ?? tt("sistem içi")} · {fmtDateTime(l.createdAt)}</span>
                        </span>
                        <StatusDot tone={l.status === "SENT" ? "active" : l.status === "FAILED" ? "critical" : "muted"}>{stTr[l.status]}</StatusDot>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
