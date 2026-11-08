"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { ExternalIcon, PencilIcon } from "@/components/icons";
import { Input } from "@/components/ui/form";
import { updatePostUrl } from "@/lib/actions/post-url";

/** Paylaşım bağlantısı: göster + kalem ikonuyla düzenle (yayından sonra). */
export function PostUrlForm({ deliverableId, current, editable }: { deliverableId: string; current: string | null; editable: boolean }) {
  const tt = useTT();
  const [edit, setEdit] = useState(false);
  if (!edit)
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {current ? (
          <a href={current} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[260px] items-center gap-1 truncate text-fg hover:underline">
            {current.replace(/^https:\/\/(www\.)?/, "")} <ExternalIcon size={12} />
            <span className="sr-only">{tt("(yeni sekmede açılır)")}</span>
          </a>
        ) : (
          <span className="text-fg-passive">{tt("Henüz eklenmedi")}</span>
        )}
        {editable ? (
          <button type="button" onClick={() => setEdit(true)} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[12px] text-fg-muted hover:border-neon-pink hover:text-fg">
            <PencilIcon size={12} /> {current ? tt("Düzenle") : tt("Ekle")}
          </button>
        ) : null}
      </span>
    );
  return (
    <ActionForm action={updatePostUrl} submitLabel={tt("Kaydet")} submitSize="sm" onSuccess={() => setEdit(false)} aria-label={tt("Paylaşım bağlantısı")} className="gap-2">
      <input type="hidden" name="id" value={deliverableId} />
      <Input name="postUrl" type="url" required defaultValue={current ?? ""} placeholder="https://www.instagram.com/reel/…" aria-label={tt("Paylaşım bağlantısı")} autoFocus />
      <Input name="note" maxLength={500} placeholder={tt("Not (isteğe bağlı)")} aria-label={tt("Not")} />
      <button type="button" onClick={() => setEdit(false)} className="w-fit text-[12px] text-fg-muted hover:text-fg">{tt("Vazgeç")}</button>
    </ActionForm>
  );
}
