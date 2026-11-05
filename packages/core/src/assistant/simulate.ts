import { getLlm } from "../llm";
import { applyGuardrails } from "./guardrails";
import { detectHandoff, handoffReasonLabels, HANDOFF_MESSAGE, OUT_OF_HOURS_MESSAGE, isWithinHours, type AgentDecision } from "./runtime";
import { retrieveWithConfidence } from "./rag";

/**
 * Durumsuz (stateless) asistan önizlemesi: gerçek bir Conversation satırı veya dış API
 * olmadan, verilen ayarlarla gelen mesaja üretilecek yanıtı hesaplar. Test ekranı kullanır.
 * decide() ile aynı karar sırasını izler; yan etkisi yoktur (mesaj göndermez, DB yazmaz).
 */
export type SimConfig = {
  systemPrompt: string;
  handoffKeywords: string[];
  confidenceThreshold: number;
  maxTurnsBeforeHandoff: number;
  businessHours: unknown;
  outOfHoursBehavior: "queue" | "auto_reply_then_queue";
  agentId: string;
};

export type SimResult = {
  decision: AgentDecision;
  /** Kullanıcıya gösterilecek nihai bot metni (aktarma/mesai dışı mesajları dâhil). */
  botText: string | null;
  handoffLabel: string | null;
  usedKnowledge: { content: string; confidence: number }[];
  outOfHours: boolean;
};

export async function simulateReply(tenantId: string, cfg: SimConfig, text: string, turns = 0, now = new Date()): Promise<SimResult> {
  const outOfHours = !isWithinHours(cfg.businessHours, now);

  // 1) İnsana aktarma tetikleyicileri (anahtar kelime, hassas konu, tur limiti).
  const reason = await detectHandoff(text, { handoffKeywords: cfg.handoffKeywords }, turns, cfg.maxTurnsBeforeHandoff);
  if (reason) {
    const botText = outOfHours ? (cfg.outOfHoursBehavior === "auto_reply_then_queue" ? OUT_OF_HOURS_MESSAGE : null) : HANDOFF_MESSAGE;
    return { decision: { kind: "handoff", reason }, botText, handoffLabel: handoffReasonLabels[reason], usedKnowledge: [], outOfHours };
  }

  // 2) Girdi guardrail'i.
  const input = await applyGuardrails(text, "INPUT");
  if (input.action === "BLOCKED") {
    const botText = outOfHours && cfg.outOfHoursBehavior !== "auto_reply_then_queue" ? null : HANDOFF_MESSAGE;
    return { decision: { kind: "handoff", reason: "guardrail" }, botText, handoffLabel: handoffReasonLabels.guardrail, usedKnowledge: [], outOfHours };
  }

  // 3) Bilgi tabanından güvenli cevap.
  const hits = await retrieveWithConfidence(tenantId, input.text, 4);
  const confidence = hits[0]?.confidence ?? 0;
  if (confidence < cfg.confidenceThreshold) {
    const botText = outOfHours && cfg.outOfHoursBehavior !== "auto_reply_then_queue" ? null : HANDOFF_MESSAGE;
    return { decision: { kind: "handoff", reason: "dusuk_guven" }, botText, handoffLabel: handoffReasonLabels.dusuk_guven, usedKnowledge: hits, outOfHours };
  }

  const llm = await getLlm().completeText({
    system: cfg.systemPrompt,
    promptVersion: `agent-${cfg.agentId}@1`,
    prompt: `Bilgi parçaları:\n${hits.map((h, i) => `[${i + 1}] ${h.content}`).join("\n")}\n\nSoru: ${input.text}`,
  });
  const draft = llm.text.startsWith("[Otomatik") ? hits[0]!.content : llm.text;
  const out = await applyGuardrails(draft, "OUTPUT");
  if (out.action === "BLOCKED" || !out.text.trim()) {
    return { decision: { kind: "handoff", reason: "guardrail" }, botText: HANDOFF_MESSAGE, handoffLabel: handoffReasonLabels.guardrail, usedKnowledge: hits, outOfHours };
  }
  return { decision: { kind: "reply", text: out.text, confidence }, botText: out.text, handoffLabel: null, usedKnowledge: hits, outOfHours };
}
