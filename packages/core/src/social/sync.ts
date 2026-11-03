import { createHash } from "node:crypto";
import { prisma } from "../db";
import { envStr } from "../env";
import type { Platform } from "../generated/prisma/enums";
import { vault } from "../channels/vault";

/**
 * Sosyal hesap senkronu — yalnız RESMÎ API'ler (scraping YOK; platform kurallarına aykırı).
 * - Instagram: Business Discovery (Graph API) — ajansın kendi IG Business hesabı + token'ı ile, Business/Creator
 *   olan herkese açık hesapların takipçi, medya sayısı ve son gönderi etkileşimleri. Influencer girişi gerekmez.
 * - YouTube: Data API v3 channels/search — herkese açık kanal istatistikleri (API anahtarı).
 * - TikTok: Display API — influencer'ın kendi OAuth bağlantısı (Login Kit) gerekir.
 * - Kitle demografisi hiçbir public API'de yok → influencer'ın yüklediği ekran görüntüsünden (metrik akışı).
 * Kimlik bilgisi yoksa SOCIAL_SYNC_MODE=mock: deterministik sahte veri (geliştirme/demo).
 */
export type ProfileStats = {
  externalId: string | null;
  followers: number;
  postsCount: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  verified: boolean;
  source: "instagram_business_discovery" | "youtube_data" | "tiktok_oauth" | "mock";
};

export class SyncError extends Error {
  constructor(message: string, readonly code: "NOT_CONFIGURED" | "NOT_FOUND" | "NOT_BUSINESS" | "NEEDS_OAUTH" | "API") {
    super(message);
  }
}

export interface SocialProvider {
  fetch(platform: Platform, handle: string, ctx: { tokenRef: string | null }): Promise<ProfileStats>;
}

function cleanHandle(h: string) {
  return h.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(instagram|tiktok|youtube)\.com\/@?/i, "").replace(/\/.*$/, "");
}

/** Deterministik mock: aynı handle her zaman aynı değerleri üretir; 'yok' içeren handle → bulunamadı. */
export const mockSocial: SocialProvider = {
  async fetch(platform, rawHandle) {
    const handle = cleanHandle(rawHandle);
    if (handle.includes("yok")) throw new SyncError(`@${handle} hesabı bulunamadı.`, "NOT_FOUND");
    const h = createHash("sha256").update(`${platform}:${handle}`).digest();
    const followers = 20_000 + (h.readUInt32BE(0) % 900_000);
    const er = 0.015 + (h[4]! % 60) / 1000;
    const avgLikes = Math.round(followers * er * 0.9);
    const avgComments = Math.round(followers * er * 0.1);
    return {
      externalId: `mock-${h.toString("hex").slice(0, 12)}`,
      followers,
      postsCount: 100 + (h[5]! % 900),
      avgLikes,
      avgComments,
      avgViews: platform === "INSTAGRAM" ? null : Math.round(followers * (0.3 + (h[6]! % 50) / 100)),
      engagementRate: er,
      profileUrl: platform === "INSTAGRAM" ? `https://instagram.com/${handle}` : platform === "TIKTOK" ? `https://tiktok.com/@${handle}` : `https://youtube.com/@${handle}`,
      avatarUrl: null,
      verified: h[7]! % 5 === 0,
      source: "mock",
    };
  },
};

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string; code?: number } };
  if (!res.ok || json.error) throw new SyncError(json.error?.message ?? `HTTP ${res.status}`, res.status === 404 ? "NOT_FOUND" : "API");
  return json;
}

