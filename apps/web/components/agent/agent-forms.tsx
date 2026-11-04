"use client";
import { ActionForm } from "@/components/forms/action-form";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { runAuditAgentNow, saveAssistant, toggleAuditAgent } from "@/lib/actions/agents";

export function AuditAgentControls({ job, enabled, required }: { job: string; enabled: boolean; required?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {required ? (
        <span className="inline-flex h-8 items-center rounded-[8px] border border-border px-3 text-[12px] text-fg-muted" title="Yasal yükümlülük nedeniyle kapatılamaz">
          Zorunlu
        </span>
      ) : (
        <ActionForm action={toggleAuditAgent} aria-label={enabled ? "Agent'ı kapat" : "Agent'ı aç"}>
          <input type="hidden" name="job" value={job} />
          <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
          <Button type="submit" size="sm" variant={enabled ? "secondary" : "primary"}>
            {enabled ? "Kapat" : "Aç"}
          </Button>
        </ActionForm>
      )}
      <ActionForm action={runAuditAgentNow} aria-label="Şimdi çalıştır">
        <input type="hidden" name="job" value={job} />
        <Button type="submit" size="sm" variant="ghost">
          Şimdi çalıştır
        </Button>
      </ActionForm>
    </div>
  );
}

export type AssistantValues = {
  agentId: string;
  name: string;
  enabled: boolean;
  confidencePct: number;
  maxTurns: number;
  keywords: string[];
  outOfHours: "queue" | "auto_reply_then_queue";
  days: number[];
  start: string;
  end: string;
  systemPrompt: string;
};

const DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/** Sohbet asistanı ayarları — tüm parametreler açıklamalı. */
export function AssistantForm({ values, tenantId }: { values: AssistantValues; tenantId?: string }) {
  return (
    <ActionForm action={saveAssistant} submitLabel="Kaydet" aria-label={`${values.name} ayarları`}>
      <input type="hidden" name="agentId" value={values.agentId} />
      {tenantId ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" name="enabled" defaultChecked={values.enabled} className="h-4 w-4 accent-[var(--color-fg)]" />
        Asistan açık (kapalıysa gelen mesajlar doğrudan temsilciye düşer)
      </label>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Güven eşiği (%)" hint="Bilgi tabanından bulunan cevabın güveni bunun altındaysa temsilciye aktarır. Yüksek = daha temkinli.">
          {(p) => <Input {...p} name="confidencePct" type="number" min={30} max={95} defaultValue={values.confidencePct} />}
        </Field>
        <Field label="Aktarmadan önce en fazla tur" hint="Aynı konuşmada asistanın en fazla kaç cevap vereceği.">
          {(p) => <Input {...p} name="maxTurns" type="number" min={1} max={20} defaultValue={values.maxTurns} />}
        </Field>
        <Field label="Mesai dışında">
          {(p) => (
            <Select {...p} name="outOfHours" defaultValue={values.outOfHours}>
              <option value="queue">Sessizce kuyruğa al</option>
              <option value="auto_reply_then_queue">“Mesai dışındayız” mesajı gönder, sonra kuyruğa al</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="İnsana aktar anahtar kelimeleri (virgülle)" hint="Müşteri bu kelimelerden birini yazınca asistan susar ve konuşmayı temsilciye aktarır.">
        {(p) => <Input {...p} name="keywords" defaultValue={values.keywords.join(", ")} />}
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label text-fg-muted">Mesai saatleri (İstanbul)</legend>
        <div className="flex flex-wrap items-center gap-3">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1 text-[13px] text-fg-muted">
              <input type="checkbox" name="days" value={i} defaultChecked={values.days.includes(i)} className="h-4 w-4 accent-[var(--color-fg)]" />
              {d}
            </label>
          ))}
          <Input name="start" type="time" defaultValue={values.start} aria-label="Mesai başlangıcı" className="w-28" />
          <span className="text-fg-passive">–</span>
          <Input name="end" type="time" defaultValue={values.end} aria-label="Mesai bitişi" className="w-28" />
        </div>
      </fieldset>
      <Field label="Asistan talimatı" hint="Asistanın tonu ve sınırları. Kart/IBAN istemesi ve bilgi tabanı dışında bilgi uydurması her durumda engellidir.">
        {(p) => <Textarea {...p} name="systemPrompt" rows={4} defaultValue={values.systemPrompt} />}
      </Field>
    </ActionForm>
  );
}
