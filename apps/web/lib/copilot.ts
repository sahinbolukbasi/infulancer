import { prisma } from "@infulancer/core/db";
import type { Actor } from "@infulancer/core/access/actor";
import { formatKurus } from "@infulancer/core/domain/labels";
import { getLlm } from "@infulancer/core/llm/index";
import { parseJsonObject } from "@infulancer/core/llm/bedrock";
import { envStr } from "@infulancer/core/env";
import { allowedActions, COPILOT_ACTIONS, COPILOT_SUGGESTIONS, matchIntent, type CopilotAction, type CopilotForm, type CopilotRole } from "@infulancer/core/copilot/intents";

export type NextStep = { title: string; detail: string; href: string; tone: "critical" | "warn" | "info" | "ok" };
export type CopilotWelcome = { role: CopilotRole; userId: string; name: string; greeting: string; steps: NextStep[]; suggestions: string[]; brands: { id: string; name: string }[] };
export type CopilotAnswer = { reply: string; actions: CopilotAction[]; form?: CopilotForm; steps?: NextStep[]; source: "kural" | "ai" };

const DAY = 24 * 60 * 60 * 1000;
const STAFF_BLOCKED = new Set(["finance", "users", "landing"]);
/** Ajans çalışanı yönetici ekranlarına bağlantı görmez. */
const forActor = (actor: Actor, list: CopilotAction[]) => (actor.staffRole ? list.filter((a) => !STAFF_BLOCKED.has(a.id)) : list);
const OPEN_DELIVERABLE = ["ATANDI", "BRIEF_GONDERILDI", "ICERIK_YUKLENDI", "REVIZYON", "ONAYLANDI"] as const;

