"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SparkleIcon } from "@/components/icons";
import { ReelCard } from "@/components/landing/reel-card";
import { generateCreative } from "@/lib/actions/operations";
import { idleState } from "@/lib/action-state";
import type { LandingVideo } from "@/lib/landing-content";
import { cn } from "@/lib/cn";

export type StudioModel = { key: string; label: string; kind: string; unit: string; creditsPerUnit: number; maxUnits: number | null };
export type StudioJob = { id: string; prompt: string; brand: string; modelKey: string; status: string; at: string; units: number; reject?: string | null; c2pa?: string | null; assetId?: string | null };

const IDEAS = [
  { label: "15 sn ürün videosu", text: "15 saniyelik dikey ürün tanıtım videosu: pastel stüdyo, yavaş kamera hareketi, sonda logo ve '%20 indirim' yazısı" },
  { label: "Story için 3 kare", text: "Instagram story için 3 kare görsel seti: 1) ürün yakın çekim 2) kullanım anı 3) 'Linke tıkla' çağrısı; marka renkleri mor ve pembe" },
  { label: "Lansman afişi", text: "Yeni sezon lansman afişi, neon ışıklı şehir gecesi arka planı, ürün ortada, sade tipografi" },
  { label: "Seslendirme", text: "Sıcak ve enerjik bir ses tonuyla 20 saniyelik Türkçe reklam seslendirmesi: 'Yeni sezon şimdi mağazalarda'" },
];
const STATUS: Record<string, { label: string; cls: string }> = {
  COMPLETED: { label: "Hazır", cls: "text-neon-lime" },
  FAILED: { label: "Başarısız", cls: "text-critical" },
  REJECTED: { label: "Reddedildi", cls: "text-critical" },
  HELD: { label: "Sırada", cls: "text-neon-amber" },
  SUBMITTED: { label: "Üretiliyor", cls: "text-neon-cyan" },
};
const TONES = ["from-rose-500/70 via-fuchsia-600/50 to-indigo-700/70", "from-sky-500/70 via-cyan-600/50 to-emerald-700/70", "from-amber-500/70 via-orange-600/50 to-red-700/70", "from-violet-500/70 via-purple-600/50 to-fuchsia-700/70"];

