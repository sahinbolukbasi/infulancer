"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { SparkleIcon, XIcon } from "@/components/icons";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { askCopilot, requestCampaignAction } from "@/lib/actions/copilot";
import { saveCampaign } from "@/lib/actions/campaigns";
import type { CopilotAnswer, CopilotWelcome, NextStep } from "@/lib/copilot";
import { cn } from "@/lib/cn";

type Msg =
  | { id: string; from: "user"; text: string }
  | { id: string; from: "bot"; text: string; actions?: CopilotAnswer["actions"]; form?: CopilotAnswer["form"]; steps?: NextStep[]; source?: CopilotAnswer["source"] };

const toneDot: Record<NextStep["tone"], string> = { critical: "bg-critical", warn: "bg-neon-amber", info: "bg-neon-cyan", ok: "bg-neon-lime" };
const DEFAULT_TARGETS = JSON.stringify([{ kpi: "reach", target: "100000", weight: "1", windowDays: "30" }]);
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function Steps({ steps }: { steps: NextStep[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {steps.map((s) => (
        <li key={s.title}>
          <Link href={s.href} className="group flex items-start gap-3 rounded-xl border border-line bg-glass px-3 py-2.5 transition-standard hover:border-line-strong hover:bg-surface-hover">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", toneDot[s.tone])} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-medium text-fg">{s.title}</span>
              <span className="text-[12px] text-fg-muted">{s.detail}</span>
            </span>
            <span aria-hidden className="text-fg-passive transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CampaignStartForm({ brands }: { brands: { id: string; name: string }[] }) {
  if (brands.length === 0)
    return (
      <p className="text-[13px] text-fg-muted">
        Önce bir marka ekleyin:{" "}
        <Link href="/admin/markalar/yeni" className="underline underline-offset-4">
          Yeni marka
        </Link>
      </p>
    );
  return (
    <ActionForm action={saveCampaign} submitLabel="Taslağı oluştur ve kuruluma geç" submitSize="sm" aria-label="Hızlı kampanya başlat" className="gap-3">
      <input type="hidden" name="status" value="TASLAK" />
      <input type="hidden" name="targets" value={DEFAULT_TARGETS} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Marka">
          {(p) => (
            <Select {...p} name="brandId" required defaultValue={brands[0]?.id}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Kampanya adı">{(p) => <Input {...p} name="name" required minLength={3} maxLength={140} placeholder="Yaz koleksiyonu lansmanı" />}</Field>
        <Field label="Başlangıç">{(p) => <Input {...p} name="startsAt" type="date" required defaultValue={plusDays(7)} />}</Field>
        <Field label="Bitiş">{(p) => <Input {...p} name="endsAt" type="date" required defaultValue={plusDays(28)} />}</Field>
        <Field label="Influencer bütçesi (TL)">{(p) => <Input {...p} name="budget" required inputMode="decimal" placeholder="250000" />}</Field>
        <Field label="Marka bedeli (TL)">{(p) => <Input {...p} name="brandTotalFee" required inputMode="decimal" placeholder="320000" />}</Field>
      </div>
      <p className="text-[12px] text-fg-passive">Varsayılan hedef: 30 günde 100.000 erişim. Kurulum adımlarında hedefleri, influencerları ve brief&apos;i düzenleyebilirsiniz.</p>
    </ActionForm>
  );
}

function CampaignRequestForm() {
  return (
    <ActionForm action={requestCampaignAction} submitLabel="Talebi ajansa gönder" submitSize="sm" resetOnSuccess aria-label="Kampanya talebi" className="gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Kampanya adı" className="sm:col-span-2">
          {(p) => <Input {...p} name="title" required minLength={3} maxLength={140} placeholder="Yeni ürün lansmanı" />}
        </Field>
        <Field label="Hedef ve beklentiler" className="sm:col-span-2" hint="Kitle, içerik türü, istediğiniz/istemediğiniz profiller…">
          {(p) => <Textarea {...p} name="goal" required minLength={10} maxLength={2000} rows={3} />}
        </Field>
        <Field label="Başlangıç">{(p) => <Input {...p} name="startsAt" type="date" required defaultValue={plusDays(14)} min={today()} />}</Field>
        <Field label="Bitiş">{(p) => <Input {...p} name="endsAt" type="date" required defaultValue={plusDays(35)} min={today()} />}</Field>
        <Field label="Yaklaşık bütçe (TL, isteğe bağlı)">{(p) => <Input {...p} name="budget" inputMode="decimal" />}</Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-label text-fg-muted">Platformlar</legend>
          <div className="flex flex-wrap gap-3 text-[13px]">
            {[
              ["INSTAGRAM", "Instagram"],
              ["TIKTOK", "TikTok"],
              ["YOUTUBE", "YouTube"],
            ].map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="checkbox" name="platforms" value={v} defaultChecked={v === "INSTAGRAM"} className="h-4 w-4 accent-[var(--color-fg)]" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </ActionForm>
  );
}

/**
 * Platform asistanı sohbeti. Rol bazlı karşılama + "bugün ne yapmalıyım" adımları, hızlı sorular,
 * bağlantı eylemleri ve satır içi başlatma formları (ajans: kampanya taslağı, marka: kampanya talebi).
 */
export function CopilotChat({ welcome, compact = false, onClose }: { welcome: CopilotWelcome; compact?: boolean; onClose?: () => void }) {
  const storeKey = `infl-copilot:${welcome.userId}`;
  const [messages, setMessages] = useState<Msg[]>(() => [{ id: "w", from: "bot", text: welcome.greeting, steps: welcome.steps }]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  // Oturum içi geçmiş (sekme kapanınca silinir). Karşılama her açılışta güncel verilerle yenilenir.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = sessionStorage.getItem(storeKey);
      const old = raw ? (JSON.parse(raw) as Msg[]) : [];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tek seferlik, istemci deposundan geri yükleme
      if (Array.isArray(old) && old.length) setMessages((m) => [m[0]!, ...old.filter((x) => x.id !== "w").slice(-30)]);
    } catch {
      /* bozuk kayıt yok sayılır */
    }
  }, [storeKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(messages.filter((m) => m.id !== "w").slice(-30)));
    } catch {
      /* depolama kapalı */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, storeKey]);

  const send = (q: string) => {
    const message = q.trim();
    if (!message || pending) return;
    setError(null);
    const history = messages
      .filter((m) => m.id !== "w")
      .slice(-10)
      .map((m) => ({ role: m.from === "user" ? ("user" as const) : ("assistant" as const), text: m.text }));
    setMessages((m) => [...m, { id: `u${Date.now()}`, from: "user", text: message }]);
    setText("");
    start(async () => {
      const res = await askCopilot({ message, history });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setMessages((m) => [...m, { id: `b${Date.now()}`, from: "bot", text: res.reply, actions: res.actions, form: res.form, steps: res.steps, source: res.source }]);
    });
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };
  const reset = () => {
    setMessages([{ id: "w", from: "bot", text: welcome.greeting, steps: welcome.steps }]);
    sessionStorage.removeItem(storeKey);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", compact ? "h-full" : "")}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="bg-neon neon-glow inline-flex h-9 w-9 items-center justify-center rounded-xl text-black" aria-hidden>
            <SparkleIcon size={18} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Infulancer Asistan</span>
            <span className="text-[11px] text-fg-passive">{welcome.role === "ADMIN" ? "Ajans" : welcome.role === "BRAND" ? "Marka" : "İçerik üreticisi"} modu · yönlendirme ve hızlı başlatma</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={reset} className="rounded-lg px-2 py-1 text-[12px] text-fg-muted hover:bg-surface-hover hover:text-fg">
            Yeni sohbet
          </button>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Asistanı kapat" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg">
              <XIcon size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4", !compact && "max-h-[560px]")} role="log" aria-live="polite" aria-label="Asistan sohbeti">
        {messages.map((m) =>
          m.from === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-fg px-3.5 py-2 text-[14px] text-bg">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="flex max-w-[95%] flex-col gap-3 animate-enter">
              <div className="rounded-2xl rounded-bl-md border border-line bg-glass px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line">{m.text}</div>
              {m.steps?.length ? <Steps steps={m.steps} /> : null}
              {m.form === "campaign-start" ? (
                <div className="rounded-2xl border border-neon-pink/40 p-4">
                  <CampaignStartForm brands={welcome.brands} />
                </div>
              ) : null}
              {m.form === "campaign-request" ? (
                <div className="rounded-2xl border border-neon-cyan/40 p-4">
                  <CampaignRequestForm />
                </div>
              ) : null}
              {m.actions?.length ? (
                <div className="flex flex-wrap gap-2">
                  {m.actions.map((a) => (
                    <Link
                      key={a.id}
                      href={a.href}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 rounded-full border border-line-strong px-3 py-1 text-[12px] text-fg transition-standard hover:border-neon-pink hover:text-neon-pink"
                    >
                      {a.label} →
                    </Link>
                  ))}
                </div>
              ) : null}
              {m.source === "ai" ? <span className="text-[10px] text-fg-passive">Yapay zekâ yanıtı · kontrol ederek kullanın</span> : null}
            </div>
          ),
        )}
        {pending ? (
          <div className="flex items-center gap-1 px-1 text-fg-passive" aria-label="Asistan yazıyor">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-current animate-blink" style={{ animationDelay: `${i * 200}ms` }} />
            ))}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Hızlı sorular">
          {welcome.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={pending}
              className="shrink-0 rounded-full border border-line bg-glass px-3 py-1 text-[12px] text-fg-muted transition-standard hover:border-neon-cyan hover:text-fg disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-[12px] text-critical">
            {error}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <label htmlFor={`copilot-input-${compact ? "d" : "i"}`} className="sr-only">
            Asistana sorun
          </label>
          <input
            id={`copilot-input-${compact ? "d" : "i"}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder={welcome.role === "INFLUENCER" ? "Örn. ödememi nasıl alırım?" : "Örn. yeni kampanya başlat"}
            className="h-11 flex-1 rounded-xl border border-line bg-bg px-3 text-[14px] text-fg placeholder:text-fg-passive focus:border-neon-pink focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="bg-neon inline-flex h-11 items-center justify-center rounded-xl px-4 text-[14px] font-semibold text-black transition-transform hover:scale-[1.03] disabled:opacity-50"
          >
            Gönder
          </button>
        </form>
      </div>
    </div>
  );
}
