import { getConfig } from "../config/store";

/**
 * TikTok (Faz 5 — en çok belirsizlik). İskelet + saf kurallar.
 * - Outbound/cold DM API YOK → ürün DM butonu sunmaz (tiktokDmNotice).
 * - Watch time / completion / demografi public API'de YOK → creator'ın yüklediği ekran görüntüsü ile.
 * - Audit öncesi Content Posting: yalnız SELF_ONLY, 24 saatte ≤5 kullanıcı; branded content private
 *   olamaz → unaudited client ile açıklanmış paid-partnership postu İMKÂNSIZ.
 * - Native scheduled publish yok → sunucu tarafında zamanlanır.
 * - TikTok One / Creator Marketplace API'ye bağımlı özellik YOK (davet kapılı).
 * - Rate limit sayıları doğrulanmadı → adaptive throttling (messaging/throttle.ts).
 */
export const TIKTOK_SCOPES = { login: ["user.info.basic", "user.info.stats", "video.list"], publish: ["video.publish", "video.upload"] };

export const tiktokDmNotice =
  "TikTok'ta işletmelerin kullanıcılara mesaj başlatmasını sağlayan bir API yok (Business Messaging yalnız kullanıcı başlatmalı ve aracı sağlayıcı üzerinden; ABD/AEA/İsviçre/BK hesaplarında desteklenmiyor). Creator iletişimi e-posta, manuel mesaj veya erişim varsa TikTok One üzerinden yapılır.";

export const unauditedPublishingNotice =
  "Uygulamamız TikTok denetiminden (audit) geçene kadar API ile yalnızca 'yalnızca ben' (SELF_ONLY) görünürlükte gönderi yapılabilir; ücretli ortaklık açıklamalı içerik bu modda yayınlanamaz.";

export type CreatorInfo = { canPost: boolean; maxVideoDurationSec: number; privacyOptions: string[]; reason?: string };

export interface TikTokClient {
  creatorInfo(accessToken: string): Promise<CreatorInfo>;
  publish(accessToken: string, input: { videoUrl: string; caption: string; privacy: string; brandedContent: boolean; mode: "direct" | "draft" }): Promise<{ publishId: string }>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;
  listVideos(accessToken: string): Promise<{ id: string; coverImageUrl: string; viewCount?: number; likeCount?: number }[]>;
}

export const mockTikTok: TikTokClient = {
  async creatorInfo(token) {
    return token.includes("busy")
      ? { canPost: false, maxVideoDurationSec: 600, privacyOptions: ["SELF_ONLY"], reason: "Creator 24 saatlik gönderi sınırına ulaştı" }
      : { canPost: true, maxVideoDurationSec: 600, privacyOptions: ["SELF_ONLY"] };
  },
  async publish() {
    return { publishId: `pub_mock_${Date.now()}` };
  },
  async refreshToken(rt) {
    return { accessToken: `at_${rt}`, refreshToken: rt, expiresIn: 86400 };
  },
  async listVideos() {
    return [];
  },
};

export type PublishPlan = { allowed: true; privacy: string } | { allowed: false; reason: string; retryLater: boolean };

/**
 * ZORUNLU pre-flight: her yayından önce creator-info sorgulanır. "Şu anda post edemez" normal bir
 * durumdur (24 saatlik tavan tüm Direct Post client'ları arasında paylaşılır); hata değil.
 */
export async function preflightPublish(client: TikTokClient, token: string, opts: { brandedContent: boolean; audited: boolean; requestedPrivacy: string }): Promise<PublishPlan> {
  if (opts.brandedContent && !opts.audited) return { allowed: false, reason: unauditedPublishingNotice, retryLater: false };
  const info = await client.creatorInfo(token);
  if (!info.canPost) return { allowed: false, reason: `${info.reason ?? "Creator şu anda gönderi yapamıyor"}. Lütfen daha sonra tekrar deneyin.`, retryLater: true };
  const privacy = opts.audited ? opts.requestedPrivacy : "SELF_ONLY";
  if (!info.privacyOptions.includes(privacy)) return { allowed: false, reason: `Görünürlük seçeneği desteklenmiyor: ${privacy}`, retryLater: false };
  return { allowed: true, privacy };
}

export async function unauditedLimits() {
  return getConfig("tiktok.contentPosting");
}

/** Display API hijyeni: cover_image_url süresi dolar → saklanmaz, okuma anında yeniden çözülür. */
export const DISPLAY_SYNC_INTERVAL_HOURS = 12;
