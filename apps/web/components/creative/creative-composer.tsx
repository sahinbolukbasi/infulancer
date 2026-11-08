"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateCreative } from "@/lib/actions/operations";
import { openAssetInStudioAction } from "@/lib/actions/creative-studio";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { KindIcon } from "@/components/creative/kind-icon";
import { chargeAmount, fmtTl, KIND_LABEL, modelHint, modelName, unitLabel, type CreativeKind } from "@/lib/creative-models";
import { uploadFile } from "@/lib/creative-upload";
import { JobProgress } from "@/components/creative/job-progress";
import { PhonePreview } from "@/components/creative/phone-preview";
export type ComposerModel = { key: string; kind: CreativeKind; unit: string; creditsPerUnit: number; maxUnits: number | null; durations: number[] | null; aspects: string[] | null };
export type ComposerLibraryItem = { id: string; kind: "image" | "video"; name: string | null };
export type ComposerRefPrices = { imageEdit: number; klingI2v: number; ecoI2v: number };
const IDEAS: Record<CreativeKind, { label: string; text: string }[]> = {
  image: [
    { label: "Ürün çekimi", text: "Pastel stüdyo arka planda ürünün yakın çekimi, yumuşak gölgeler, sade ve premium kompozisyon" },
    { label: "Lansman afişi", text: "Yeni sezon lansman afişi: ürün ortada, neon ışıklı şehir gecesi arka planı, büyük ve sade başlık alanı" },
    { label: "Story kapağı", text: "Instagram story kapağı: canlı renkler, ürünü elinde tutan model silueti, 'Yeni' yazısı için boşluk" },
    { label: "Yaşam tarzı", text: "Sabah ışığında kafede kahve ve ürün, doğal ve samimi yaşam tarzı fotoğrafı" },
  ],
  video: [
    { label: "Ürün tanıtımı", text: "Dönen platformda ürün, yavaş kamera hareketi, pastel ışık, sonda ürün yakın çekimi" },
    { label: "Unboxing", text: "Kutunun açılışı, ellerin ürünü çıkarması, sıcak ışık, sakin ve premium his" },
    { label: "Şehir reels", text: "Gece şehir sokaklarında hızlı geçişler, neon yansımalar, enerjik reels havası" },
  ],
  audio: [
    { label: "Reklam spotu", text: "Sıcak ve enerjik bir tonla: 'Yeni sezon şimdi mağazalarda. Kaçırma, hemen keşfet!'" },
    { label: "Story seslendirme", text: "Samimi bir tonla: 'Bugün size en sevdiğim ürünü anlatmak istiyorum, linki profilimde bulabilirsiniz.'" },
    { label: "Kampanya duyurusu", text: "Heyecanlı bir tonla: 'Sadece bu hafta sonu tüm ürünlerde yüzde yirmi indirim!'" },
  ],
};
const FORMATS = [
  { id: "9:16", label: "Story / Reels", hint: "9:16", box: "h-6 w-3.5" },
  { id: "4:5", label: "Gönderi", hint: "4:5", box: "h-6 w-5" },
  { id: "1:1", label: "Kare", hint: "1:1", box: "h-5 w-5" },
  { id: "16:9", label: "Yatay", hint: "16:9", box: "h-3.5 w-6" },
];
/** Sunucudaki tutar hesabının aynısı (pricing.jobChargeTry): tam TL, en az minTry. */
const STYLES = ["Minimal", "Sinematik", "Pastel", "Neon", "Doğal ışık", "Stüdyo", "Retro", "Lüks"];
const KIND_DESC: Record<CreativeKind, string> = { image: "Afiş, ürün, story", video: "Reels, TikTok, tanıtım", audio: "Reklam ve story sesi" };
/**
 * Creative besteci: tür → istek → format/stil → model ve miktar → üret.
 * Herkes (marka, influencer, ajans) yalnız kendi hesabının bakiyesiyle üretir.
 * İsteğe bağlı referans görseller (kitaplıktan veya bilgisayardan) üretime eklenir.
 */