export const httpSocial: SocialProvider = {
  async fetch(platform, rawHandle, ctx) {
    const handle = cleanHandle(rawHandle);
    if (platform === "INSTAGRAM") {
      const igUser = envStr("IG_BUSINESS_ACCOUNT_ID", "");
      const token = envStr("IG_GRAPH_TOKEN", "");
      if (!igUser || !token) throw new SyncError("Instagram senkronu yapılandırılmadı (IG_BUSINESS_ACCOUNT_ID / IG_GRAPH_TOKEN).", "NOT_CONFIGURED");
      const fields = `business_discovery.username(${encodeURIComponent(handle)}){id,followers_count,media_count,profile_picture_url,media.limit(12){like_count,comments_count}}`;
      const j = (await getJson(`https://graph.facebook.com/v24.0/${igUser}?fields=${fields}&access_token=${encodeURIComponent(token)}`)) as {
        business_discovery?: { id: string; followers_count: number; media_count: number; profile_picture_url?: string; media?: { data: { like_count?: number; comments_count?: number }[] } };
      };
      const bd = j.business_discovery;
      if (!bd) throw new SyncError(`@${handle} bir Business/Creator hesabı değil veya bulunamadı.`, "NOT_BUSINESS");
      const media = bd.media?.data ?? [];
      const avgLikes = media.length ? Math.round(media.reduce((s, m) => s + (m.like_count ?? 0), 0) / media.length) : null;
      const avgComments = media.length ? Math.round(media.reduce((s, m) => s + (m.comments_count ?? 0), 0) / media.length) : null;
      return {
        externalId: bd.id,
        followers: bd.followers_count,
        postsCount: bd.media_count,
        avgLikes,
        avgComments,
        avgViews: null,
        engagementRate: bd.followers_count && avgLikes != null ? (avgLikes + (avgComments ?? 0)) / bd.followers_count : null,
        profileUrl: `https://instagram.com/${handle}`,
        avatarUrl: bd.profile_picture_url ?? null,
        verified: false,
        source: "instagram_business_discovery",
      };
    }
    if (platform === "YOUTUBE") {
      const key = envStr("YOUTUBE_API_KEY", "");
      if (!key) throw new SyncError("YouTube senkronu yapılandırılmadı (YOUTUBE_API_KEY).", "NOT_CONFIGURED");
      const j = (await getJson(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=${encodeURIComponent(`@${handle}`)}&key=${key}`)) as {
        items?: { id: string; statistics: { subscriberCount?: string; videoCount?: string; viewCount?: string }; snippet: { thumbnails?: { default?: { url: string } } } }[];
      };
      const ch = j.items?.[0];
      if (!ch) throw new SyncError(`@${handle} YouTube kanalı bulunamadı.`, "NOT_FOUND");
      const subs = Number(ch.statistics.subscriberCount ?? 0);
      const videos = Number(ch.statistics.videoCount ?? 0);
      const views = Number(ch.statistics.viewCount ?? 0);
      return {
        externalId: ch.id,
        followers: subs,
        postsCount: videos,
        avgLikes: null,
        avgComments: null,
        avgViews: videos ? Math.round(views / videos) : null,
        engagementRate: null,
        profileUrl: `https://youtube.com/@${handle}`,
        avatarUrl: ch.snippet.thumbnails?.default?.url ?? null,
        verified: false,
        source: "youtube_data",
      };
    }
    // TikTok: yalnız influencer'ın kendi OAuth bağlantısı ile
    if (!ctx.tokenRef) throw new SyncError("TikTok verisi için influencer'ın hesabını bağlaması gerekiyor (bağlantı linki gönderin).", "NEEDS_OAUTH");
    const token = await vault().get(ctx.tokenRef);
    const j = (await getJson("https://open.tiktokapis.com/v2/user/info/?fields=open_id,follower_count,video_count,likes_count,avatar_url,is_verified,profile_deep_link", {
      headers: { authorization: `Bearer ${token}` },
    })) as { data?: { user?: { open_id: string; follower_count: number; video_count: number; likes_count: number; avatar_url?: string; is_verified?: boolean; profile_deep_link?: string } } };
    const u = j.data?.user;
    if (!u) throw new SyncError("TikTok kullanıcı bilgisi alınamadı.", "API");
    return {
      externalId: u.open_id,
      followers: u.follower_count,
      postsCount: u.video_count,
      avgLikes: u.video_count ? Math.round(u.likes_count / u.video_count) : null,
      avgComments: null,
      avgViews: null,
      engagementRate: u.follower_count && u.video_count ? u.likes_count / u.video_count / u.follower_count : null,
      profileUrl: u.profile_deep_link ?? `https://tiktok.com/@${handle}`,
      avatarUrl: u.avatar_url ?? null,
      verified: !!u.is_verified,
      source: "tiktok_oauth",
    };
  },
};

let override: SocialProvider | undefined;
export function socialProvider(): SocialProvider {
  return override ?? (envStr("SOCIAL_SYNC_MODE", "mock") === "http" ? httpSocial : mockSocial);
}
export function setSocialProvider(p: SocialProvider | undefined) {
  override = p;
}

export type SyncResult = { accountId: string; ok: boolean; message: string; followersBefore?: number; followersAfter?: number };

/** Tek hesabı senkronlar; değişiklik varsa trend için snapshot yazar. Hata hesabın syncError alanına düşer. */
export async function syncSocialAccount(accountId: string, now = new Date()): Promise<SyncResult> {
  const acc = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!acc) return { accountId, ok: false, message: "Hesap bulunamadı." };
  try {
    const s = await socialProvider().fetch(acc.platform, acc.handle, { tokenRef: acc.tokenRef });
    const er = s.engagementRate ?? Number(acc.engagementRate);
    await prisma.$transaction(async (tx) => {
      await tx.socialAccount.update({
        where: { id: acc.id },
        data: {
          followers: s.followers,
          engagementRate: Math.min(9.9999, Math.max(0, er)),
          externalId: s.externalId,
          postsCount: s.postsCount,
          avgLikes: s.avgLikes,
          avgComments: s.avgComments,
          avgViews: s.avgViews,
          profileUrl: s.profileUrl,
          avatarUrl: s.avatarUrl,
          verified: s.verified,
          syncSource: s.source,
          lastSyncedAt: now,
          syncError: null,
        },
      });
      if (s.followers !== acc.followers || Math.abs(er - Number(acc.engagementRate)) > 0.0001) {
        await tx.socialAccountSnapshot.create({
          data: { socialAccountId: acc.id, followers: s.followers, engagementRate: Math.min(9.9999, Math.max(0, er)), demographics: acc.demographics as object, takenAt: now },
        });
      }
    });
    return { accountId, ok: true, message: `Güncellendi: ${s.followers.toLocaleString("tr-TR")} takipçi.`, followersBefore: acc.followers, followersAfter: s.followers };
  } catch (e) {
    const msg = e instanceof SyncError ? e.message : `Senkron hatası: ${(e as Error).message}`.slice(0, 300);
    await prisma.socialAccount.update({ where: { id: acc.id }, data: { syncError: msg, lastSyncedAt: now } });
    return { accountId, ok: false, message: msg };
  }
}

export async function syncInfluencer(influencerId: string) {
  const accounts = await prisma.socialAccount.findMany({ where: { influencerId }, select: { id: true } });
  const out: SyncResult[] = [];
  for (const a of accounts) out.push(await syncSocialAccount(a.id));
  return out;
}

/** Zamanlanmış job: 12 saatten eski hesaplar (en fazla `limit` hesap; API kotası için). */
export async function syncStaleAccounts(limit = 50, now = new Date()) {
  const stale = await prisma.socialAccount.findMany({
    where: { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(now.getTime() - 12 * 3_600_000) } }] },
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
    take: limit,
    select: { id: true },
  });
  let ok = 0;
  for (const a of stale) if ((await syncSocialAccount(a.id, now)).ok) ok++;
  return { checked: stale.length, ok };
}

export const syncSourceLabels: Record<string, string> = {
  manual: "Elle girildi",
  instagram_business_discovery: "Instagram API",
  youtube_data: "YouTube API",
  tiktok_oauth: "TikTok (influencer bağlantısı)",
  mock: "Demo veri (API anahtarı yok)",
};
