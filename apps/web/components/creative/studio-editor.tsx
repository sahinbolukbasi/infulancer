"use client";
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUploadAction, imageEditAction, videoBriefAction, videoEditAction } from "@/lib/actions/creative-studio";
import { JobProgress } from "@/components/creative/job-progress";
import { PhonePreview } from "@/components/creative/phone-preview";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { fmtTl } from "@/lib/creative-models";
import { KindIcon } from "@/components/creative/kind-icon";
import { uploadFile } from "@/lib/creative-upload";
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
  const [phone, setPhone] = useState<string | null>(null);
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
          {phone ? <PhonePreview src={phone} kind="image" initial={edits.aspect === "9:16" ? "ig-story" : "ig-post"} /> : null}
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
            <button
              type="button"
              aria-pressed={!!phone}
              onClick={() => {
                if (phone) return setPhone(null);
                try {
                  setPhone(canvasRef.current?.toDataURL("image/jpeg", 0.85) ?? fileUrl(upload.id));
                } catch {
                  setPhone(fileUrl(upload.id));
                }
              }}
              className={cn("rounded-full border px-3 py-1.5 text-[12px]", phone ? "border-fg bg-fg text-bg" : "border-line text-fg hover:border-fg/40")}
            >
              {phone ? "Önizlemeyi kapat" : "📱 Telefonda gör"}
            </button>
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
      <AiEditPanel upload={upload} available={available} prices={prices} isAdmin={isAdmin} />
    </div>
  );
}
/* ------------------------------ AI düzenleme ------------------------------ */
type AiMode = "prompt-duzenle" | "arka-plan-kaldir" | "netlestir" | "videoya-cevir" | "videoya-cevir-ekonomik";
/**
 * AI düzenleme: birden çok işlem seçilebilir. Sıra sabittir (komut → arka plan → netleştir → video);
 * her adımın çıktısı sonrakinin girdisi olur. Toplam tutar baştan gösterilir; başarısız adımın ve
 * sonrasının ücreti alınmaz. İlerleme adım adım gösterilir.
 */
