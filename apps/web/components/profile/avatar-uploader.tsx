"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";

/** Profil fotoğrafı yükleme: seç → S3'e yükle → kaydet. 5 MB, JPEG/PNG/WebP. */
export function AvatarUploader({ name, current }: { name: string; current: string | null }) {
  const tt = useTT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Dosya 5 MB'ı aşıyor.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPEG, PNG veya WebP seçin.");
      setPreview(URL.createObjectURL(file));
      const pres = await fetch("/api/avatar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mime: file.type, size: file.size }) });
      const pj = await pres.json();
      if (!pres.ok) throw new Error(pj.error ?? "Hazırlık başarısız.");
      const put = await fetch(pj.url, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) throw new Error("Yükleme başarısız.");
      const conf = await fetch("/api/avatar", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: pj.key }) });
      const cj = await conf.json();
      if (!conf.ok) throw new Error(cj.error ?? "Kaydedilemedi.");
      setMsg({ ok: true, text: "Profil fotoğrafı güncellendi." });
      router.refresh();
    } catch (e) {
      setPreview(null);
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Hata." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await fetch("/api/avatar", { method: "DELETE" });
      setPreview(null);
      setMsg({ ok: true, text: "Fotoğraf kaldırıldı." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob)
        <img src={preview} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-neon-pink/50" />
      ) : (
        <Avatar name={name} src={current} size={64} className="ring-2 ring-neon-pink/50" />
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-full border border-line-strong px-4 py-1.5 text-[13px] font-medium transition-standard hover:border-neon-pink disabled:opacity-50">
            {busy ? tt("Yükleniyor…") : current || preview ? tt("Değiştir") : tt("Fotoğraf yükle")}
          </button>
          {current || preview ? (
            <button type="button" onClick={remove} disabled={busy} className="rounded-full px-3 py-1.5 text-[13px] text-fg-muted hover:text-fg disabled:opacity-50">{tt("Kaldır")}</button>
          ) : null}
        </div>
        <span className={msg ? (msg.ok ? "text-[12px] text-neon-lime" : "text-[12px] text-critical") : "text-[12px] text-fg-passive"}>{msg?.text ?? tt("JPEG, PNG veya WebP · en çok 5 MB")}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
