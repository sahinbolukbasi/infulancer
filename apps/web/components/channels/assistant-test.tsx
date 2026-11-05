"use client";
import { startTransition, useActionState, useRef } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select } from "@/components/ui/form";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status";
import { idleState } from "@/lib/action-state";
import { testAssistantAction, quickSetupAssistantAction, type AssistantTestState } from "@/lib/actions/assistant-test";

type Option = { key: string; name: string };

/** Hızlı kurulum: bir şablonu seçip tonunu belirleyip tek adımda açar. */
export function QuickSetup({ options, tenantId }: { options: Option[]; tenantId?: string }) {
  return (
    <Card interactive={false} className="flex flex-col gap-3">
      <CardTitle>Hızlı kurulum</CardTitle>
      <p className="text-[13px] text-fg-muted">Bir asistan şablonu seçin, tonunu belirleyin, tek adımda WhatsApp ve Instagram&apos;da açılsın. İnce ayarı sonra &quot;Ayarları düzenle&quot;den yapabilirsiniz.</p>
      <ActionForm action={quickSetupAssistantAction} submitLabel="Aç ve kaydet" aria-label="Hızlı kurulum">
        {tenantId ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Asistan">
            {(p) => (
              <Select {...p} name="agentId" defaultValue={options[0]?.key}>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Ton">
            {(p) => (
              <Select {...p} name="tone" defaultValue="samimi">
                <option value="samimi">Samimi</option>
                <option value="profesyonel">Profesyonel</option>
                <option value="kisa">Kısa ve net</option>
              </Select>
            )}
          </Field>
        </div>
      </ActionForm>
    </Card>
  );
}

/** Test ekranı: bir mesaj yazın, asistanın üreteceği yanıtı (yan etkisiz) görün. */
export function AssistantTester({ options, tenantId }: { options: Option[]; tenantId?: string }) {
  const [state, formAction, pending] = useActionState<AssistantTestState, FormData>(testAssistantAction, idleState);
  const ref = useRef<HTMLFormElement>(null);
  const r = state.result;
  return (
    <Card interactive={false} className="flex flex-col gap-3">
      <CardTitle>Test ekranı</CardTitle>
      <p className="text-[13px] text-fg-muted">Müşteri gibi yazın; asistanın kayıtlı ayarlarınızla ne cevaplayacağını görün. Burada gönderilen mesajlar gerçek alıcıya gitmez, kayda geçmez.</p>
      <form
        ref={ref}
        aria-label="Asistan testi"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
      >
        {tenantId ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
          <Field label="Hangi asistan">
            {(p) => (
              <Select {...p} name="agentId" defaultValue={options[0]?.key}>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Müşteri mesajı">
            {(p) => <Input {...p} name="message" placeholder="Örn. Kargom ne zaman gelir?" />}
          </Field>
        </div>
        {state.error ? (
          <p role="alert" className="text-[13px] text-critical">
            {state.error}
          </p>
        ) : null}
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Deneniyor…" : "Dene"}
          </Button>
        </div>
      </form>

      {r ? (
        <div className="flex flex-col gap-3 rounded-[8px] border border-border p-4" aria-live="polite">
          {state.question ? (
            <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-glass px-3 py-2 text-sm">{state.question}</div>
          ) : null}
          {r.botText ? (
            <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm border border-line px-3 py-2 text-sm">{r.botText}</div>
          ) : (
            <p className="text-[13px] text-fg-passive">Asistan sessiz kaldı; konuşma mesai dışında sessizce temsilci kuyruğuna alınır.</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            {r.decision.kind === "reply" ? (
              <StatusDot tone="active">Asistan yanıtladı · güven %{Math.round(r.decision.confidence * 100)}</StatusDot>
            ) : r.decision.kind === "handoff" ? (
              <StatusDot tone="passive">Temsilciye aktarılır · {r.handoffLabel}</StatusDot>
            ) : (
              <StatusDot tone="muted">Yanıt üretilmedi</StatusDot>
            )}
            {r.outOfHours ? <span className="text-fg-muted">Mesai dışı</span> : null}
          </div>
          {r.usedKnowledge.length ? (
            <details className="text-[12px] text-fg-muted">
              <summary className="cursor-pointer">Kullanılan bilgi parçaları ({r.usedKnowledge.length})</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {r.usedKnowledge.map((h, i) => (
                  <li key={i} className="rounded border border-line px-2 py-1">
                    %{Math.round(h.confidence * 100)} · {h.content.slice(0, 140)}
                    {h.content.length > 140 ? "…" : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="text-[12px] text-fg-passive">Bilgi tabanında eşleşme bulunamadı. Bilgi tabanına içerik ekledikçe yanıtlar güçlenir.</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
