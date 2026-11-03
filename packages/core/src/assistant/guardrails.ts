import { ApplyGuardrailCommand, BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { getConfig } from "../config/store";
import { envStr } from "../env";

/**
 * Guardrails varsayılan AÇIK. Önce ücretsiz olanlar: kelime filtresi + regex PII.
 * Bedrock Guardrails (content filters, denied topics, hassas bilgi) guardrailId tanımlıysa
 * ApplyGuardrail ile ayrıca uygulanır. Maliyet: ~2 text unit/mesaj → bin mesaj ≈ $0,80.
 */
export type GuardrailResult = { action: "NONE" | "ANONYMIZED" | "BLOCKED"; text: string; reasons: string[] };

const DENIED_TOPICS: { key: string; re: RegExp }[] = [
  { key: "siyaset", re: /\b(seçim(de)? oy|parti(si)?ne oy|milletvekili adayı|cumhurbaşkanı adayı|siyasi parti)\b/iu },
  { key: "mlm", re: /\b(mlm|ağ pazarlaması|çok katlı pazarlama|alt üye kazan)\b/iu },
  { key: "flort", re: /\b(flört|sevgili bul|eskort)\b/iu },
  { key: "kumar", re: /\b(bahis|casino|kumar|slot oyunu)\b/iu },
  { key: "silah", re: /\b(silah satışı|ruhsatsız silah|mermi)\b/iu },
  { key: "ilac", re: /\b(reçetesiz ilaç|antibiyotik sat|ilaç dozu)\b/iu },
  { key: "borc", re: /\b(borç tahsil|icra takibi|payday)\b/iu },
];

const PII: { key: string; re: RegExp; mask: string }[] = [
  { key: "kart", re: /\b(?:\d[ -]?){13,19}\b/g, mask: "[KART]" },
  { key: "iban", re: /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi, mask: "[IBAN]" },
  { key: "tckn", re: /\b[1-9]\d{10}\b/g, mask: "[TCKN]" },
];

export function localGuardrail(text: string): GuardrailResult {
  const reasons: string[] = [];
  for (const t of DENIED_TOPICS) if (t.re.test(text)) reasons.push(`konu:${t.key}`);
  if (reasons.length) return { action: "BLOCKED", text: "", reasons };
  let out = text;
  for (const p of PII) {
    if (p.re.test(out)) {
      reasons.push(`pii:${p.key}`);
      out = out.replace(p.re, p.mask);
    }
    p.re.lastIndex = 0;
  }
  return { action: reasons.length ? "ANONYMIZED" : "NONE", text: out, reasons };
}

export async function applyGuardrails(text: string, source: "INPUT" | "OUTPUT"): Promise<GuardrailResult> {
  const local = localGuardrail(text);
  if (local.action === "BLOCKED") return local;
  const cfg = await getConfig("bedrock.guardrails");
  if (!cfg.enabled || !cfg.guardrailId || envStr("LLM_PROVIDER", "mock") !== "bedrock") return local;
  const models = await getConfig("bedrock.models");
  const res = await new BedrockRuntimeClient({ region: models.region }).send(
    new ApplyGuardrailCommand({
      guardrailIdentifier: cfg.guardrailId,
      guardrailVersion: cfg.version ?? "DRAFT",
      source,
      content: [{ text: { text: local.text } }],
    }),
  );
  if (res.action === "GUARDRAIL_INTERVENED") {
    const masked = res.outputs?.map((o) => o.text ?? "").join("") ?? "";
    return { action: masked ? "ANONYMIZED" : "BLOCKED", text: masked, reasons: [...local.reasons, "bedrock"] };
  }
  return local;
}
