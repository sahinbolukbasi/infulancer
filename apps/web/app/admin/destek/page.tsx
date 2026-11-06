import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { SUPPORT_EMAIL, supportCategoryLabel, supportStatusLabel, type SupportCategory, type SupportStatus } from "@infulancer/core/support/service";
import { PageHeader } from "@/components/ui/layout";
import { FilterTabs, Pill, StatStrip, type PillTone } from "@/components/luma/primitives";
import { SupportTicketUpdate } from "@/components/support/support-admin-forms";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Destek talepleri" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<SupportStatus, PillTone> = { ACIK: "amber", INCELEMEDE: "violet", COZULDU: "green", KAPANDI: "gray" };
const CAT_TONE: Record<SupportCategory, PillTone> = { HATA: "red", SORU: "violet", ISTEK: "green", DIGER: "gray" };
const FILTERS: { id: string; label: string }[] = [
  { id: "acik", label: "Açık" },
  { id: "incelemede", label: "İncelemede" },
  { id: "cozuldu", label: "Çözüldü" },
  { id: "kapandi", label: "Kapandı" },
  { id: "tumu", label: "Tümü" },
];
const FILTER_STATUS: Record<string, SupportStatus | undefined> = { acik: "ACIK", incelemede: "INCELEMEDE", cozuldu: "COZULDU", kapandi: "KAPANDI", tumu: undefined };

/** Yönetici destek gelen kutusu: talepleri görüntüle, durum ve not güncelle. */
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  await requireActor("ADMIN");
  const { filtre } = await searchParams;
  const active = FILTERS.some((f) => f.id === filtre) ? filtre! : "acik";
  const tickets = await prisma.supportTicket.findMany({ orderBy: { createdAt: "desc" }, take: 400 });
  const counts = {
    acik: tickets.filter((t) => t.status === "ACIK").length,
    incelemede: tickets.filter((t) => t.status === "INCELEMEDE").length,
    cozuldu: tickets.filter((t) => t.status === "COZULDU").length,
    kapandi: tickets.filter((t) => t.status === "KAPANDI").length,
    tumu: tickets.length,
  };
  const wanted = FILTER_STATUS[active];
  const list = wanted ? tickets.filter((t) => t.status === wanted) : tickets;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Destek talepleri" description={`Kullanıcı hata bildirimi, soru ve istekleri. Doğrudan e-posta: ${SUPPORT_EMAIL}`} />
      {tickets.length ? (
        <StatStrip
          stats={[
            { label: "Açık", value: String(counts.acik) },
            { label: "İncelemede", value: String(counts.incelemede) },
            { label: "Çözüldü", value: String(counts.cozuldu) },
            { label: "Kapandı", value: String(counts.kapandi) },
            { label: "Toplam", value: String(counts.tumu) },
            { label: "Hata bildirimi", value: String(tickets.filter((t) => t.category === "HATA").length) },
          ]}
        />
      ) : null}
      <FilterTabs active={active} items={FILTERS.map((f) => ({ id: f.id, label: f.label, href: `/admin/destek?filtre=${f.id}`, count: counts[f.id as keyof typeof counts] }))} />
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-medium text-fg">{tickets.length ? "Bu görünümde talep yok" : "Henüz destek talebi yok"}</p>
          <p className="max-w-sm text-[13px] text-fg-muted">Kullanıcıların /destek sayfasından gönderdiği talepler burada toplanır.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={CAT_TONE[t.category]}>{supportCategoryLabel[t.category]}</Pill>
                    <Pill tone={STATUS_TONE[t.status]}>{supportStatusLabel[t.status]}</Pill>
                    <span className="text-[12px] text-fg-passive">{fmtDateTime(t.createdAt)}</span>
                  </div>
                  <span className="text-[16px] font-semibold text-fg">{t.subject}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
                    {t.name}
                    <a href={`mailto:${t.email}`} className="underline-offset-4 hover:text-fg hover:underline">{t.email}</a>
                    {t.role ? <span className="text-fg-passive">· {t.role}</span> : null}
                  </span>
                </div>
              </div>
              <p className="whitespace-pre-line rounded-xl bg-bg/40 p-3 text-[14px] text-fg">{t.message}</p>
              {t.pageUrl ? (
                <p className="truncate text-[12px] text-fg-passive">
                  İlgili sayfa:{" "}
                  <a href={t.pageUrl} className="underline-offset-4 hover:text-fg hover:underline" target="_blank" rel="noreferrer">
                    {t.pageUrl}
                  </a>
                </p>
              ) : null}
              <div className="border-t border-line pt-3">
                <SupportTicketUpdate id={t.id} status={t.status} adminNote={t.adminNote} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
