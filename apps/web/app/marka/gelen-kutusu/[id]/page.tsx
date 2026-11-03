import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { composerMode, minutesLeft } from "@infulancer/core/messaging/windows";
import { canUseTemplate } from "@infulancer/core/messaging/templates";
import { tiktokDmNotice } from "@infulancer/core/tiktok/index";
import { Composer, ConversationActions } from "@/components/inbox/inbox-forms";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Konuşma" };
export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor("BRAND");
  const { id } = await params;
  const conv = await prisma.conversation.findFirst({
    where: { id, tenantId: actor.brandId! },
    include: { contact: true, messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  if (!conv) notFound();
  const now = new Date();
  const mode = composerMode(conv.channel, conv, now, true);
  const templates = (await prisma.messageTemplate.findMany({ where: { tenantId: actor.brandId! } })).filter((t) => canUseTemplate(t, now).ok);
  const left = minutesLeft(conv.serviceWindowExpiresAt, now);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={conv.contact.name ?? conv.contact.phoneE164 ?? "Konuşma"}
        description={`${conv.channel} · servis penceresi ${left && left > 0 ? `${left} dk sonra kapanıyor` : "kapalı"}`}
        actions={<ConversationActions conversationId={conv.id} status={conv.status} />}
      />
      <Card interactive={false} className="flex flex-col gap-3">
        <ol className="flex flex-col gap-3" aria-label="Mesajlar">
          {conv.messages.map((m) => (
            <li key={m.id} className={m.direction === "OUTBOUND" ? "self-end text-right" : "self-start"}>
              <p className={`inline-block max-w-md rounded-2xl px-4 py-2 text-sm ${m.direction === "OUTBOUND" ? "bg-fg text-bg" : "border border-border"}`}>{m.body ?? (m.templateId ? "[template]" : "[medya]")}</p>
              <p className="mt-1 text-[11px] text-fg-passive">
                {fmtDateTime(m.createdAt)}
                {m.fromAi ? " · AI" : ""}
                {m.status ? ` · ${m.status}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </Card>
      {conv.channel === "TIKTOK" ? (
        <InfoNote>{tiktokDmNotice}</InfoNote>
      ) : (
        <Composer conversationId={conv.id} mode={mode.mode} reason={"reason" in mode ? mode.reason : undefined} templates={templates.map((t) => ({ id: t.id, name: t.name, category: t.category }))} />
      )}
    </div>
  );
}