/** Rol başına "bugün ne yapmalıyım" listesi — yalnız aktörün görebileceği verilerden. */
export async function nextSteps(actor: Actor): Promise<NextStep[]> {
  const now = new Date();
  const steps: NextStep[] = [];
  if (actor.role === "ADMIN") {
    const [apps, drafts, late, payoutReq, findings, setupDrafts, unpaid] = await Promise.all([
      prisma.signupApplication.count({ where: { status: "PENDING" } }),
      prisma.deliverable.count({ where: { status: "ICERIK_YUKLENDI", assignment: { contractStatus: { not: "RED" } } } }),
      prisma.deliverable.count({ where: { status: { in: [...OPEN_DELIVERABLE] }, plannedAt: { lt: now }, assignment: { contractStatus: { not: "RED" } } } }),
      prisma.payoutRequest.aggregate({ where: { status: "TALEP_EDILDI" }, _count: true, _sum: { amountKurus: true } }),
      prisma.agentRun.count({ where: { status: "ACIK", severity: { in: ["KRITIK", "UYARI"] } } }),
      prisma.campaign.findMany({ where: { status: "TASLAK" }, select: { id: true, name: true, _count: { select: { assignments: true, briefs: true } } }, take: 20 }),
      prisma.campaign.count({ where: { status: "KAPANDI", brandPaymentReceivedAt: null } }),
    ]);
    if (late) steps.push({ title: `${late} geciken yayın`, detail: "Planlanan tarihi geçmiş işler; influencer'la iletişime geçin veya yeniden planlayın.", href: "/admin/takvim", tone: "critical" });
    if (findings) steps.push({ title: `${findings} açık agent uyarısı`, detail: "Uyum, çakışma veya metrik tutarsızlığı bulguları.", href: "/admin/agent", tone: "critical" });
    if (drafts) steps.push({ title: `${drafts} taslak onay bekliyor`, detail: "Yüklenen içerikleri inceleyin, onaylayın veya revizyon isteyin.", href: "/admin", tone: "warn" });
    if (apps) steps.push({ title: `${apps} üyelik başvurusu`, detail: "Davetle gelen başvuruları onaylayın veya reddedin.", href: "/admin/davetler", tone: "warn" });
    if (payoutReq._count && !actor.staffRole) steps.push({ title: `${payoutReq._count} çekim talebi · ${formatKurus(payoutReq._sum.amountKurus ?? 0)}`, detail: "Onaylayıp ödeme listesine alın.", href: "/admin/finans", tone: "warn" });
    for (const c of setupDrafts.filter((c) => c._count.assignments === 0 || c._count.briefs === 0).slice(0, 3)) {
      steps.push({
        title: `“${c.name}” kurulumu eksik`,
        detail: c._count.assignments === 0 ? "Henüz influencer eklenmedi." : "Brief yazılmadı.",
        href: `/admin/kampanyalar/${c.id}/kurulum`,
        tone: "info",
      });
    }
    if (unpaid) steps.push({ title: `${unpaid} kampanyada marka tahsilatı bekliyor`, detail: "Kapanmış ama ödemesi işaretlenmemiş kampanyalar.", href: "/admin/kampanyalar?durum=KAPANDI", tone: "info" });
  } else if (actor.role === "BRAND" && actor.brandId) {
    const brandId = actor.brandId;
    const [toReview, active, openConv, tenant] = await Promise.all([
      prisma.deliverable.count({ where: { status: "ICERIK_YUKLENDI", assignment: { campaign: { brandId }, contractStatus: { not: "RED" } } } }),
      prisma.campaign.findMany({ where: { brandId, status: "AKTIF" }, select: { id: true, name: true, endsAt: true }, take: 5 }),
      prisma.conversation.count({ where: { tenantId: brandId, status: { not: "closed" } } }),
      prisma.tenantSettings.findUnique({ where: { tenantId: brandId }, select: { mode: true } }),
    ]);
    if (toReview) steps.push({ title: `${toReview} içerik onayınızı bekliyor`, detail: "Yayın öncesi taslakları onaylayın veya revizyon notu yazın.", href: "/marka", tone: "warn" });
    if (openConv) steps.push({ title: `${openConv} açık konuşma`, detail: "WhatsApp / Instagram DM gelen kutunuzda yanıt bekleyenler.", href: "/marka/gelen-kutusu", tone: "info" });
    for (const c of active) {
      const left = Math.ceil((c.endsAt.getTime() - now.getTime()) / DAY);
      steps.push({ title: `“${c.name}” sürüyor`, detail: left > 0 ? `Bitişe ${left} gün. Skor ve erişimi takip edin.` : "Bitiş tarihi geldi; rapor hazırlanıyor.", href: `/marka/kampanyalar/${c.id}`, tone: "ok" });
    }
    if (tenant?.mode !== "production") steps.push({ title: "Mesaj kanalları sandbox modunda", detail: "Canlı mesajlaşma için kanal kurulumunu ve uyum adımlarını tamamlayın.", href: "/marka/kanallar", tone: "info" });
  } else if (actor.role === "INFLUENCER" && actor.influencerId) {
    const influencerId = actor.influencerId;
    const [offers, revisions, upcoming, accounts, balance] = await Promise.all([
      prisma.assignment.count({ where: { influencerId, contractStatus: "TEKLIF" } }),
      prisma.deliverable.count({ where: { status: "REVIZYON", assignment: { influencerId } } }),
      prisma.deliverable.findMany({
        where: { assignment: { influencerId, contractStatus: "KABUL" }, status: { in: [...OPEN_DELIVERABLE] }, plannedAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY) } },
        orderBy: { plannedAt: "asc" },
        take: 3,
        select: { id: true, plannedAt: true, assignment: { select: { campaign: { select: { name: true } } } } },
      }),
      prisma.socialAccount.findMany({ where: { influencerId }, select: { syncSource: true, syncError: true } }),
      prisma.ledgerEntry.groupBy({ by: ["direction"], where: { influencerId, account: "INFLUENCER_PAYABLE", OR: [{ availableAt: null }, { availableAt: { lte: now } }] }, _sum: { amountKurus: true } }),
    ]);
    if (offers) steps.push({ title: `${offers} yeni teklif`, detail: "Kabul veya red seçin; süresi geçen teklif başka üreticiye gidebilir.", href: "/influencer", tone: "warn" });
    if (revisions) steps.push({ title: `${revisions} iş revizyon bekliyor`, detail: "Notu okuyup yeni taslağı yükleyin.", href: "/influencer", tone: "critical" });
    for (const d of upcoming) steps.push({ title: `Yaklaşan yayın: ${d.assignment.campaign.name}`, detail: `${d.plannedAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" })}`, href: `/influencer/isler/${d.id}`, tone: "info" });
    const credit = balance.find((b) => b.direction === "CREDIT")?._sum.amountKurus ?? 0;
    const debit = balance.find((b) => b.direction === "DEBIT")?._sum.amountKurus ?? 0;
    if (credit - debit > 0) steps.push({ title: `Çekilebilir bakiye: ${formatKurus(credit - debit)}`, detail: "Ödemeler sayfasından çekim talebi açabilirsiniz.", href: "/influencer/odemeler", tone: "ok" });
    if (accounts.length === 0 || accounts.some((a) => a.syncError)) steps.push({ title: "Sosyal hesaplarınızı bağlayın", detail: "Takipçi verileriniz otomatik güncellenir, daha çok teklif alırsınız.", href: "/influencer/hesaplar", tone: "info" });
  }
  if (steps.length === 0) steps.push({ title: "Her şey yolunda", detail: "Bekleyen bir işiniz yok. Yeni bir şey başlatmak için aşağıdan seçin.", href: actor.role === "ADMIN" ? "/admin" : actor.role === "BRAND" ? "/marka" : "/influencer", tone: "ok" });
  return steps.slice(0, 6);
}

