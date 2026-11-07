"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateCreative } from "@/lib/actions/operations";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { KindIcon } from "@/components/creative/kind-icon";
import { fmtTl, KIND_LABEL, modelHint, modelName, unitLabel, type CreativeKind } from "@/lib/creative-models";

export type ComposerModel = { key: string; kind: CreativeKind; unit: string; creditsPerUnit: number; maxUnits: number | null; durations: number[] | null; aspects: string[] | null };
export type ComposerTenant = { id: string; name: string; group: "Markalar" | "Influencerlar"; available: number };

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
const chargeTry = (cpu: number, units: number, minTry: number) => Math.max(minTry, Math.ceil(cpu * units - 1e-9));
const STYLES = ["Minimal", "Sinematik", "Pastel", "Neon", "Doğal ışık", "Stüdyo", "Retro", "Lüks"];

const KIND_DESC: Record<CreativeKind, string> = { image: "Afiş, ürün, story", video: "Reels, TikTok, tanıtım", audio: "Reklam ve story sesi" };

/**
 * Creative besteci: tür → istek → format/stil → model ve miktar → üret.
 * Marka/influencer kendi TL bakiyesiyle üretir; yönetici "kimin adına" seçer.
 */
export function CreativeComposer({
  models,
  tenants,
  isAdmin,
  available,
  minTry = 2,
  initialPrompt = "",
}: {
  models: ComposerModel[];
  tenants: ComposerTenant[];
  isAdmin: boolean;
  /** Marka/influencer için kullanılabilir bakiye TL (yönetici için seçili hesaptan okunur). */
  available: number;
  /** İş başına en düşük ücret (TL). */
  minTry?: number;
  initialPrompt?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(generateCreative, idleState);
  const kinds = useMemo(() => (["image", "video", "audio"] as CreativeKind[]).filter((k) => models.some((m) => m.kind === k)), [models]);
  const [kind, setKind] = useState<CreativeKind>(kinds[0] ?? "image");
  const inKind = models.filter((m) => m.kind === kind);
  const [modelKey, setModelKey] = useState(inKind[0]?.key ?? "");
  const [seconds, setSeconds] = useState(0);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [format, setFormat] = useState("9:16");
  const [style, setStyle] = useState("");
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const m = models.find((x) => x.key === modelKey) ?? inKind[0];
  // Faturalanan birim sunucudakiyle aynı: video = seçilen süre, ses = metnin 1000 karakter dilimi, görsel = 1.
  const durations = m?.durations ?? [5];
  const sec = durations.includes(seconds) ? seconds : durations[0]!;
  const n = kind === "video" ? sec : kind === "audio" ? Math.max(1, Math.ceil(prompt.trim().length / 1000)) : 1;
  const cost = m ? chargeTry(m.creditsPerUnit, n, minTry) : 0;
  const aspectOk = kind === "audio" || !m?.aspects || m.aspects.includes(format);
  const balance = isAdmin ? (tenants.find((t) => t.id === tenantId)?.available ?? 0) : available;
  const short = cost > balance;
  const ready = prompt.trim().length >= 10 && !!m && n > 0 && !short && aspectOk && (!isAdmin || !!tenantId);

  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- başarılı üretimden sonra isteği temizle
      setPrompt("");
      router.refresh();
    }
  }, [state, router]);

  const pickKind = (k: CreativeKind) => {
    setKind(k);
    const first = models.find((x) => x.kind === k);
    setModelKey(first?.key ?? "");
    setSeconds(0);
  };

  if (!models.length) {
    return <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-fg-muted">Şu an kullanılabilir üretim modeli yok. Ajansınız modelleri açtığında burada görünür.</p>;
  }

  return (
    <form action={action} className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface">
      <input type="hidden" name="modelKey" value={m?.key ?? ""} />
      <input type="hidden" name="aspect" value={kind === "audio" ? "" : format} />
      <input type="hidden" name="seconds" value={kind === "video" ? sec : ""} />
      <input type="hidden" name="style" value={kind === "audio" ? "" : style} />
      {isAdmin ? <input type="hidden" name="tenantId" value={tenantId} /> : null}

      {/* 1. Tür */}
      <fieldset className="grid grid-cols-3 gap-2 border-b border-line p-4">
        <legend className="sr-only">Ne üretelim?</legend>
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
          {kind === "audio" ? "Seslendirilecek metin ve ton" : "Ne görmek istiyorsunuz?"}
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
          placeholder={kind === "audio" ? "Örn. Enerjik bir tonla: 'Yeni sezon şimdi mağazalarda!'" : "Örn. Bahar ruj serisi için pastel stüdyoda ürün yakın çekimi, yumuşak ışık…"}
          className="resize-y rounded-2xl border border-line bg-bg px-4 py-3 text-[15px] leading-relaxed text-fg placeholder:text-fg-passive focus:border-fg/50 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5" aria-label="Hazır fikirler">
          {IDEAS[kind].map((idea) => (
            <button key={idea.label} type="button" onClick={() => setPrompt(idea.text)} className="rounded-full border border-line px-3 py-1 text-[12px] text-fg-muted transition-standard hover:border-fg/40 hover:text-fg">
              + {idea.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Format ve stil */}
      {kind !== "audio" ? (
        <div className="grid grid-cols-1 gap-4 border-t border-line p-4 md:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium text-fg">Format</legend>
            {!aspectOk ? <p className="text-[11px] text-amber-600">Bu model {format} üretmiyor; {m?.aspects?.join(", ")} seçin ya da başka model seçin.</p> : null}
            {format === "9:16" && kind === "image" ? <p className="text-[11px] text-fg-passive">Story düzeni: üst ve altta yazı/arayüz için boş alan bırakılır.</p> : null}
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
            <legend className="mb-2 text-[13px] font-medium text-fg">
              Stil <span className="font-normal text-fg-passive">(isteğe bağlı)</span>
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
        <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
          Kalite / model
          <select value={m?.key ?? ""} onChange={(e) => setModelKey(e.target.value)} className="h-10 rounded-xl border border-line bg-bg px-3 text-[14px] text-fg">
            {inKind.map((x) => (
              <option key={x.key} value={x.key}>
                {modelName(x.key)}
                {modelHint(x.key) ? ` · ${modelHint(x.key)}` : ""} · {fmtTl(x.creditsPerUnit)}/{unitLabel(x.unit)}
              </option>
            ))}
          </select>
        </label>
        {kind === "video" ? (
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Süre
            <select value={sec} onChange={(e) => setSeconds(Number(e.target.value))} className="h-10 rounded-xl border border-line bg-bg px-3 text-[14px] tabular-nums text-fg">
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} sn
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex flex-col gap-1 text-[12px] text-fg-muted">
            Ücretlendirme
            <span className="flex h-10 items-center rounded-xl border border-line bg-bg/50 px-3 text-[13px] text-fg">
              {kind === "audio" ? `${prompt.trim().length} karakter · ${n} × 1000` : "1 adet"}
            </span>
          </div>
        )}
        {isAdmin ? (
          <label className="flex flex-col gap-1 text-[12px] text-fg-muted sm:col-span-2 lg:col-span-1">
            Kimin adına
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-10 rounded-xl border border-line bg-bg px-3 text-[14px] text-fg">
              {(["Markalar", "Influencerlar"] as const).map((g) => {
                const list = tenants.filter((t) => t.group === g);
                return list.length ? (
                  <optgroup key={g} label={g}>
                    {list.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {fmtTl(t.available)}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-fg/[0.02] p-4 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-[12px] text-fg-muted">
          <input type="checkbox" name="portrait" className="h-4 w-4 accent-[var(--color-fg)]" /> Referansta tanınabilir kişi var
        </label>
        <div className="flex items-center gap-4 sm:ml-auto">
          <div className="flex flex-col text-right leading-tight">
            <span className="text-[15px] font-semibold tabular-nums text-fg">{fmtTl(cost)}</span>
            <span className={cn("text-[11px] tabular-nums", short ? "text-critical" : "text-fg-passive")}>{short ? `Bakiye yetersiz (${fmtTl(balance)})` : `Kalan: ${fmtTl(Math.max(0, balance - cost))}`}</span>
          </div>
          <button type="submit" disabled={pending || !ready} className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-6 text-[14px] font-semibold text-bg transition-standard hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? (
              <>
                <span className="h-2 w-2 animate-ping rounded-full bg-bg" aria-hidden /> Üretiliyor…
              </>
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
        {state.ok && state.message ? (
          <p className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-600">
            {state.message}
            <Link href="/creative?sekme=galeri" className="font-medium underline underline-offset-4">
              Galeride gör
            </Link>
          </p>
        ) : null}
      </div>
      <p className="border-t border-line px-4 py-3 text-[11px] text-fg-passive">Gerçek kişinin adı, yüzü veya sesiyle üretim otomatik reddedilir. Başarısız üretimde ücret alınmaz. Her çıktıya &quot;AI ile üretildi&quot; etiketi (C2PA) gömülür.</p>
    </form>
  );
}