function AiEditPanel({ upload, available, prices, isAdmin, onDone }: { upload: StudioUpload; tenantId?: string; available: number; prices: StudioPrices; isAdmin: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(imageEditAction, idleState);
  const [modes, setModes] = useState<AiMode[]>(["prompt-duzenle"]);
  const [prompt, setPrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [seconds, setSeconds] = useState<number>(5);
  const [jobId, setJobId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucudan dönen işi izlemeye başla
    if (state.ok && state.data?.jobId) setJobId(state.data.jobId);
  }, [state]);
  const videoMode = modes.find((m) => m === "videoya-cevir" || m === "videoya-cevir-ekonomik");
  const secOptions = videoMode === "videoya-cevir-ekonomik" ? [6, 10] : [5, 10];
  const sec = secOptions.includes(seconds) ? seconds : secOptions[0]!;
  const ch = (cpu: number, u = 1) => chargeTry(cpu, u, prices.minTry);
  const opts: { id: AiMode; title: string; desc: string; price: number; label: string }[] = [
    { id: "prompt-duzenle", title: "Komutla düzenle", desc: "Arka planı değiştir, ürün ekle, ışığı düzelt…", price: ch(prices.promptEdit), label: fmtTl(ch(prices.promptEdit)) },
    { id: "arka-plan-kaldir", title: "Arka planı kaldır", desc: "Şeffaf PNG, ürün çekimleri için", price: ch(prices.bgRemove), label: fmtTl(ch(prices.bgRemove)) },
    { id: "netlestir", title: "Netleştir (2x)", desc: "Çözünürlüğü iki katına çıkar", price: ch(prices.upscale), label: fmtTl(ch(prices.upscale)) },
    { id: "videoya-cevir-ekonomik", title: "Görselden video · ekonomik", desc: "512p, 6/10 sn (Hailuo 02 Fast)", price: ch(prices.i2vEcoPerSec, sec), label: `${fmtTl(prices.i2vEcoPerSec)}/sn` },
    { id: "videoya-cevir", title: "Görselden video · kaliteli", desc: "1080p, 5/10 sn (Kling 2.5)", price: ch(prices.i2vPerSec, sec), label: `${fmtTl(prices.i2vPerSec)}/sn` },
  ];
  const toggle = (id: AiMode) =>
    setModes((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      // Tek video dönüşümü: diğer video seçeneğini kaldır.
      const base = id.startsWith("videoya") ? cur.filter((x) => !x.startsWith("videoya")) : cur;
      return [...base, id];
    });
  const ORDER: AiMode[] = ["prompt-duzenle", "arka-plan-kaldir", "netlestir", "videoya-cevir-ekonomik", "videoya-cevir"];
  const ordered = ORDER.filter((o) => modes.includes(o));
  const total = ordered.reduce((s, m) => s + (opts.find((o) => o.id === m)?.price ?? 0), 0);
  const short = total > available;
  const needPrompt = modes.includes("prompt-duzenle");
  const missing = (needPrompt && prompt.trim().length < 5) || (!!videoMode && (videoPrompt || prompt).trim().length < 5);
  const running = jobId != null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setJobId(null);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
    >
      <input type="hidden" name="uploadId" value={upload.id} />
      {ordered.map((m) => (
        <input key={m} type="hidden" name="actions" value={m} />
      ))}
      <input type="hidden" name="seconds" value={sec} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-fg">AI ile düzenle</h3>
        <span className="text-[12px] text-fg-muted">Birden çok seçebilirsiniz · sırayla uygulanır · başarısız adımda ücret alınmaz</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="AI düzenleme türleri">
        {opts.map((o) => {
          const on = modes.includes(o.id);
          const step = ordered.indexOf(o.id);
          return (
            <button key={o.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(o.id)} className={cn("relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-standard", on ? "border-fg bg-fg/5" : "border-line hover:border-fg/40")}>
              {on ? <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-fg text-[10px] font-bold text-bg">{step + 1}</span> : null}
              <span className="pr-6 text-[13px] font-semibold text-fg">{o.title}</span>
              <span className="text-[11px] text-fg-muted">{o.desc}</span>
              <span className="mt-1 text-[12px] font-medium tabular-nums text-fg">{o.label}</span>
            </button>
          );
        })}
      </div>
      {needPrompt ? (
        <textarea name="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} maxLength={1000} placeholder="Komut: örn. arka planı pastel pembe stüdyo yap, gölgeleri yumuşat" aria-label="Düzenleme komutu" className="resize-y rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-fg placeholder:text-fg-passive" />
      ) : null}
      {videoMode ? (
        <>
          <textarea name="videoPrompt" value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} rows={2} maxLength={1000} placeholder="Video hareketi: örn. ürün yavaşça dönsün, kamera yaklaşsın" aria-label="Video hareket komutu" className="resize-y rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-fg placeholder:text-fg-passive" />
          <Chips label="Süre" items={secOptions.map((x) => ({ id: String(x), label: `${x} sn` }))} value={String(sec)} onChange={(v) => setSeconds(Number(v))} />
        </>
      ) : null}
      {ordered.length > 1 ? <p className="text-[12px] text-fg-muted">Sıra: {ordered.map((m) => opts.find((o) => o.id === m)!.title).join(" → ")}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {needPrompt || videoMode ? (
          <label className="flex items-center gap-2 text-[12px] text-fg-muted">
            <input type="checkbox" name="portrait" className="h-4 w-4 accent-[var(--color-fg)]" /> Görselde tanınabilir bir kişi var
          </label>
        ) : null}
        <div className="flex items-center gap-3 sm:ml-auto">
          <span className={cn("text-[12px] tabular-nums", short ? "text-critical" : "text-fg-muted")}>{short ? `Bakiye yetersiz (${fmtTl(available)})` : `Toplam ${fmtTl(total)} · kalan ${fmtTl(Math.max(0, available - total))}`}</span>
          <button type="submit" disabled={pending || short || ordered.length === 0 || missing} className="rounded-full bg-fg px-5 py-2 text-[13px] font-semibold text-bg disabled:opacity-40">
            {pending ? "Gönderiliyor…" : ordered.length > 1 ? `${ordered.length} adımı uygula` : "Uygula"}
          </button>
        </div>
      </div>
      <div aria-live="polite">
        {state.error ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-critical">{state.error}</p> : null}
        {running ? <JobProgress key={jobId} jobId={jobId!} onDone={() => { router.refresh(); onDone?.(); }} /> : null}
      </div>
      <p className="text-[11px] text-fg-passive">{isAdmin ? "Ajans hesabının bakiyesinden düşer. " : ""}Gerçek kişinin yüzüyle/sesiyle kimlik üretimi (md. 27/12) reddedilir. AI çıktılarına &quot;AI ile üretildi&quot; etiketi (C2PA) gömülür.</p>
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
  const [look, setLook] = useState<"orijinal" | "canli" | "siyah-beyaz" | "sicak" | "soguk">("orijinal");
  const [fade, setFade] = useState(false);
  const [phone, setPhone] = useState(false);
  const [brief, setBrief] = useState("");
  const [state, action, pending] = useActionState(videoEditAction, idleState);
  const [bState, bAction, bPending] = useActionState(videoBriefAction, idleState);
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
    const id = bState.data?.jobId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- brief planından dönen işi izle
    if (bState.ok && id) setJob({ id, status: "QUEUED" });
  }, [bState]);
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
  const busy = pending || bPending || (job != null && (job.status === "QUEUED" || job.status === "RUNNING"));
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
        {phone ? <PhonePreview src={fileUrl(upload.id)} kind="video" initial={aspect === "16:9" ? "yt-video" : "ig-reels"} /> : null}
        {/* Brief ile AI düzenleme: istek → düzenleme planı → ffmpeg (ücretsiz) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setJob(null);
            startTransition(() => bAction(fd));
          }}
          className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
          aria-label="Brief ile AI video düzenleme"
        >
          <input type="hidden" name="uploadId" value={upload.id} />
          <input type="hidden" name="duration" value={duration ? duration.toFixed(2) : ""} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-fg">Brief ile AI düzenle</h3>
            <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Ücretsiz</span>
          </div>
          <textarea name="brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} maxLength={1000} placeholder="Örn. ilk 15 saniyeyi story formatında, canlı renklerle, hızlı ve sessiz yap; başta ve sonda yumuşak geçiş olsun" aria-label="Düzenleme isteği (brief)" className="resize-y rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-fg placeholder:text-fg-passive" />
          <div className="flex flex-wrap gap-1.5" aria-label="Hazır istekler">
            {["İlk 15 saniye, story formatı, canlı renkler", "Reels için dikey, 1,5x hız, sessiz", "Kare format, siyah-beyaz, yumuşak geçiş", "Son 10 saniye, yatay, sıcak tonlar"].map((t) => (
              <button key={t} type="button" onClick={() => setBrief(t)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-muted hover:text-fg">
                + {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-fg-passive">AI isteği kesme, kadraj, hız, ses, renk ve geçiş adımlarına çevirir; plan aşağıda yazılır.</span>
            <button type="submit" disabled={busy || brief.trim().length < 5} className="ml-auto rounded-full bg-fg px-4 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-40">
              {bPending ? "Planlanıyor…" : "AI ile düzenle"}
            </button>
          </div>
          <div aria-live="polite">
            {bState.error ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-critical">{bState.error}</p> : null}
            {bState.ok && bState.message ? <p className="rounded-xl bg-fg/5 px-3 py-2 text-[13px] text-fg">{bState.message}</p> : null}
          </div>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
          <button type="button" aria-pressed={phone} onClick={() => setPhone((v) => !v)} className={cn("rounded-full border px-3 py-1.5 text-[12px]", phone ? "border-fg bg-fg text-bg" : "border-line text-fg hover:border-fg/40")}>
            {phone ? "Önizlemeyi kapat" : "📱 Telefonda gör"}
          </button>
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
        <input type="hidden" name="look" value={look} />
        {fade ? <input type="hidden" name="fade" value="on" /> : null}
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
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-fg-muted">Renk</span>
          <Chips label="Renk" items={[{ id: "orijinal", label: "Orijinal" }, { id: "canli", label: "Canlı" }, { id: "sicak", label: "Sıcak" }, { id: "soguk", label: "Soğuk" }, { id: "siyah-beyaz", label: "S/B" }]} value={look} onChange={setLook} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-fg">
          <input type="checkbox" checked={fade} onChange={(e) => setFade(e.target.checked)} className="h-4 w-4 accent-[var(--color-fg)]" /> Başta ve sonda yumuşak geçiş
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