export async function copilotWelcome(actor: Actor): Promise<CopilotWelcome> {
  const [user, steps, brands] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
    nextSteps(actor),
    actor.role === "ADMIN" ? prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 300 }) : Promise.resolve([]),
  ]);
  const first = (user?.name ?? "").split(" ")[0] ?? "";
  const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", hour12: false }));
  const hello = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const role = actor.role as CopilotRole;
  const intro =
    role === "ADMIN"
      ? "Ajans operasyonunuzu birlikte yönetelim. Bugün öncelikli olanlar:"
      : role === "BRAND"
        ? "Kampanyalarınızı birlikte takip edelim. Bugün dikkat etmeniz gerekenler:"
        : "İşlerinizi ve ödemelerinizi birlikte takip edelim. Bugün sizi bekleyenler:";
  return { role, userId: actor.userId, brands, name: user?.name ?? "", greeting: `${hello}${first ? ` ${first}` : ""}! ${intro}`, steps, suggestions: COPILOT_SUGGESTIONS[role] };
}

const ROLE_TR: Record<CopilotRole, string> = { ADMIN: "ajans yöneticisi", BRAND: "marka kullanıcısı", INFLUENCER: "içerik üreticisi" };

/**
 * Yanıt: önce kural motoru (her zaman çalışır). LLM_PROVIDER=bedrock ise model, rol bağlamı,
 * anlık özet ve izinli eylem listesiyle daha doğal bir yanıt üretir; eylemler yine katalogla süzülür.
 */
export async function copilotAnswer(actor: Actor, message: string, history: { role: "user" | "assistant"; text: string }[]): Promise<CopilotAnswer> {
  const role = actor.role as CopilotRole;
  const rule = matchIntent(role, message);
  const steps = rule.intent === "summary" ? await nextSteps(actor) : undefined;
  const base: CopilotAnswer = {
    reply: rule.intent === "summary" ? "Bugün öncelikli olanlar aşağıda. Birine tıklayarak doğrudan ilgili sayfaya gidebilirsiniz." : rule.reply,
    actions: forActor(actor, allowedActions(role, rule.actions)),
    form: rule.form,
    steps,
    source: "kural",
  };
  if (envStr("LLM_PROVIDER", "mock") !== "bedrock") return base;
  try {
    const context = (steps ?? (await nextSteps(actor))).map((s) => `- ${s.title}: ${s.detail}`).join("\n");
    const catalog = forActor(actor, COPILOT_ACTIONS[role])
      .map((a) => `${a.id} = ${a.label}`)
      .join("\n");
    const convo = history
      .slice(-6)
      .map((h) => `${h.role === "user" ? "Kullanıcı" : "Asistan"}: ${h.text.slice(0, 500)}`)
      .join("\n");
    const res = await getLlm().completeText({
      promptVersion: "copilot-v1",
      system:
        `Sen Infulancer influencer marketing platformunun Türkçe asistanısın. Kullanıcı bir ${ROLE_TR[role]}. ` +
        "Kısa, net ve adım adım yanıt ver (en fazla 6 cümle). Yalnız platformdaki özellikleri anlat; bilmediğin bir şeyi uydurma; hukuki/mali tavsiye verme. " +
        "Yanıtı yalnız şu JSON olarak döndür: {\"reply\": string, \"actions\": string[] (en fazla 3, yalnız listedeki kimlikler), \"form\": \"campaign-start\" | \"campaign-request\" | null}. " +
        `campaign-start yalnız ajans yöneticisi, campaign-request yalnız marka için geçerlidir.`,
      prompt: `Kullanıcının anlık durumu:\n${context}\n\nİzinli eylemler:\n${catalog}\n\nÖnceki konuşma:\n${convo}\n\nYeni mesaj: ${message.slice(0, 1000)}`,
    });
    const json = parseJsonObject(res.text);
    const reply = typeof json?.reply === "string" ? json.reply.trim().slice(0, 1500) : "";
    if (!reply) return base;
    const form = json?.form === "campaign-start" && role === "ADMIN" ? "campaign-start" : json?.form === "campaign-request" && role === "BRAND" ? "campaign-request" : base.form;
    const actions = forActor(actor, allowedActions(role, json?.actions));
    return { reply, actions: actions.length ? actions : base.actions, form, steps, source: "ai" };
  } catch {
    return base;
  }
}
