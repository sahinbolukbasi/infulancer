"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useActionState } from "react";
import { startTransition } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { CopyCode } from "@/components/wallet/copy-code";
import { ExternalIcon, XIcon } from "@/components/icons";
import { createShortLinkAction, deleteShortLinkAction } from "@/lib/actions/notify-admin";
import { idleState } from "@/lib/action-state";
import { fmtDateTime } from "@/lib/time";

export type ShortLinkRow = { id: string; slug: string; shortUrl: string; targetUrl: string; label: string | null; clicks: number; lastClickAt: Date | null; createdAt: Date };

/** Kısa link kısaltma formu (büyük hedef + etiket). */
export function ShortLinkCreate() {
  const tt = useTT();
  return (
    <ActionForm action={createShortLinkAction} submitLabel={tt("Linki kısalt")} resetOnSuccess aria-label={tt("Link kısalt")}>
      <Field label={tt("Hedef URL")} hint={tt("Takip etmek istediğiniz tam bağlantı (https://…)")}>
        {(p) => <Input {...p} name="url" required placeholder="https://nordvow.com/kampanya/yaz-indirimi" />}
      </Field>
      <Field label={tt("Etiket (opsiyonel)")} hint={tt("Listede tanımak için kısa bir ad")}>
        {(p) => <Input {...p} name="label" placeholder={tt("Yaz kampanyası – Instagram")} />}
      </Field>
    </ActionForm>
  );
}

function DeleteLink({ id }: { id: string }) {
  const tt = useTT();
  const [, action, pending] = useActionState(deleteShortLinkAction, idleState);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", id);
        startTransition(() => action(fd));
      }}
      aria-label={tt("Linki sil")}
      title={tt("Sil")}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-standard hover:bg-red-500/10 hover:text-critical disabled:opacity-40"
    >
      <XIcon size={16} />
    </button>
  );
}

/** Kısa link listesi: kopyalanabilir kısa URL, tıklama ve son tıklama, hedefi aç, sil. */
export function ShortLinkList({ links }: { links: ShortLinkRow[] }) {
  const tt = useTT();
  if (!links.length) {
    return <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-muted">{tt("Henüz kısa link yok. Yukarıdan bir bağlantı kısaltın; her tıklama burada sayılır.")}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {links.map((l) => (
        <li key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] text-fg">/l/{l.slug}</span>
              <CopyCode code={l.shortUrl} tone="app" size="sm" />
            </div>
            <span className="truncate text-[12px] text-fg-muted">
              {l.label ? <span className="text-fg">{l.label}</span> : null}
              {l.label ? " · " : ""}
              {l.targetUrl}
            </span>
            <span className="text-[11px] text-fg-passive">{tt("Oluşturuldu")}{" "}{fmtDateTime(l.createdAt)}
              {l.lastClickAt ? ` · son tıklama ${fmtDateTime(l.lastClickAt)}` : tt(" · henüz tıklanmadı")}
            </span>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-center">
            <span className="flex flex-col items-end leading-tight">
              <span className="text-lg font-semibold tabular-nums text-fg">{l.clicks}</span>
              <span className="text-[11px] text-fg-passive">{tt("tıklama")}</span>
            </span>
            <a href={l.targetUrl} target="_blank" rel="noreferrer" aria-label={tt("Hedefi aç")} title={tt("Hedefi aç")} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg">
              <ExternalIcon size={16} />
            </a>
            <DeleteLink id={l.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
