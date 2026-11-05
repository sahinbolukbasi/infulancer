"use client";
import { useRef, useState } from "react";

/**
 * Tek görsel yükleyici: seç → /api/media'ya presign ile yükle → gizli input'a key yaz.
 * Form gönderilince key sunucuya gider. 8 MB, JPEG/PNG/WebP.
 */
export function ImageUpload({ name, label, defaultKey }: { name: string; label: string; defaultKey?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState<string | null>(defaultKey ?? null);
  const [preview, setPreview] = useState<string | null>(defaultKey ? `/api/media/${defaultKey.replace(/^media\//, "")}` : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Dosya 8 MB'ı aşıyor.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPEG, PNG veya WebP seçin.");
      setPreview(URL.createObjectURL(file));
      const pres = await fetch("/api/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mime: file.type, size: file.size }) });
      const pj = await pres.json();
      if (!pres.ok) throw new Error(pj.error ?? "Hazırlık başarısız.");
      const put = await fetch(pj.url, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) throw new Error("Yükleme başarısız.");
      const conf = await fetch("/api/media", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: pj.key }) });
      const cj = await conf.json();
      if (!conf.ok) throw new Error(cj.error ?? "Kaydedilemedi.");
      setKey(cj.key);
    } catch (e) {
      setPreview(null);
      setKey(null);
      setErr(e instanceof Error ? e.message : "Hata.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label text-fg-muted">{label}</span>
      <input type="hidden" name={name} value={key ?? ""} />
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- yüklenen görsel önizleme
          <img src={preview} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-line" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-[11px] text-fg-passive">Görsel</div>
        )}
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="w-fit rounded-full border border-line-strong px-4 py-1.5 text-[13px] font-medium transition-standard hover:border-neon-pink disabled:opacity-50">
            {busy ? "Yükleniyor…" : key ? "Değiştir" : "Görsel yükle"}
          </button>
          {err ? <span className="text-[12px] text-critical">{err}</span> : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </div>
  );
}

/** Verilen media key'inden görüntüleme URL'i. */
export function mediaSrc(key: string | null | undefined): string | null {
  return key ? `/api/media/${key.replace(/^media\//, "")}` : null;
}
