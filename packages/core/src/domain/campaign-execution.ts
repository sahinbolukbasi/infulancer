import { audit } from "../audit";
import { toAuditActor, type Actor } from "../access/actor";
import { notifyAdmins } from "../agents/common";
import { prisma } from "../db";
import { DomainError } from "./errors";

/**
 * Kampanya yürütme modeli (SELF / AJANS).
 *
 *  - SELF: marka kampanyayı kendi yürütür. Influencer'ı doğrudan atar, bütçe/komisyonu kendi girer,
 *    yayın kontrolünü kendi yapar. Ajans bu kampanyayı "marka kendi yürütüyor" olarak görür,
 *    operasyonel müdahale etmez.
 *  - AJANS: marka işi ajansa devreder. Marka taslağı hazırlar ve gönderir; ajans influencer atar,
 *    bedelleri belirler ve yayına alır. Marka izler.
 *
 * Marka, kendi markası adına açtığı kampanyanın modunu TASLAK aşamasında serbestçe değiştirebilir;
 * yayına alınmış (AKTIF) bir SELF kampanyayı da ajansa devredebilir (destek/kapasite için).
 */

/** Markanın varsayılan çalışma modu (yeni kampanyalar bununla açılır). */
export async function setBrandDefaultMode(actor: Actor, brandId: string, mode: "SELF" | "AJANS") {
  if (actor.role !== "ADMIN" && !(actor.role === "BRAND" && actor.brandId === brandId)) {
    throw new DomainError("YETKISIZ", "Bu markanın ayarını değiştiremezsiniz.");
  }
  await prisma.brand.update({ where: { id: brandId }, data: { defaultExecutionMode: mode } });
  await audit.append({ actor: toAuditActor(actor), action: "BRAND_UPDATED", entityType: "Brand", entityId: brandId, data: { defaultExecutionMode: mode } });
}

/**
 * Kampanyanın yürütme modunu değiştirir.
 *  - Marka: yalnız kendi kampanyası. TASLAK iken SELF↔AJANS serbest; AKTIF SELF kampanyayı AJANS'a devredebilir.
 *  - Ajans (ADMIN): her kampanyada mod değiştirebilir (ör. markanın talebiyle geri SELF'e alma).
 * AJANS'a geçişte ajansa bildirim düşer.
 */
export async function setExecutionMode(actor: Actor, campaignId: string, mode: "SELF" | "AJANS") {
  const c = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, brandId: true, status: true, executionMode: true, name: true },
  });
  if (!c) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");

  if (actor.role === "BRAND") {
    if (c.brandId !== actor.brandId) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
    if (c.status === "KAPANDI" || c.status === "IPTAL") throw new DomainError("KURAL_IHLALI", "Kapanmış kampanyanın modu değiştirilemez.");
    // AKTIF iken marka yalnız "ajansa devret" yönüne gidebilir (geri SELF'e almak ajans işi).
    if (c.status !== "TASLAK" && mode === "SELF") {
      throw new DomainError("KURAL_IHLALI", "Yayındaki kampanyayı tekrar kendi yürütmenize almak için ajansa yazın.");
    }
  } else if (actor.role !== "ADMIN") {
    throw new DomainError("YETKISIZ", "Yürütme modunu değiştirme yetkiniz yok.");
  }

  if (c.executionMode === mode) return { changed: false, mode };
  await prisma.campaign.update({ where: { id: campaignId }, data: { executionMode: mode } });
  await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_UPDATED", entityType: "Campaign", entityId: campaignId, data: { executionMode: mode, by: actor.role } });
  if (mode === "AJANS" && actor.role === "BRAND") {
    await notifyAdmins("Marka kampanyayı ajansa devretti", `"${c.name}" kampanyasını marka ajansa devretti: influencer ataması, bedeller ve yayın kontrolü ajansta.`, `/admin/kampanyalar/${campaignId}/kurulum?adim=influencerlar`);
  }
  return { changed: true, mode };
}

/** SELF modunda marka kendi kampanyasına doğrudan müdahale edebilir (atama, yayına alma). */
export function isSelfManagedBy(campaign: { brandId: string; executionMode: string }, actor: Actor): boolean {
  return campaign.executionMode === "SELF" && actor.role === "BRAND" && actor.brandId === campaign.brandId;
}
