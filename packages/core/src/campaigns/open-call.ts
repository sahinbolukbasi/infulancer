import { prisma } from "../db";
import { DomainError } from "../domain/errors";
import { OFFER_TTL_DAYS } from "../domain/offers";
import { platformRules } from "../domain/platform-rules";

/**
 * Kampanya açık çağrı (başvuru) akışı. Marka çağrı açar → influencer başvurur → marka
 * başvuruyu inceler/kabul eder. Kabul, mevcut teklif akışına köprü kurar (özel teklif).
 */
export type CreateOpenCallInput = {
  tenantId: string;
  title: string;
  description: string;
  coverImageKey?: string | null;
  category?: string | null;
  budgetMinKurus?: number | null;
  budgetMaxKurus?: number | null;
  platforms?: string[];
  deadline?: Date | null;
  createdByUserId?: string | null;
};

export async function createOpenCall(input: CreateOpenCallInput) {
  if (!(await prisma.brand.findUnique({ where: { id: input.tenantId }, select: { id: true } }))) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
  if (input.budgetMinKurus != null && input.budgetMaxKurus != null && input.budgetMaxKurus < input.budgetMinKurus) {
    throw new DomainError("DOGRULAMA", "Üst bütçe alt bütçeden küçük olamaz.");
  }
  return prisma.campaignOpenCall.create({
    data: {
      tenantId: input.tenantId,
      title: input.title,
      description: input.description,
      coverImageKey: input.coverImageKey ?? null,
      category: input.category ?? null,
      budgetMinKurus: input.budgetMinKurus != null ? BigInt(input.budgetMinKurus) : null,
      budgetMaxKurus: input.budgetMaxKurus != null ? BigInt(input.budgetMaxKurus) : null,
      platforms: input.platforms ?? [],
      deadline: input.deadline ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

const CALL_TRANSITIONS: Record<string, string[]> = {
  TASLAK: ["ACIK"],
  ACIK: ["KAPALI"],
  KAPALI: ["ACIK"],
};

export async function setOpenCallStatus(tenantId: string, id: string, to: "TASLAK" | "ACIK" | "KAPALI") {
  const call = await prisma.campaignOpenCall.findFirst({ where: { id, tenantId }, select: { status: true } });
  if (!call) throw new DomainError("BULUNAMADI", "Çağrı bulunamadı.");
  if (!CALL_TRANSITIONS[call.status]!.includes(to)) throw new DomainError("KURAL_IHLALI", `'${call.status}' durumundan '${to}' durumuna geçilemez.`);
  return prisma.campaignOpenCall.update({ where: { id }, data: { status: to } });
}

/** Influencer başvurusu. Yalnız ACIK çağrıya, bir kez. */
export async function applyToOpenCall(input: { openCallId: string; influencerId: string; pitch: string; quotedKurus?: number | null }) {
  const call = await prisma.campaignOpenCall.findUnique({ where: { id: input.openCallId }, select: { status: true } });
  if (!call) throw new DomainError("BULUNAMADI", "Çağrı bulunamadı.");
  if (call.status !== "ACIK") throw new DomainError("KURAL_IHLALI", "Bu çağrı başvuruya kapalı.");
  if (input.pitch.trim().length < 10) throw new DomainError("DOGRULAMA", "Başvuru mesajı en az 10 karakter olmalı.");
  const dup = await prisma.campaignApplication.findUnique({ where: { openCallId_influencerId: { openCallId: input.openCallId, influencerId: input.influencerId } }, select: { id: true } });
  if (dup) throw new DomainError("CAKISMA", "Bu çağrıya zaten başvurdunuz.");
  return prisma.campaignApplication.create({
    data: { openCallId: input.openCallId, influencerId: input.influencerId, pitch: input.pitch.trim(), quotedKurus: input.quotedKurus != null ? BigInt(input.quotedKurus) : null },
  });
}

/**
 * Başvuruyu inceler. KABUL edilen başvuru, Teklifler'de tek akış olsun diye "kabul edilmiş teklif"e
 * dönüştürülür (bedel = üreticinin teklif ettiği fiyat, yoksa çağrının alt bütçesi). Ajans bu teklifi
 * diğer kabul edilen teklifler gibi kampanyaya ekler. İşlem idempotenttir: ikinci kez teklif açılmaz.
 */
export async function reviewApplication(tenantId: string, applicationId: string, to: "INCELENIYOR" | "KABUL" | "RED", reviewNote?: string | null, actorUserId?: string | null) {
  const app = await prisma.campaignApplication.findUnique({ where: { id: applicationId }, include: { openCall: true } });
  if (!app || app.openCall.tenantId !== tenantId) throw new DomainError("BULUNAMADI", "Başvuru bulunamadı.");
  if (app.offerId && to !== "KABUL") throw new DomainError("KURAL_IHLALI", "Kabul edilip teklife dönüşen başvuru geri alınamaz; teklifi Teklifler'den yönetin.");
  return prisma.$transaction(async (tx) => {
    let offerId = app.offerId;
    if (to === "KABUL" && !offerId) {
      const platform = (["INSTAGRAM", "TIKTOK", "YOUTUBE"].includes(app.openCall.platforms[0] ?? "") ? app.openCall.platforms[0] : "INSTAGRAM") as keyof typeof platformRules;
      const price = Number(app.quotedKurus ?? app.openCall.budgetMinKurus ?? 0n);
      const creator = actorUserId ?? app.openCall.createdByUserId ?? (await tx.user.findFirst({ where: { brandId: tenantId }, select: { id: true } }))?.id;
      if (!creator) throw new DomainError("DOGRULAMA", "Teklifi oluşturacak marka kullanıcısı bulunamadı.");
      const now = new Date();
      const offer = await tx.offer.create({
        data: {
          brandId: tenantId,
          influencerId: app.influencerId,
          createdById: creator,
          title: app.openCall.title,
          message: `Başvurudan: ${app.pitch}`,
          items: [{ platform, contentType: platformRules[platform].contentTypes[0], qty: 1, priceKurus: price }],
          totalKurus: price,
          status: "KABUL",
          respondedAt: now,
          responseNote: reviewNote ?? null,
          expiresAt: new Date(now.getTime() + OFFER_TTL_DAYS * 86_400_000),
        },
      });
      offerId = offer.id;
    }
    return tx.campaignApplication.update({ where: { id: applicationId }, data: { status: to, reviewNote: reviewNote ?? null, offerId } });
  });
}
