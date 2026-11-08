import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import Link from "next/link";
import { listInbox, instagramInboxNotes } from "@infulancer/core/messaging/inbox";
import { isOpen, minutesLeft } from "@infulancer/core/messaging/windows";
import { handoffReasonLabels, type HandoffReason } from "@infulancer/core/assistant/runtime";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot } from "@/components/ui/status";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Gelen kutusu" };
export const dynamic = "force-dynamic";

const statusLabels = { open: "Açık", awaiting_human: "Temsilci bekliyor", assigned: "Temsilcide", closed: "Kapalı" } as const;

function countdown(min: number | null) {
  if (min == null) return "—";
  if (min <= 0) return "Kapandı";
  const h = Math.floor(min / 60);
  return h ? `${h} sa ${min % 60} dk` : `${min} dk`;
}

export default async function InboxPage() {
  const tt = await getTT();
  const actor = await requireActor("BRAND");
  const now = new Date();
  const list = await listInbox(actor.brandId!);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tt("Gelen kutusu")} description={tt("WhatsApp, Instagram ve Messenger konuşmaları. Pencere kapandıktan sonra yanıt yalnız ücretli onaylı template ile mümkündür.")} />
      {list.length === 0 ? (
        <EmptyState message={tt("Henüz konuşma yok.")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((c) => {
            const min = minutesLeft(c.serviceWindowExpiresAt, now);
            const fep = isOpen(c.fepWindowExpiresAt, now);
            return (
              <li key={c.id}>
                <Link href={`/marka/gelen-kutusu/${c.id}`} className="block">
                  <Card className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{c.contact.name ?? c.contact.phoneE164 ?? c.contact.externalId}</span>
                      <span className="text-[13px] text-fg-muted">{c.channel}</span>
                    </div>
                    <p className="line-clamp-1 text-sm text-fg-muted">{c.messages[0]?.body ?? "—"}</p>
                    <div className="flex flex-wrap gap-4 text-[13px]">
                      <StatusDot tone={c.status === "awaiting_human" ? "critical" : c.status === "closed" ? "passive" : "active"}>
                        {statusLabels[c.status]}
                        {c.handoffReason ? ` · ${handoffReasonLabels[c.handoffReason as HandoffReason] ?? c.handoffReason}` : ""}
                      </StatusDot>
                      <span className={min != null && min > 0 && min <= 15 ? "text-critical" : "text-fg-muted"} aria-label={tt("Servis penceresi kalan süre")}>{tt("Pencere:")}{" "}{countdown(min)}
                      </span>
                      {fep ? <span className="text-fg">{tt("Reklam trafiği · 7 gün ücretsiz konuşma (kalan")}{" "}{countdown(minutesLeft(c.fepWindowExpiresAt, now))})</span> : null}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <InfoNote>{tt("Instagram notları:")}{" "}{instagramInboxNotes.join(" ")}
      </InfoNote>
    </div>
  );
}