/** Creative stüdyosu: sohbet akışı (istek → üretim kartı), örnek videolar ve tek satır besteci. */
export function CreativeStudio({ brands, models, jobs, examples, adHref = "/admin/reklam" }: { brands: { id: string; name: string }[]; models: StudioModel[]; jobs: StudioJob[]; examples: LandingVideo[]; adHref?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(generateCreative, idleState);
  const [prompt, setPrompt] = useState("");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [modelKey, setModelKey] = useState(models[0]?.key ?? "");
  const [units, setUnits] = useState("1");
  const endRef = useRef<HTMLDivElement>(null);
  const m = models.find((x) => x.key === modelKey);
  const cost = m ? Math.ceil(m.creditsPerUnit * Number(units || "0") * 1000) / 1000 : 0;
  const thread = [...jobs].reverse();

  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- başarılı gönderimden sonra besteciyi temizle
      setPrompt("");
      router.refresh();
    }
  }, [state, router]);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [jobs.length, pending]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Creative sohbeti" className="flex min-h-[620px] flex-col overflow-hidden rounded-3xl border border-line bg-surface/80 backdrop-blur">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <span className="bg-neon neon-glow inline-flex h-9 w-9 items-center justify-center rounded-xl text-black" aria-hidden>
            <SparkleIcon size={18} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Creative stüdyosu</span>
            <span className="text-[11px] text-fg-passive">Ne istediğinizi yazın; görsel, video veya ses üretilsin</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5" role="log" aria-live="polite">
          {thread.length === 0 ? (
            <div className="m-auto flex max-w-md flex-col items-center gap-3 text-center">
              <p className="text-lg font-medium">İlk üretiminizi başlatın</p>
              <p className="text-sm text-fg-muted">Aşağıdan bir fikir seçin veya kendi isteğinizi yazın.</p>
            </div>
          ) : null}
          {thread.map((j, i) => {
            const st = STATUS[j.status] ?? { label: j.status, cls: "text-fg-muted" };
            return (
              <div key={j.id} className="flex flex-col gap-3">
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-fg px-4 py-2 text-[14px] text-bg">{j.prompt}</div>
                <div className="flex max-w-[90%] gap-3 rounded-2xl rounded-bl-md border border-line bg-glass p-3">
                  <div className="w-24 shrink-0">
                    <ReelCard
                      video={{ creator: j.brand, handle: j.modelKey, platform: "Instagram", caption: j.status === "COMPLETED" ? "AI ile üretildi" : st.label, metric: `${j.units} birim`, tone: TONES[i % TONES.length]!, sponsored: false }}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 text-[13px]">
                    <span className={cn("font-medium", st.cls)}>{st.label}</span>
                    <span className="text-fg-muted">
                      {j.brand} · {j.modelKey} · {j.at}
                    </span>
                    {j.reject ? <span className="text-critical">{j.reject}</span> : null}
                    {j.c2pa ? <span className="text-[12px] text-fg-passive">C2PA kimliği {j.c2pa.slice(0, 8)}… · &quot;AI ile üretildi&quot; etiketi gömülü</span> : null}
                    {j.status === "COMPLETED" && j.assetId ? (
                      <Link href={`${adHref}?asset=${j.assetId}`} className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-neon-pink/50 px-3 py-1 text-[12px] text-fg hover:bg-neon-pink/10">
                        Reklama dönüştür →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {pending ? (
            <div className="flex items-center gap-2 text-[13px] text-fg-muted">
              <span className="h-2 w-2 rounded-full bg-neon-pink animate-ping-slow" aria-hidden /> Üretiliyor…
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
        <form action={action} className="flex flex-col gap-3 border-t border-line p-4">
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Hazır fikirler">
            {IDEAS.map((idea) => (
              <button key={idea.label} type="button" onClick={() => setPrompt(idea.text)} className="shrink-0 rounded-full border border-line px-3 py-1 text-[12px] text-fg-muted hover:border-neon-pink hover:text-fg">
                {idea.label}
              </button>
            ))}
          </div>
          <label htmlFor="cs-prompt" className="sr-only">
            İstek
          </label>
          <textarea
            id="cs-prompt"
            name="prompt"
            required
            minLength={10}
            maxLength={2000}
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Örn. bahar ruj serisi için 15 sn dikey video, pastel arka plan…"
            className="resize-none rounded-2xl border border-line bg-bg px-4 py-3 text-[14px] text-fg placeholder:text-fg-passive focus:border-neon-pink focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select name="tenantId" value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Marka" className="h-9 rounded-full border border-line bg-bg px-3 text-[13px]">
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select name="modelKey" value={modelKey} onChange={(e) => setModelKey(e.target.value)} aria-label="Model" className="h-9 rounded-full border border-line bg-bg px-3 text-[13px]">
              {models.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
            <input name="units" type="number" min={1} max={m?.maxUnits ?? 100} value={units} onChange={(e) => setUnits(e.target.value)} aria-label={`Miktar (${m?.unit ?? "birim"})`} className="h-9 w-20 rounded-full border border-line bg-bg px-3 text-[13px]" />
            <label className="flex items-center gap-1.5 text-[12px] text-fg-muted">
              <input type="checkbox" name="portrait" className="h-4 w-4 accent-[var(--color-fg)]" /> Referansta tanınabilir kişi var
            </label>
            <span className="ml-auto text-[12px] tabular-nums text-fg-muted">{cost} kredi</span>
            <button type="submit" disabled={pending || prompt.trim().length < 10 || !brandId || !modelKey} className="bg-neon inline-flex h-10 items-center rounded-full px-5 text-[14px] font-semibold text-black transition-transform hover:scale-[1.03] disabled:opacity-50">
              {pending ? "Üretiliyor…" : "Üret"}
            </button>
          </div>
          {state.error ? (
            <p role="alert" className="text-[13px] text-critical">
              {state.error}
            </p>
          ) : null}
          <p className="text-[11px] text-fg-passive">Gerçek kişinin adı, yüzü veya sesiyle üretim otomatik reddedilir. Başarısız üretimde kredi alınmaz.</p>
        </form>
      </section>
      <aside aria-label="Örnek videolar" className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Örnek işler</h2>
        <div className="grid grid-cols-2 gap-3">
          {examples.slice(0, 4).map((v, i) => (
            <button key={`${v.handle}-${i}`} type="button" onClick={() => setPrompt(`${v.caption.replace(/#\S+/g, "").trim()} — ${v.platform} için dikey video, aynı tarzda`)} className="group text-left" aria-label={`${v.caption}: bu tarzda üret`}>
              <ReelCard video={v} delay={i * 600} className="transition-transform group-hover:scale-[1.02]" />
              <span className="mt-1 block text-[11px] text-fg-muted group-hover:text-fg">Bu tarzda üret →</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
