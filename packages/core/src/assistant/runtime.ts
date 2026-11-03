import { prisma } from "../db";
import { getConfig } from "../config/store";
import { getLlm } from "../llm";
import { SendBlockedError, sendMessage } from "../messaging/send";
import { assignConversation } from "../messaging/inbox";
import { applyGuardrails } from "./guardrails";
import { retrieveWithConfidence } from "./rag";

/**
 * Agent çalışma zamanı (Lambda + Bedrock Converse ile başlar; AgentCore kullanılmaz).
 * Agent döngüsü bu arayüzün arkasındadır — ileride Runtime'a taşımak kolay kalsın.
 * İnsana aktarma tetiklendiğinde agent cevap üretmeyi BIRAKIR (yarım yanıt yok).
 */
export type AgentDecision =
  | { kind: "reply"; text: string; confidence: number }
  | { kind: "handoff"; reason: HandoffReason }
  | { kind: "silent"; reason: string };

export type HandoffReason = "dusuk_guven" | "insan_istedi" | "tur_limiti" | "olumsuz_duygu" | "tool_hatasi" | "hassas_konu" | "guardrail" | "mesai_disi";

export const HANDOFF_MESSAGE = "Sizi bir temsilciye aktarıyorum. En kısa sürede size dönüş yapılacak.";
export const OUT_OF_HOURS_MESSAGE = "Şu an mesai saatlerimiz dışındayız. Mesajınızı aldık; temsilcimiz mesai başlangıcında size dönüş yapacak.";

type BusinessHours = { days?: number[]; start?: string; end?: string };

/** Mesai saati kontrolü (Europe/Istanbul, UTC+3). Tanımsızsa her zaman mesai içi. */
export function isWithinHours(bh: unknown, at: Date): boolean {
  const h = (bh ?? null) as BusinessHours | null;
  if (!h || !h.days || !h.start || !h.end) return true;
  const local = new Date(at.getTime() + 3 * 3_600_000);
  const day = local.getUTCDay();
  const hm = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  return h.days.includes(day) && hm >= h.start && hm < h.end;
}

export const handoffReasonLabels: Record<HandoffReason, string> = {
  dusuk_guven: "Düşük güven",
  insan_istedi: "Kullanıcı temsilci istedi",
  tur_limiti: "Tur limiti aşıldı",
  olumsuz_duygu: "Olumsuz duygu / şikâyet",
  tool_hatasi: "Araç çağrısı başarısız",
  hassas_konu: "Hassas konu",
  guardrail: "İçerik filtresi",
  mesai_disi: "Mesai dışı",
};

function norm(s: string): string {
  return s.toLocaleLowerCase("tr");
}

export async function detectHandoff(text: string, cfg: { handoffKeywords: string[] }, turns: number, maxTurns: number): Promise<HandoffReason | null> {
  const t = norm(text);
  if (cfg.handoffKeywords.some((k) => t.includes(norm(k)))) return "insan_istedi";
  const sensitive = await getConfig("sensitive.keywords");
  if ((sensitive.sikayet ?? []).some((k) => t.includes(norm(k)))) return "olumsuz_duygu";
  for (const [topic, words] of Object.entries(sensitive)) {
    if (topic === "sikayet") continue;
    if (words.some((k) => t.includes(norm(k)))) return "hassas_konu";
  }
  if (turns >= maxTurns) return "tur_limiti";
  return null;
}

type Tool = (args: Record<string, unknown>) => Promise<string>;
/** Tenant tool'ları (e-ticaret, randevu, CRM webhook'ları) — adapter; test/mock'ta değiştirilebilir. */
export const tools: Record<string, Tool> = {
  async order_lookup() {
    throw new Error("Sipariş webhook'u yapılandırılmadı");
  },
};

