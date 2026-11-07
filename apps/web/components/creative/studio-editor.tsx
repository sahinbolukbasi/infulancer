"use client";
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUploadAction, imageEditAction, videoEditAction } from "@/lib/actions/creative-studio";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { fmtTl } from "@/lib/creative-models";
import { KindIcon } from "@/components/creative/kind-icon";
import { DEFAULT_EDITS, PRESETS, renderEdits, STORY_SIZE, type Aspect, type ImageEdits } from "./studio-image-render";

export type StudioUpload = { id: string; kind: "image" | "video"; name: string | null; mime: string; sizeBytes: number; source: string; durationSec: number | null; createdAt: string };
export type StudioPrices = { minTry: number; promptEdit: number; bgRemove: number; upscale: number; i2vPerSec: number; i2vEcoPerSec: number };
/** Sunucudaki tutar hesabının aynısı: tam TL, en az minTry. */
const chargeTry = (cpu: number, units: number, minTry: number) => Math.max(minTry, Math.ceil(cpu * units - 1e-9));

const fileUrl = (id: string) => `/api/creative/file/${id}`;
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "orijinal", label: "Orijinal" },
  { id: "9:16", label: "Story 9:16" },
  { id: "4:5", label: "Gönderi 4:5" },
  { id: "1:1", label: "Kare 1:1" },
  { id: "16:9", label: "Yatay 16:9" },
];

/** Tarayıcıdan S3'e yükleme (ilerleme çubuğu için XHR). */
async function uploadFile(file: Blob, opts: { name: string; mime: string; tenantId?: string; parentId?: string; onProgress?: (p: number) => void }): Promise<{ id: string }> {
  const pres = await fetch("/api/creative/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mime: opts.mime, size: file.size, tenantId: opts.tenantId }) });
  const pj = await pres.json();
  if (!pres.ok) throw new Error(pj.error ?? "Yükleme hazırlanamadı.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", pj.url);
    xhr.setRequestHeader("content-type", opts.mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Yükleme başarısız.")));
    xhr.onerror = () => reject(new Error("Bağlantı hatası; tekrar deneyin."));
    xhr.send(file);
  });
  const conf = await fetch("/api/creative/upload", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: pj.key, name: opts.name, tenantId: opts.tenantId, parentId: opts.parentId }) });
  const cj = await conf.json();
  if (!conf.ok) throw new Error(cj.error ?? "Dosya kaydedilemedi.");
  return { id: cj.id };
}

/**
 * Creative stüdyosu: yükle → kitaplık → düzenle.
 * Ücretsiz: kırp/kadraj, döndür, filtre, ışık, yazı (görsel, tarayıcıda) ve kes/kadraj/hız/ses (video, sunucuda ffmpeg).
 * Ücretli (TL bakiyeden): komutla düzenle, arka plan kaldır, netleştir, görselden video.
 */
