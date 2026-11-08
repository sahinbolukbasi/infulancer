"use client";
import { useEffect, useRef, useState } from "react";
import { PhonePreview } from "./phone-preview";
/** Galeri kartından: içeriği Instagram/TikTok/YouTube telefon şablonlarında aç. */
export function PhonePreviewButton({ src, kind, caption, username }: { src: string; kind: "image" | "video"; caption?: string; username?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg hover:border-fg/40">
        📱 Önizle
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-label="Telefonda önizleme" className="m-auto rounded-3xl border border-line bg-surface p-5 text-fg backdrop:bg-black/60">
        {open ? <PhonePreview src={src} kind={kind} caption={caption} username={username} /> : null}
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-fg px-4 py-1.5 text-[13px] font-semibold text-bg">
            Kapat
          </button>
        </div>
      </dialog>
    </>
  );
}