export async function decide(tenantId: string, conversationId: string, text: string): Promise<AgentDecision> {
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId } });
  if (!conv) return { kind: "silent", reason: "konuşma yok" };
  if (conv.status === "awaiting_human" || conv.status === "assigned") return { kind: "silent", reason: "insan temsilcide" };
  const cfg = await prisma.agentConfig.findFirst({
    where: { tenantId, enabled: true, ...(conv.agentKey ? { agentId: conv.agentKey } : { agentId: "brand_faq" }) },
  });
  if (!cfg) return { kind: "silent", reason: "agent etkin değil" };

  const reason = await detectHandoff(text, cfg, conv.agentTurns, cfg.maxTurnsBeforeHandoff);
  if (reason) return { kind: "handoff", reason };

  const input = await applyGuardrails(text, "INPUT");
  if (input.action === "BLOCKED") return { kind: "handoff", reason: "guardrail" };

  if (cfg.agentId === "order_status") {
    try {
      const out = await tools.order_lookup!({ text });
      return { kind: "reply", text: out, confidence: 1 };
    } catch {
      return { kind: "handoff", reason: "tool_hatasi" };
    }
  }

  const hits = await retrieveWithConfidence(tenantId, input.text, 4);
  const confidence = hits[0]?.confidence ?? 0;
  if (confidence < Number(cfg.confidenceThreshold)) return { kind: "handoff", reason: "dusuk_guven" };

  const llm = await getLlm().completeText({
    system: cfg.systemPrompt,
    promptVersion: `agent-${cfg.agentId}@1`,
    prompt: `Bilgi parçaları:\n${hits.map((h, i) => `[${i + 1}] ${h.content}`).join("\n")}\n\nSoru: ${input.text}`,
  });
  // Mock sağlayıcı şablon metni döndürür; en ilgili parça doğrudan yanıt olarak kullanılır.
  const draft = llm.text.startsWith("[Otomatik") ? hits[0]!.content : llm.text;
  const out = await applyGuardrails(draft, "OUTPUT");
  if (out.action === "BLOCKED" || !out.text.trim()) return { kind: "handoff", reason: "guardrail" };
  return { kind: "reply", text: out.text, confidence };
}

/** İnsana aktarma: awaiting_human, AI ücreti yok, atama, kullanıcı bilgilendirme, SLA başlar. */
export async function handoff(tenantId: string, conversationId: string, reason: HandoffReason, now = new Date()) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { agentKey: true } });
  const cfg = await prisma.agentConfig.findFirst({ where: { tenantId, agentId: conv?.agentKey ?? "brand_faq" } });
  const outOfHours = cfg ? !isWithinHours(cfg.businessHours, now) : false;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "awaiting_human", aiChargeable: false, handoffReason: reason, slaStartedAt: now },
  });
  await assignConversation(tenantId, conversationId);
  try {
    // Mesai dışında 'queue' ise sessiz kalır; 'auto_reply_then_queue' ise bilgilendirir.
    if (!outOfHours) await sendMessage({ tenantId, conversationId, byUserId: null, text: HANDOFF_MESSAGE, now });
    else if (cfg?.outOfHoursBehavior === "auto_reply_then_queue") await sendMessage({ tenantId, conversationId, byUserId: null, text: OUT_OF_HOURS_MESSAGE, now });
  } catch (e) {
    if (!(e instanceof SendBlockedError)) throw e;
  }
}

/** Gelen mesaj için agent turu. */
export async function runAgentTurn(tenantId: string, conversationId: string, text: string, now = new Date()) {
  const decision = await decide(tenantId, conversationId, text);
  if (decision.kind === "handoff") {
    await handoff(tenantId, conversationId, decision.reason, now);
  } else if (decision.kind === "reply") {
    await sendMessage({ tenantId, conversationId, byUserId: null, text: decision.text, now });
    await prisma.conversation.update({ where: { id: conversationId }, data: { agentTurns: { increment: 1 } } });
  }
  return decision;
}

/** Konuşma yeniden açılırsa AI ücreti iade edilir (Intercom adalet mekaniği). */
export async function reopenConversation(tenantId: string, conversationId: string) {
  await prisma.conversation.updateMany({ where: { id: conversationId, tenantId }, data: { status: "open", aiChargeable: false } });
}

/** Faturalanabilir AI konuşmaları: insana aktarılan/yeniden açılanlar hariç. */
export async function billableAiConversations(tenantId: string, since: Date) {
  return prisma.conversation.count({ where: { tenantId, aiChargeable: true, agentTurns: { gt: 0 }, createdAt: { gte: since } } });
}