export function StudioEditor({ uploads, tenantId, available, prices, isAdmin, initialSelected }: { uploads: StudioUpload[]; tenantId?: string; available: number; prices: StudioPrices; isAdmin: boolean; initialSelected?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(initialSelected && uploads.some((u) => u.id === initialSelected) ? initialSelected : (uploads[0]?.id ?? null));
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = uploads.find((u) => u.id === selected) ?? null;

  const onFiles = async (files: FileList | File[]) => {
    setUploadErr(null);
    let lastId: string | null = null;
    for (const f of Array.from(files)) {
      try {
        setProgress({ name: f.name, pct: 0 });
        const r = await uploadFile(f, { name: f.name, mime: f.type, tenantId, onProgress: (pct) => setProgress({ name: f.name, pct }) });
        lastId = r.id;
      } catch (e) {
        setUploadErr(`${f.name}: ${e instanceof Error ? e.message : "hata"}`);
      }
    }
    setProgress(null);
    if (lastId) {
      setSelected(lastId);
      router.refresh();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Sol: yükleme + kitaplık */}
      <aside className="flex flex-col gap-3" aria-label="Kitaplık">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) void onFiles(e.dataTransfer.files);
          }}
          className={cn("flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-standard", drag ? "border-fg bg-fg/5" : "border-line")}
        >
          <p className="text-[14px] font-medium text-fg">Görsel veya video yükle</p>
          <p className="text-[12px] text-fg-muted">Sürükleyip bırakın · JPEG/PNG/WebP ≤15 MB · MP4/MOV/WebM ≤100 MB, ≤60 sn</p>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={!!progress} className="mt-1 rounded-full bg-fg px-4 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-50">
            Dosya seç
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            className="hidden"
            aria-label="Dosya seç"
            onChange={(e) => {
              if (e.target.files?.length) void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {progress ? (
            <div className="w-full" aria-live="polite">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full bg-fg transition-[width]" style={{ width: `${progress.pct}%` }} />
              </div>
              <p className="mt-1 truncate text-[11px] text-fg-muted">
                {progress.name} · %{progress.pct}
              </p>
            </div>
          ) : null}
          {uploadErr ? (
            <p role="alert" className="text-[12px] text-critical">
              {uploadErr}
            </p>
          ) : null}
        </div>
        {uploads.length === 0 ? (
          <p className="rounded-2xl border border-line px-4 py-6 text-center text-[13px] text-fg-muted">Kitaplık boş. İlk dosyanızı yükleyin.</p>
        ) : (
          <ul className="grid max-h-[560px] grid-cols-3 gap-2 overflow-y-auto pr-1 lg:grid-cols-2" aria-label="Dosyalar">
            {uploads.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelected(u.id)}
                  aria-pressed={selected === u.id}
                  className={cn("group relative block aspect-square w-full overflow-hidden rounded-xl border bg-surface", selected === u.id ? "border-fg ring-2 ring-fg/30" : "border-line hover:border-fg/40")}
                >
                  {u.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imzalı S3 URL'i, Next optimizer kullanılmaz
                    <img src={fileUrl(u.id)} alt={u.name ?? "Görsel"} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <video src={`${fileUrl(u.id)}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" aria-label={u.name ?? "Video"} />
                  )}
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                    <KindIcon kind={u.kind} size={10} />
                    {u.source === "edit" ? "Düzenlendi" : u.kind === "video" ? "Video" : "Görsel"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Sağ: düzenleyici */}
      <section className="flex min-w-0 flex-col gap-3" aria-label="Düzenleyici">
        {notice ? (
          <p role="status" className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-600">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Bildirimi kapat" className="text-emerald-700">
              ×
            </button>
          </p>
        ) : null}
        {!current ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-line p-8 text-center text-sm text-fg-muted">Düzenlemek için soldan bir dosya seçin veya yükleyin.</div>
        ) : current.kind === "image" ? (
          <ImageEditor key={current.id} upload={current} tenantId={tenantId} available={available} prices={prices} isAdmin={isAdmin} onSaved={(id) => { setSelected(id); setNotice("Düzenlenmiş kopya kitaplığa kaydedildi ve seçildi."); router.refresh(); }} />
        ) : (
          <VideoEditor key={current.id} upload={current} tenantId={tenantId} onDone={(id) => { setSelected(id); setNotice("Video hazır; yeni sürüm kitaplıkta seçildi."); router.refresh(); }} />
        )}
      </section>
    </div>
  );
}

function Slider({ label, value, onChange, min = -100, max = 100 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
      <span className="flex justify-between">
        {label}
        <span className="tabular-nums text-fg">{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--color-fg)]" />
    </label>
  );
}

function Chips<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {items.map((i) => (
        <button key={i.id} type="button" aria-pressed={value === i.id} onClick={() => onChange(i.id)} className={cn("rounded-full border px-3 py-1 text-[12px] transition-standard", value === i.id ? "border-fg bg-fg text-bg" : "border-line text-fg-muted hover:text-fg")}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [, action, pending] = useActionState(deleteUploadAction, idleState);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Bu dosya kalıcı olarak silinsin mi?")) return;
        const fd = new FormData();
        fd.set("id", id);
        startTransition(() => {
          action(fd);
          router.refresh();
        });
      }}
      className="rounded-full px-3 py-1.5 text-[12px] text-fg-muted transition-standard hover:text-critical disabled:opacity-40"
    >
      Sil
    </button>
  );
}

/* ------------------------------- Görsel ------------------------------- */

function ImageEditor({ upload, tenantId, available, prices, isAdmin, onSaved }: { upload: StudioUpload; tenantId?: string; available: number; prices: StudioPrices; isAdmin: boolean; onSaved: (id: string) => void }) {
  const [edits, setEdits] = useState<ImageEdits>(DEFAULT_EDITS);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const set = <K extends keyof ImageEdits>(k: K, v: ImageEdits[K]) => setEdits((e) => ({ ...e, [k]: v }));

  useEffect(() => {
    const el = new Image();
    // Canvas'a çizip dışa aktarabilmek için CORS'lu yükleme (S3 CORS uygulama alanına izin verir).
    el.crossOrigin = "anonymous";
    el.onload = () => setImg(el);
    el.onerror = () => setLoadErr(true);
    el.src = `${fileUrl(upload.id)}?cors=1`;
  }, [upload.id]);

  useEffect(() => {
    if (img && canvasRef.current) renderEdits(img, edits, canvasRef.current, 900);
  }, [img, edits]);

  const changed = JSON.stringify(edits) !== JSON.stringify(DEFAULT_EDITS);

  const save = useCallback(async () => {
    if (!img) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      let c = document.createElement("canvas");
      renderEdits(img, edits, c, 2048);
      // Story: Instagram'ın beklediği tam 1080×1920 boyutuna getir.
      if (edits.aspect === "9:16") {
        const out = document.createElement("canvas");
        out.width = STORY_SIZE.w;
        out.height = STORY_SIZE.h;
        const octx = out.getContext("2d");
        if (octx) {
          octx.imageSmoothingQuality = "high";
          octx.drawImage(c, 0, 0, out.width, out.height);
          c = out;
        }
      }
      const mime = upload.mime === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, mime, 0.92));
      if (!blob) throw new Error("Görsel oluşturulamadı.");
      const base = (upload.name ?? "gorsel").replace(/\.[a-z0-9]+$/i, "");
      const suffix = edits.aspect === "9:16" ? "story" : "düzenlendi";
      const r = await uploadFile(blob, { name: `${base} (${suffix}).${mime === "image/png" ? "png" : "jpg"}`, mime, tenantId, parentId: upload.id });
      setSaveMsg("Kopya kitaplığa kaydedildi.");
      setEdits(DEFAULT_EDITS);
      onSaved(r.id);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }, [img, edits, upload, tenantId, onSaved]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3">
          <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-3xl border border-line bg-[repeating-conic-gradient(var(--color-surface)_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-3">
            {loadErr ? (
              <p className="text-sm text-fg-muted">Görsel yüklenemedi.</p>
            ) : img ? (
              <div className="relative inline-block">
                <canvas ref={canvasRef} className="block max-h-[560px] max-w-full rounded-xl shadow-lg" aria-label="Düzenleme önizlemesi" />
                {edits.aspect === "9:16" ? (
                  <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl">
                    <div className="absolute inset-x-0 top-0 h-[14%] border-b border-dashed border-white/70 bg-black/25" />
                    <div className="absolute inset-x-0 bottom-0 h-[20%] border-t border-dashed border-white/70 bg-black/25" />
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 rounded bg-black/50 px-1.5 text-[10px] text-white">Story arayüz alanı</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Yükleniyor…</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
            <span className="truncate font-medium text-fg">{upload.name ?? "Görsel"}</span>
            <span>· {fmtSize(upload.sizeBytes)}</span>
            <span className="ml-auto flex items-center gap-1">
              <a href={fileUrl(upload.id)} download className="rounded-full px-3 py-1.5 hover:text-fg">
                İndir
              </a>
              <DeleteButton id={upload.id} />
            </span>
          </div>
        </div>

        {/* Ücretsiz araçlar */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-fg">Düzenle</h3>
            <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Ücretsiz</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] text-fg-muted">Kadraj</span>
            <Chips label="Kadraj" items={ASPECTS} value={edits.aspect} onChange={(v) => set("aspect", v)} />
            {edits.aspect === "9:16" ? <span className="text-[11px] text-fg-passive">1080×1920 kaydedilir; kesikli alanlar Instagram arayüzünün altında kalır.</span> : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => set("rotate", (((edits.rotate + 90) % 360) as ImageEdits["rotate"]))} className="flex-1 rounded-xl border border-line py-2 text-[12px] hover:border-fg/40">
              ↻ Döndür
            </button>
            <button type="button" aria-pressed={edits.flipH} onClick={() => set("flipH", !edits.flipH)} className={cn("flex-1 rounded-xl border py-2 text-[12px]", edits.flipH ? "border-fg" : "border-line hover:border-fg/40")}>
              ⇋ Aynala
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] text-fg-muted">Filtre</span>
            <Chips label="Filtre" items={PRESETS} value={edits.preset} onChange={(v) => set("preset", v)} />
          </div>
          <Slider label="Parlaklık" value={edits.brightness} onChange={(v) => set("brightness", v)} />
          <Slider label="Kontrast" value={edits.contrast} onChange={(v) => set("contrast", v)} />
          <Slider label="Doygunluk" value={edits.saturation} onChange={(v) => set("saturation", v)} />
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <label htmlFor="st-text" className="text-[12px] text-fg-muted">
              Yazı ekle
            </label>
            <input id="st-text" value={edits.text} onChange={(e) => set("text", e.target.value)} maxLength={120} placeholder="Örn. %20 indirim" className="h-9 rounded-xl border border-line bg-bg px-3 text-[13px] text-fg" />
            {edits.text ? (
              <div className="flex flex-wrap items-center gap-2">
                <Chips
                  label="Yazı konumu"
                  items={[
                    { id: "ust", label: "Üst" },
                    { id: "orta", label: "Orta" },
                    { id: "alt", label: "Alt" },
                  ]}
                  value={edits.textPos}
                  onChange={(v) => set("textPos", v)}
                />
                <input type="color" value={edits.textColor} onChange={(e) => set("textColor", e.target.value)} aria-label="Yazı rengi" className="h-7 w-9 rounded border border-line bg-transparent" />
                <div className="w-full">
                  <Slider label="Yazı boyutu" value={edits.textSize} min={3} max={15} onChange={(v) => set("textSize", v)} />
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex gap-2 border-t border-line pt-3">
            <button type="button" onClick={() => setEdits(DEFAULT_EDITS)} disabled={!changed} className="rounded-full border border-line px-3 py-2 text-[12px] text-fg-muted disabled:opacity-40">
              Sıfırla
            </button>
            <button type="button" onClick={() => void save()} disabled={!changed || saving || !img} className="flex-1 rounded-full bg-fg py-2 text-[13px] font-semibold text-bg disabled:opacity-40">
              {saving ? "Kaydediliyor…" : "Kopya olarak kaydet"}
            </button>
          </div>
          {saveMsg ? (
            <p aria-live="polite" className="text-[12px] text-fg-muted">
              {saveMsg}
            </p>
          ) : null}
        </div>
      </div>

      <AiEditPanel upload={upload} tenantId={tenantId} available={available} prices={prices} isAdmin={isAdmin} />
    </div>
  );
}

/* ------------------------------ AI düzenleme ------------------------------ */

function AiEditPanel({ upload, tenantId, available, prices, isAdmin }: { upload: StudioUpload; tenantId?: string; available: number; prices: StudioPrices; isAdmin: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(imageEditAction, idleState);
  const [mode, setMode] = useState<"prompt-duzenle" | "arka-plan-kaldir" | "netlestir" | "videoya-cevir" | "videoya-cevir-ekonomik">("prompt-duzenle");
  const [prompt, setPrompt] = useState("");
  const [seconds, setSeconds] = useState<number>(5);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  const isVideo = mode === "videoya-cevir" || mode === "videoya-cevir-ekonomik";
  const secOptions = mode === "videoya-cevir-ekonomik" ? [6, 10] : [5, 10];
  const sec = secOptions.includes(seconds) ? seconds : secOptions[0]!;
  const ch = (cpu: number, u = 1) => chargeTry(cpu, u, prices.minTry);
  const opts = [
    { id: "prompt-duzenle" as const, title: "Komutla düzenle", desc: "Arka planı değiştir, ürün ekle, ışığı düzelt…", price: ch(prices.promptEdit), label: fmtTl(ch(prices.promptEdit)) },
    { id: "arka-plan-kaldir" as const, title: "Arka planı kaldır", desc: "Şeffaf PNG, ürün çekimleri için", price: ch(prices.bgRemove), label: fmtTl(ch(prices.bgRemove)) },
    { id: "netlestir" as const, title: "Netleştir (2x)", desc: "Çözünürlüğü iki katına çıkar", price: ch(prices.upscale), label: fmtTl(ch(prices.upscale)) },
    { id: "videoya-cevir-ekonomik" as const, title: "Görselden video · ekonomik", desc: "512p, 6/10 sn (Hailuo 02 Fast)", price: ch(prices.i2vEcoPerSec, sec), label: `${fmtTl(prices.i2vEcoPerSec)}/sn` },
    { id: "videoya-cevir" as const, title: "Görselden video · kaliteli", desc: "1080p, 5/10 sn (Kling 2.5)", price: ch(prices.i2vPerSec, sec), label: `${fmtTl(prices.i2vPerSec)}/sn` },
  ];
  const cur = opts.find((o) => o.id === mode)!;
  const needsPrompt = mode === "prompt-duzenle" || isVideo;
  const short = !isAdmin && cur.price > available;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
    >
      <input type="hidden" name="uploadId" value={upload.id} />
      <input type="hidden" name="action" value={mode} />
      <input type="hidden" name="seconds" value={sec} />
      {tenantId ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-fg">AI ile düzenle</h3>
        <span className="text-[12px] text-fg-muted">Bakiyeden düşer · başarısız işte ücret alınmaz</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5" role="radiogroup" aria-label="AI düzenleme türü">
        {opts.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} onClick={() => setMode(o.id)} className={cn("flex flex-col gap-1 rounded-xl border p-3 text-left transition-standard", mode === o.id ? "border-fg bg-fg/5" : "border-line hover:border-fg/40")}>
            <span className="text-[13px] font-semibold text-fg">{o.title}</span>
            <span className="text-[11px] text-fg-muted">{o.desc}</span>
            <span className="mt-1 text-[12px] font-medium tabular-nums text-fg">{o.label}</span>
          </button>
        ))}
      </div>
      {needsPrompt ? (
        <textarea
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          maxLength={1000}
          required
          placeholder={isVideo ? "Örn. ürün yavaşça dönsün, kamera yaklaşsın, yumuşak ışık" : "Örn. arka planı pastel pembe stüdyo yap, gölgeleri yumuşat"}
          aria-label="Düzenleme komutu"
          className="resize-y rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-fg placeholder:text-fg-passive"
        />
      ) : null}
      {isVideo ? <Chips label="Süre" items={secOptions.map((x) => ({ id: String(x), label: `${x} sn` }))} value={String(sec)} onChange={(v) => setSeconds(Number(v))} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {needsPrompt ? (
          <label className="flex items-center gap-2 text-[12px] text-fg-muted">
            <input type="checkbox" name="portrait" className="h-4 w-4 accent-[var(--color-fg)]" /> Görselde tanınabilir bir kişi var
          </label>
        ) : null}
        <div className="flex items-center gap-3 sm:ml-auto">
          <span className={cn("text-[12px] tabular-nums", short ? "text-critical" : "text-fg-muted")}>{short ? `Bakiye yetersiz (${fmtTl(available)})` : `${fmtTl(cur.price)} · kalan ${isAdmin ? "—" : fmtTl(Math.max(0, available - cur.price))}`}</span>
          <button type="submit" disabled={pending || short || (needsPrompt && prompt.trim().length < 5)} className="rounded-full bg-fg px-5 py-2 text-[13px] font-semibold text-bg disabled:opacity-40">
            {pending ? "Gönderiliyor…" : "Uygula"}
          </button>
        </div>
      </div>
      <div aria-live="polite">
        {state.error ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-critical">{state.error}</p> : null}
        {state.ok && state.message ? (
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-600">
            {state.message}{" "}
            <a href="/creative?sekme=galeri" className="font-medium underline underline-offset-4">
              Galeride gör
            </a>
          </p>
        ) : null}
      </div>
      <p className="text-[11px] text-fg-passive">Gerçek kişinin yüzüyle/sesiyle kimlik üretimi (md. 27/12) reddedilir. AI çıktılarına &quot;AI ile üretildi&quot; etiketi (C2PA) gömülür.</p>
    </form>
  );
}

/* --------------------------------- Video --------------------------------- */

function VideoEditor({ upload, tenantId, onDone }: { upload: StudioUpload; tenantId?: string; onDone: (id: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<number>(upload.durationSec ?? 0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState<number | null>(null);
  const [aspect, setAspect] = useState<Aspect>("orijinal");
  const [speed, setSpeed] = useState<"0.5" | "1" | "1.5" | "2">("1");
  const [mute, setMute] = useState(false);
  const [state, action, pending] = useActionState(videoEditAction, idleState);
  const [job, setJob] = useState<{ id: string; status: string; error?: string | null } | null>(null);
  const effEnd = end ?? duration;
  const outLen = Math.max(0, Math.min(effEnd, start + 60) - start) / Number(speed);
  const tooLong = duration > 0 && effEnd - start > 60;

  useEffect(() => {
    const id = state.data?.jobId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucudan dönen iş kimliğini izlemeye başla
    if (state.ok && id) setJob({ id, status: "QUEUED" });
  }, [state]);

  useEffect(() => {
    if (!job || job.status === "DONE" || job.status === "FAILED") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/creative/video-job/${job.id}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { status: string; error: string | null; outputUploadId: string | null };
      setJob({ id: job.id, status: j.status, error: j.error });
      if (j.status === "DONE" && j.outputUploadId) onDone(j.outputUploadId);
    }, 2000);
    return () => clearInterval(t);
  }, [job, onDone]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
  const busy = pending || (job != null && (job.status === "QUEUED" || job.status === "RUNNING"));

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-3">
        <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-3xl border border-line bg-black p-2">
          <video
            ref={videoRef}
            src={fileUrl(upload.id)}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            className="max-h-[560px] max-w-full rounded-xl"
            aria-label={upload.name ?? "Video"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
          <span className="truncate font-medium text-fg">{upload.name ?? "Video"}</span>
          <span>
            · {fmtSize(upload.sizeBytes)}
            {duration ? ` · ${fmt(duration)}` : ""}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <a href={fileUrl(upload.id)} download className="rounded-full px-3 py-1.5 hover:text-fg">
              İndir
            </a>
            <DeleteButton id={upload.id} />
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setJob(null);
          startTransition(() => action(fd));
        }}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
      >
        <input type="hidden" name="uploadId" value={upload.id} />
        <input type="hidden" name="trimStart" value={start.toFixed(2)} />
        <input type="hidden" name="trimEnd" value={end == null ? "" : end.toFixed(2)} />
        <input type="hidden" name="aspect" value={aspect} />
        <input type="hidden" name="speed" value={speed} />
        {mute ? <input type="hidden" name="mute" value="on" /> : null}
        {tenantId ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-fg">Videoyu düzenle</h3>
          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Ücretsiz</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-fg-muted">Kes</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setStart(Math.min(videoRef.current?.currentTime ?? 0, effEnd - 0.5))} className="rounded-xl border border-line px-2 py-2 text-left text-[12px] hover:border-fg/40">
              <span className="block text-fg-muted">Başlangıç</span>
              <span className="tabular-nums text-fg">{fmt(start)}</span>
            </button>
            <button type="button" onClick={() => setEnd(Math.max(videoRef.current?.currentTime ?? duration, start + 0.5))} className="rounded-xl border border-line px-2 py-2 text-left text-[12px] hover:border-fg/40">
              <span className="block text-fg-muted">Bitiş</span>
              <span className="tabular-nums text-fg">{fmt(effEnd)}</span>
            </button>
          </div>
          <p className="text-[11px] text-fg-passive">Videoyu istediğiniz ana getirip &quot;Başlangıç&quot; veya &quot;Bitiş&quot;e dokunun.</p>
          {(start > 0 || end != null) ? (
            <button type="button" onClick={() => { setStart(0); setEnd(null); }} className="w-fit text-[11px] text-fg-muted underline underline-offset-4">
              Kesimi sıfırla
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-fg-muted">Kadraj</span>
          <Chips label="Kadraj" items={ASPECTS} value={aspect} onChange={setAspect} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-fg-muted">Hız</span>
          <Chips label="Hız" items={[{ id: "0.5", label: "0,5x" }, { id: "1", label: "1x" }, { id: "1.5", label: "1,5x" }, { id: "2", label: "2x" }]} value={speed} onChange={setSpeed} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-fg">
          <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" /> Sesi kaldır
        </label>
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-[12px] text-fg-muted">
            Çıktı: ≈{outLen.toFixed(1)} sn · en çok 720p MP4
            {tooLong ? <span className="block text-amber-600">Seçim 60 sn&apos;den uzun; ilk 60 sn işlenir.</span> : null}
          </p>
          <button type="submit" disabled={busy} className="rounded-full bg-fg py-2 text-[13px] font-semibold text-bg disabled:opacity-40">
            {busy ? (job?.status === "RUNNING" ? "İşleniyor…" : "Sırada…") : "Düzenle ve kaydet"}
          </button>
        </div>
        <div aria-live="polite">
          {state.error ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-critical">{state.error}</p> : null}
          {job?.status === "FAILED" ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-critical">{job.error ?? "İşlenemedi."}</p> : null}
          {job?.status === "DONE" ? <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-600">Hazır; yeni video kitaplıkta seçili.</p> : null}
        </div>
      </form>
    </div>
  );
}
