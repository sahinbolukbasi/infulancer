"use server";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { AGENT_TEMPLATES, activateAgent, type AgentKey } from "@infulancer/core/assistant/catalog";
import { simulateReply, type SimResult } from "@infulancer/core/assistant/simulate";
import { DomainError } from "@infulancer/core/domain/errors";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import type { ActionState } from "@/lib/action-state";
import { attempt, parseInput, revalidateAll, str, toErrorState } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const DEFAULT_KEYWORDS = ["insan", "temsilci", "müşteri hizmetleri", "yetkili", "şikayet"];

/** Test ekranı sonucu (yan etkisiz; gerçek mesaj gönderilmez). */
export type AssistantTestState = ActionState & { result?: SimResult; question?: string };

const testSchema = z.object({
  agentId: z.enum(AGENT_TEMPLATES.map((t) => t.key) as [AgentKey, ...AgentKey[]]),
  message: z.string().min(1, { error: "Bir mesaj yazın." }).max(1000),
});

/**
 * Asistanı canlıya almadan dener: kayıtlı ayarlarla (yoksa şablon varsayılanıyla) gelen
 * mesaja üretilecek yanıtı hesaplar. Hiçbir dış API çağrılmaz, hiçbir mesaj gönderilmez.
 */
export async function testAssistantAction(_p: AssistantTestState, fd: FormData): Promise<AssistantTestState> {
  const actor = await requireActor("ADMIN", "BRAND");
  try {
    const tenantId = actor.role === "BRAND" ? actor.brandId! : str(fd, "tenantId");
    if (!(await prisma.brand.findUnique({ where: { id: tenantId }, select: { id: true } }))) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
    const input = parseInput(testSchema, { agentId: str(fd, "agentId"), message: str(fd, "message") });
    const t = AGENT_TEMPLATES.find((x) => x.key === input.agentId)!;
    const cfg = await prisma.agentConfig.findUnique({ where: { tenantId_agentId: { tenantId, agentId: input.agentId } } });
    const bh = (cfg?.businessHours ?? { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" }) as unknown;
    const result = await simulateReply(
      tenantId,
      {
        agentId: input.agentId,
        systemPrompt: cfg?.systemPrompt ?? t.systemPrompt,
        handoffKeywords: cfg?.handoffKeywords?.length ? cfg.handoffKeywords : DEFAULT_KEYWORDS,
        confidenceThreshold: Number(cfg?.confidenceThreshold ?? 0.7),
        maxTurnsBeforeHandoff: cfg?.maxTurnsBeforeHandoff ?? 4,
        businessHours: bh,
        outOfHoursBehavior: cfg?.outOfHoursBehavior ?? "queue",
      },
      input.message,
    );
    return { ok: true, message: "Önizleme hazır (gerçek mesaj gönderilmedi).", result, question: input.message };
  } catch (err) {
    return toErrorState(err);
  }
}

const quickSchema = z.object({
  agentId: z.enum(AGENT_TEMPLATES.map((t) => t.key) as [AgentKey, ...AgentKey[]]),
  tone: z.enum(["samimi", "profesyonel", "kisa"]),
});

const TONE_SUFFIX: Record<string, string> = {
  samimi: " Sıcak ve samimi bir dille, emoji kullanmadan yaz.",
  profesyonel: " Resmî ve profesyonel bir dille yaz.",
  kisa: " Çok kısa ve net yanıtlar ver.",
};

/**
 * Hızlı kurulum: bir şablon asistanı tek adımda açar, seçilen tona göre talimatı ayarlar.
 * Diğer parametreler şablon varsayılanında kalır; ince ayar için 'Ayarları düzenle' kullanılır.
 */
export async function quickSetupAssistantAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const tenantId = actor.role === "BRAND" ? actor.brandId! : str(fd, "tenantId");
    if (!(await prisma.brand.findUnique({ where: { id: tenantId }, select: { id: true } }))) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
    const input = parseInput(quickSchema, { agentId: str(fd, "agentId"), tone: str(fd, "tone") });
    const t = AGENT_TEMPLATES.find((x) => x.key === input.agentId)!;
    await activateAgent(tenantId, input.agentId);
    await prisma.agentConfig.update({
      where: { tenantId_agentId: { tenantId, agentId: input.agentId } },
      data: { enabled: true, systemPrompt: t.systemPrompt + (TONE_SUFFIX[input.tone] ?? "") },
    });
    await audit.append({ actor: toAuditActor(actor), action: "ASSISTANT_QUICK_SETUP", entityType: "AgentConfig", entityId: `${tenantId}:${input.agentId}`, data: { tone: input.tone } });
    revalidateAll();
    return { ok: true, message: `${t.name} açıldı. WhatsApp ve Instagram'da ilk yanıtı bu asistan verecek.` };
  });
}