export function CreativeComposer({
  models,
  library = [],
  refPrices,
  available,
  username = "markaniz",
  currency = "TRY",
  minTry = 2,
  initialPrompt = "",
}: {
  models: ComposerModel[];
  library?: ComposerLibraryItem[];
  refPrices?: ComposerRefPrices;
  /** Kullanılabilir bakiye (TL), işlemi yapanın kendi hesabı. */
  available: number;
  username?: string;
  /** Hesabın para birimi (fiyatlar bu birimde gelir; çevrim yok). */
  currency?: string;
  /** İş başına en düşük ücret (hesabın para biriminde). */
  minTry?: number;
  initialPrompt?: string;
}) {
  const tt = useTT();
  const router = useRouter();
  const [state, action, pending] = useActionState(generateCreative, idleState);
  const money = (n: number) => fmtTl(n, currency);
  const chargeTry = (cpu: number, units: number, min: number) => chargeAmount(cpu, units, min, currency);
  const kinds = useMemo(() => (["image", "video", "audio"] as CreativeKind[]).filter((k) => models.some((m) => m.kind === k)), [models]);
  const [kind, setKind] = useState<CreativeKind>(kinds[0] ?? "image");
  const inKind = models.filter((m) => m.kind === kind);
  const [modelKey, setModelKey] = useState(inKind[0]?.key ?? "");
  const [seconds, setSeconds] = useState(0);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [format, setFormat] = useState("9:16");
  const [style, setStyle] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [lib, setLib] = useState<ComposerLibraryItem[]>(library);
  const [showLib, setShowLib] = useState(false);
  const [upPct, setUpPct] = useState<number | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<{ assetId: string | null; kind: CreativeKind; prompt: string } | null>(null);
  const m = models.find((x) => x.key === modelKey) ?? inKind[0];
  // Faturalanan birim sunucudakiyle aynı: video = seçilen süre, ses = metnin 1000 karakter dilimi, görsel = 1.
  const durations = m?.durations ?? [5];
  const sec = durations.includes(seconds) ? seconds : durations[0]!;
  const n = kind === "video" ? sec : kind === "audio" ? Math.max(1, Math.ceil(prompt.trim().length / 1000)) : 1;
  // Referanslı üretimde tutar referans akışının modeline göre (sunucudaki submitGeneration ile aynı).
  const withRefs = refs.length > 0 && kind !== "audio";
  const kling = !!m?.key.startsWith("kling");
  const refSec = kind === "video" ? (kling ? ([5, 10].includes(sec) ? sec : 5) : [6, 10].includes(sec) ? sec : 6) : 1;
  const refCpu = kind === "image" ? (refPrices?.imageEdit ?? 0) : kling ? (refPrices?.klingI2v ?? 0) : (refPrices?.ecoI2v ?? 0);
  const cost = withRefs ? chargeTry(refCpu, refSec, minTry) : m ? chargeTry(m.creditsPerUnit, n, minTry) : 0;
  const aspectOk = kind === "audio" || !m?.aspects || m.aspects.includes(format);
  const balance = available;
  const short = cost > balance;
  const ready = prompt.trim().length >= 10 && !!m && n > 0 && !short && (aspectOk || withRefs);
  useEffect(() => {
    if (state.ok && state.data?.jobId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucudan dönen işi izlemeye başla
      setJobId(state.data.jobId);
      setResult(null);
    }
  }, [state]);
  const addFiles = async (files: FileList) => {
    setUpErr(null);
    for (const f of Array.from(files).slice(0, 4)) {
      try {
        setUpPct(0);
        const r = await uploadFile(f, { name: f.name, mime: f.type, onProgress: setUpPct });
        setLib((l) => [{ id: r.id, kind: r.kind, name: f.name }, ...l]);
        if (r.kind === "image") setRefs((x) => (x.length < 4 ? [...x, r.id] : x));
        else setUpErr("Video kitaplığa eklendi. Videolar Stüdyo'da “Brief ile AI düzenle” ile düzenlenir.");
      } catch (e) {
        setUpErr(`${f.name}: ${e instanceof Error ? e.message : "yüklenemedi"}`);
      }
    }
    setUpPct(null);
  };
  const toggleRef = (id: string) => setRefs((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < 4 ? [...x, id] : x));
  const pickKind = (k: CreativeKind) => {
    setKind(k);
    const first = models.find((x) => x.kind === k);
    setModelKey(first?.key ?? "");
    setSeconds(0);
  };
  if (!models.length) {
    return <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-fg-muted">{tt("Şu an kullanılabilir üretim modeli yok. Ajansınız modelleri açtığında burada görünür.")}</p>;
  }
  return (
    <form action={action} className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface">
      <input type="hidden" name="modelKey" value={m?.key ?? ""} />
      <input type="hidden" name="aspect" value={kind === "audio" ? "" : format} />
      <input type="hidden" name="seconds" value={kind === "video" ? sec : ""} />
      <input type="hidden" name="style" value={kind === "audio" ? "" : style} />
      {withRefs ? refs.map((r) => <input key={r} type="hidden" name="refs" value={r} />) : null}
      {/* 1. Tür */}
      <fieldset className="grid grid-cols-3 gap-2 border-b border-line p-4">
        <legend className="sr-only">{tt("Ne üretelim?")}</legend>
        {kinds.map((k) => (
          <label
            key={k}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-2xl border px-3 py-3 transition-standard focus-within:ring-2 focus-within:ring-fg/30 sm:flex-row sm:items-center sm:gap-3",
              kind === k ? "border-fg bg-fg text-bg" : "border-line text-fg hover:border-fg/40",
            )}
          >
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => pickKind(k)} className="sr-only" />
            <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", kind === k ? "bg-bg/15" : "bg-fg/5")}>
              <KindIcon kind={k} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[14px] font-semibold">{KIND_LABEL[k]}</span>
              <span className={cn("hidden text-[12px] sm:block", kind === k ? "text-bg/70" : "text-fg-muted")}>{KIND_DESC[k]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {/* 2. İstek */}
      <div className="flex flex-col gap-3 p-4">
        <label htmlFor="cc-prompt" className="text-[13px] font-medium text-fg">
          {kind === "audio" ? tt("Seslendirilecek metin ve ton") : tt("Ne görmek istiyorsunuz?")}
        </label>
        <textarea
          id="cc-prompt"
          name="prompt"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={kind === "audio" ? tt("Örn. Enerjik bir tonla: 'Yeni sezon şimdi mağazalarda!'") : tt("Örn. Bahar ruj serisi için pastel stüdyoda ürün yakın çekimi, yumuşak ışık…")}
          className="resize-y rounded-2xl border border-line bg-bg px-4 py-3 text-[15px] leading-relaxed text-fg placeholder:text-fg-passive focus:border-fg/50 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5" aria-label={tt("Hazır fikirler")}>
          {IDEAS[kind].map((idea) => (
            <button key={idea.label} type="button" onClick={() => setPrompt(idea.text)} className="rounded-full border border-line px-3 py-1 text-[12px] text-fg-muted transition-standard hover:border-fg/40 hover:text-fg">
              + {idea.label}
            </button>
          ))}
        </div>
        {kind !== "audio" ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-fg">{tt("Referans görsel ekle")}</span>
              <span className="text-[11px] text-fg-passive">{tt("İsteğe bağlı · en çok 4 ·")}{" "}{kind === "image" ? tt("ürününüzü/sahnenizi koruyarak yeni görsel") : tt("görseli hareketlendirerek video")}</span>
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={() => setShowLib((v) => !v)} aria-expanded={showLib} className="rounded-full border border-line px-3 py-1 text-[12px] text-fg hover:border-fg/40">{tt("Kitaplıktan seç (")}{lib.length})
                </button>
                <label className="cursor-pointer rounded-full border border-line px-3 py-1 text-[12px] text-fg hover:border-fg/40">{tt("Bilgisayardan yükle")}<input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" className="sr-only" aria-label={tt("Referans dosya yükle")} onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ""; }} />
                </label>
              </span>
            </div>
            {upPct != null ? <p className="text-[11px] text-fg-muted" aria-live="polite">{tt("Yükleniyor… %")}{upPct}</p> : null}
            {upErr ? <p className="text-[11px] text-amber-600" role="status">{upErr}</p> : null}
            {refs.length ? (
              <ul className="flex flex-wrap gap-2" aria-label={tt("Seçili referanslar")}>
                {refs.map((r) => (
                  <li key={r} className="relative h-16 w-16 overflow-hidden rounded-xl border border-fg">
                    {/* eslint-disable-next-line @next/next/no-img-element -- imzalı S3 URL'i */}
                    <img src={`/api/creative/file/${r}`} alt={tt("Referans")} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => toggleRef(r)} aria-label={tt("Referansı kaldır")} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 px-1.5 text-[10px] text-white">×</button>
                  </li>
                ))}
              </ul>
            ) : null}
            {showLib ? (
              lib.length === 0 ? (
                <p className="text-[12px] text-fg-muted">{tt("Kitaplık boş. Bilgisayardan yükleyin; yüklenenler Stüdyo'da da görünür.")}</p>
              ) : (
                <ul className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6" aria-label={tt("Kitaplık")}>
                  {lib.map((u) => (
                    <li key={u.id}>
                      {u.kind === "image" ? (
                        <button type="button" onClick={() => toggleRef(u.id)} aria-pressed={refs.includes(u.id)} aria-label={`${u.name ?? "Görsel"} referans olarak ${refs.includes(u.id) ? "kaldır" : "ekle"}`} className={cn("block aspect-square w-full overflow-hidden rounded-xl border", refs.includes(u.id) ? "border-fg ring-2 ring-fg/40" : "border-line hover:border-fg/40")}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- imzalı S3 URL'i */}
                          <img src={`/api/creative/file/${u.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <Link href={`/creative?sekme=studyo&dosya=${u.id}`} title={tt("Videoyu Stüdyo'da brief ile düzenle")} className="relative block aspect-square w-full overflow-hidden rounded-xl border border-line">
                          <video src={`/api/creative/file/${u.id}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" aria-label={u.name ?? tt("Video")} />
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[9px] text-white">{tt("Düzenle →")}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        ) : null}
      </div>
      {/* 3. Format ve stil */}
      {kind !== "audio" ? (
        <div className="grid grid-cols-1 gap-4 border-t border-line p-4 md:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium text-fg">{tt("Format")}</legend>
            {!aspectOk ? <p className="text-[11px] text-amber-600">{tt("Bu model")}{" "}{format}{" "}{tt("üretmiyor;")}{" "}{m?.aspects?.join(", ")}{" "}{tt("seçin ya da başka model seçin.")}</p> : null}
            {format === "9:16" && kind === "image" ? <p className="text-[11px] text-fg-passive">{tt("Story düzeni: üst ve altta yazı/arayüz için boş alan bırakılır.")}</p> : null}
            <div className="grid grid-cols-4 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={format === f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn("flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-standard", format === f.id ? "border-fg bg-fg/5" : "border-line hover:border-fg/40")}
                >
                  <span className={cn("rounded-[3px] border-2", f.box, format === f.id ? "border-fg" : "border-fg-muted")} aria-hidden />
                  <span className="text-[12px] font-medium">{f.label}</span>
                  <span className="text-[10px] text-fg-passive">{f.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium text-fg">{tt("Stil")}{" "}<span className="font-normal text-fg-passive">{tt("(isteğe bağlı)")}</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={style === s}
                  onClick={() => setStyle(style === s ? "" : s)}
                  className={cn("rounded-full border px-3 py-1 text-[12px] transition-standard", style === s ? "border-fg bg-fg text-bg" : "border-line text-fg-muted hover:text-fg")}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
      {/* 4. Model, miktar, hesap */}
      <div className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-[12px] text-fg-muted">{tt("Kalite / model")}<select value={m?.key ?? ""} onChange={(e) => setModelKey(e.target.value)} className="h-10 rounded-xl border border-line bg-bg px-3 text-[14px] text-fg">
            {inKind.map((x) => (
              <option key={x.key} value={x.key}>
                {modelName(x.key)}
                {modelHint(x.key) ? ` · ${modelHint(x.key)}` : ""} · {money(x.creditsPerUnit)}/{unitLabel(x.unit)}
              </option>
            ))}
          </select>
        </label>
        {kind === "video" ? (
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">{tt("Süre")}<select value={sec} onChange={(e) => setSeconds(Number(e.target.value))} className="h-10 rounded-xl border border-line bg-bg px-3 text-[14px] tabular-nums text-fg">
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d}{" "}{tt("sn")}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex flex-col gap-1 text-[12px] text-fg-muted">{tt("Ücretlendirme")}<span className="flex h-10 items-center rounded-xl border border-line bg-bg/50 px-3 text-[13px] text-fg">
              {kind === "audio" ? `${prompt.trim().length} karakter · ${n} × 1000` : tt("1 adet")}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-line bg-fg/[0.02] p-4 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-[12px] text-fg-muted">
          <input type="checkbox" name="portrait" className="h-4 w-4 accent-[var(--color-fg)]" />{" "}{tt("Referansta tanınabilir kişi var")}</label>
        <div className="flex items-center gap-4 sm:ml-auto">
          <div className="flex flex-col text-right leading-tight">
            <span className="text-[15px] font-semibold tabular-nums text-fg">{money(cost)}</span>
            <span className={cn("text-[11px] tabular-nums", short ? "text-critical" : "text-fg-passive")}>{short ? `Bakiye yetersiz (${money(balance)})` : `Kalan: ${money(Math.max(0, balance - cost))}`}</span>
          </div>
          <button type="submit" disabled={pending || !ready} className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-6 text-[14px] font-semibold text-bg transition-standard hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? (
              <>
                <span className="h-2 w-2 animate-ping rounded-full bg-bg" aria-hidden />{" "}{tt("Gönderiliyor…")}</>
            ) : withRefs ? (
              `Referansla ${KIND_LABEL[kind].toLocaleLowerCase("tr")} üret`
            ) : (
              `${KIND_LABEL[kind]} üret`
            )}
          </button>
        </div>
      </div>
      <div aria-live="polite" className="px-4 pb-4 empty:hidden">
        {state.error ? (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-critical">
            {state.error}
          </p>
        ) : null}
        {jobId ? (
          <JobProgress
            key={jobId}
            jobId={jobId}
            onDone={(assetId) => {
              setResult({ assetId, kind, prompt });
              if (assetId) setPrompt("");
              router.refresh();
            }}
          />
        ) : null}
        {result?.assetId ? (
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-line p-4 md:grid-cols-[auto_minmax(0,1fr)]">
            {result.kind === "audio" ? (
              <audio src={`/api/creative/file/${result.assetId}?t=asset`} controls className="w-full" />
            ) : (
              <PhonePreview src={`/api/creative/file/${result.assetId}?t=asset`} kind={result.kind === "video" ? "video" : "image"} username={username} caption={result.prompt.slice(0, 120)} initial={format === "9:16" ? (result.kind === "video" ? "ig-reels" : "ig-story") : format === "16:9" ? "yt-video" : "ig-post"} />
            )}
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-semibold text-fg">{tt("Hazır. Sırada ne var?")}</p>
              <Link href={`/creative?sekme=metin&asset=${result.assetId}`} className="rounded-xl border border-line px-3 py-2 text-[13px] hover:border-fg/40">{tt("Post metni ve hashtag yaz →")}</Link>
              <Link href={`/creative?sekme=galeri`} className="rounded-xl border border-line px-3 py-2 text-[13px] hover:border-fg/40">{tt("Galeride gör →")}</Link>
              {result.kind !== "audio" ? (
                <form action={openAssetInStudioAction}>
                  <input type="hidden" name="assetId" value={result.assetId} />
                  <button type="submit" className="w-full rounded-xl border border-line px-3 py-2 text-left text-[13px] hover:border-fg/40">{tt("Stüdyoda düzenle (yazı, kadraj, AI) →")}</button>
                </form>
              ) : null}
              <a href={`/api/creative/file/${result.assetId}?t=asset`} download className="rounded-xl border border-line px-3 py-2 text-[13px] hover:border-fg/40">{tt("İndir")}</a>
            </div>
          </div>
        ) : null}
      </div>
      <p className="border-t border-line px-4 py-3 text-[11px] text-fg-passive">{tt("Gerçek kişinin adı, yüzü veya sesiyle üretim otomatik reddedilir. Başarısız üretimde ücret alınmaz. Her çıktıya \"AI ile üretildi\" etiketi (C2PA) gömülür.")}</p>
    </form>
  );
}
