import { prisma } from "@infulancer/core/db";
import { AGENT_TEMPLATES } from "@infulancer/core/assistant/catalog";
import type { AssistantValues } from "@/components/agent/agent-forms";

const DEFAULT_KEYWORDS = ["insan", "temsilci", "müşteri hizmetleri", "yetkili", "şikayet"];

/** Bir markanın tüm katalog asistanları (yapılandırılmamış olanlar varsayılan değerle). */
export async function assistantsFor(tenantId: string, since = new Date(Date.now() - 30 * 86_400_000)) {
  const [configs, convs, handoffs] = await Promise.all([
    prisma.agentConfig.findMany({ where: { tenantId } }),
    prisma.conversation.groupBy({ by: ["agentKey"], where: { tenantId, agentTurns: { gt: 0 }, createdAt: { gte: since } }, _count: true }),
    prisma.conversation.groupBy({ by: ["agentKey", "handoffReason"], where: { tenantId, status: { in: ["awaiting_human", "assigned", "closed"] }, handoffReason: { not: null }, createdAt: { gte: since } }, _count: true }),
  ]);
  return AGENT_TEMPLATES.map((t) => {
    const c = configs.find((x) => x.agentId === t.key);
    const bh = (c?.businessHours ?? {}) as { days?: number[]; start?: string; end?: string };
    const key = t.key === "brand_faq" ? null : t.key;
    const handled = convs.filter((x) => x.agentKey === t.key || (t.key === "brand_faq" && x.agentKey == null)).reduce((s, x) => s + x._count, 0);
    const reasons = handoffs.filter((x) => x.agentKey === key || x.agentKey === t.key);
    const values: AssistantValues = {
      agentId: t.key,
      name: t.name,
      enabled: c?.enabled ?? false,
      confidencePct: Math.round(Number(c?.confidenceThreshold ?? 0.7) * 100),
      maxTurns: c?.maxTurnsBeforeHandoff ?? 4,
      keywords: c?.handoffKeywords?.length ? c.handoffKeywords : DEFAULT_KEYWORDS,
      outOfHours: c?.outOfHoursBehavior ?? "queue",
      days: bh.days ?? [1, 2, 3, 4, 5],
      start: bh.start ?? "09:00",
      end: bh.end ?? "18:00",
      systemPrompt: c?.systemPrompt ?? t.systemPrompt,
    };
    return { template: t, configured: !!c, values, handled, handoffs: reasons.map((r) => ({ reason: r.handoffReason!, count: r._count })) };
  });
}
