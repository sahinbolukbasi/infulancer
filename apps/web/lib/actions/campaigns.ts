"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { targetsSchema } from "@infulancer/core/domain/campaign-score";
import { assertCampaignCanGoLive, CampaignGateError } from "@infulancer/core/compliance/disclosure";
import { DomainError } from "@infulancer/core/domain/errors";
import { utmSafe } from "@infulancer/core/domain/utm";
import { publish } from "@infulancer/core/events";
import { ensureCampaignTrackers } from "@infulancer/core/agents/trackers";
import type { ActionState } from "@/lib/action-state";
import { attempt, optStr, parseInput, revalidateAll, str, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { AGENCY_TZ, isDay, zonedToUtc } from "@/lib/time";

const campaignSchema = z
  .object({
    brandId: z.string().min(1, { error: "Marka seçin." }).max(64),
    name: z.string().min(3).max(140),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/, { error: "Küçük harf, rakam ve tire kullanın." }),
    budgetKurus: z.number({ error: "Geçerli bir tutar girin." }).int().nonnegative(),
    brandTotalFeeKurus: z.number({ error: "Geçerli bir tutar girin." }).int().nonnegative(),
    startsAt: z.string().refine(isDay, { error: "Geçerli bir tarih girin." }),
    endsAt: z.string().refine(isDay, { error: "Geçerli bir tarih girin." }),
    status: z.enum(["TASLAK", "AKTIF", "IPTAL"], { error: "Durum seçin (kapatma için 'Kampanyayı kapat' kullanın)." }),
    targets: targetsSchema,
  })
  .refine((v) => v.endsAt >= v.startsAt, { error: "Bitiş tarihi başlangıçtan önce olamaz.", path: ["endsAt"] });

const labels: Record<string, string> = {
  brandId: "Marka",
  name: "Kampanya adı",
  slug: "Kısa ad",
  budgetKurus: "Bütçe",
  brandTotalFeeKurus: "Markadan alınan toplam bedel",
  startsAt: "Başlangıç",
  endsAt: "Bitiş",
  status: "Durum",
  targets: "Hedefler",
};

function slugify(v: string): string {
  return utmSafe(v).replace(/[._]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

async function uniqueSlug(base: string, excludeId: string | null): Promise<string> {
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const clash = await prisma.campaign.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  throw new DomainError("DOGRULAMA", "Benzersiz kısa ad üretilemedi.");
}

function parseTargetsJson(raw: string): unknown {
  try {
    const arr = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(arr)) return arr;
    return arr.map((t: Record<string, unknown>) => ({
      kpi: t.kpi,
      target: Number(String(t.target ?? "").replace(",", ".")),
      weight: Number(String(t.weight ?? "").replace(",", ".")),
      windowDays: Number(t.windowDays),
    }));
  } catch {
    return null;
  }
}

/** Kampanya oluşturur/günceller. KAPANDI durumu yalnız closeCampaign ile verilir. */
export async function saveCampaign(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  const id = optStr(fd, "id");
  const created: { id?: string } = {};
  const res = await attempt(async () => {
    const name = str(fd, "name");
    const raw = {
      brandId: str(fd, "brandId"),
      name,
      slug: slugify(str(fd, "slug") || name),
      budgetKurus: tlToKurus(str(fd, "budget")),
      brandTotalFeeKurus: tlToKurus(str(fd, "brandTotalFee")),
      startsAt: str(fd, "startsAt"),
      endsAt: str(fd, "endsAt"),
      status: str(fd, "status"),
      targets: parseTargetsJson(str(fd, "targets")),
    };
    const input = parseInput(campaignSchema, raw, labels);
    const existing = id ? await prisma.campaign.findUnique({ where: { id }, select: { status: true } }) : null;
    if (id && !existing) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
    if (existing?.status === "KAPANDI") throw new DomainError("KURAL_IHLALI", "Kapanmış kampanya düzenlenemez.");
    const brand = await prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true } });
    if (!brand) throw new DomainError("DOGRULAMA", "Marka bulunamadı.");
    // md. 23/A: etiketsiz veya kullanım hakkı tanımsız içerikle kampanya canlıya alınamaz (BLOK).
    if (input.status === "AKTIF" && existing?.status !== "AKTIF") {
      if (!id) throw new DomainError("KURAL_IHLALI", "Kampanyayı önce taslak olarak kaydedin; içerikler md. 23/A kontrolünden geçtikten sonra aktif yapılabilir.");
      try {
        await assertCampaignCanGoLive(id);
      } catch (e) {
        if (e instanceof CampaignGateError) {
          const first = e.details[0];
          throw new DomainError("KURAL_IHLALI", `${e.message}${first ? ` İlk sorun: ${first.issues[0]}` : ""}`);
        }
        throw e;
      }
    }
    const slug = await uniqueSlug(input.slug, id);
    const data = {
      ...input,
      slug,
      startsAt: zonedToUtc(input.startsAt, "00:00", AGENCY_TZ),
      endsAt: zonedToUtc(input.endsAt, "23:59", AGENCY_TZ),
    };
    await prisma.$transaction(async (tx) => {
      const campaign = id
        ? await tx.campaign.update({ where: { id }, data })
        : await tx.campaign.create({ data });
      if (!id) created.id = campaign.id;
      await audit.append({
        actor: toAuditActor(actor),
        action: id ? "CAMPAIGN_UPDATED" : "CAMPAIGN_CREATED",
        entityType: "Campaign",
        entityId: campaign.id,
        data: { ...input, slug },
      });
    });
    // Yeni kampanyaya varsayılan takip agent'ları (kampanya + story) eklenir.
    if (created.id) await ensureCampaignTrackers(created.id, input.name, actor.userId).catch(() => 0);
    revalidateAll();
    return { ok: true, message: "Kampanya kaydedildi." };
  });
  // Yeni kampanya kurulum sihirbazına gider (influencer, içerik planı, brief, yayın kontrolü).
  const returnTo = optStr(fd, "returnTo");
  if (res.ok && returnTo && /^\/admin\/kampanyalar\/[a-z0-9]+(\/kurulum(\?adim=[a-z]+)?)?$/.test(returnTo)) redirect(returnTo);
  if (res.ok) redirect(created.id ? `/admin/kampanyalar/${created.id}/kurulum?adim=influencerlar` : `/admin/kampanyalar/${id}`);
  return res;
}

/** AKTIF → KAPANDI: closedAt yazılır, audit + CAMPAIGN_CLOSED olayı. */
export async function closeCampaign(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  const id = str(fd, "id");
  return attempt(async () => {
    await prisma.$transaction(async (tx) => {
      const c = await tx.campaign.findUnique({ where: { id }, select: { status: true } });
      if (!c) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
      if (c.status !== "AKTIF") throw new DomainError("GECERSIZ_GECIS", "Yalnız aktif kampanya kapatılabilir.");
      const closedAt = new Date();
      await tx.campaign.update({ where: { id }, data: { status: "KAPANDI", closedAt } });
      await audit.append({
        actor: toAuditActor(actor),
        action: "CAMPAIGN_CLOSED",
        entityType: "Campaign",
        entityId: id,
        data: { from: "AKTIF", to: "KAPANDI", closedAt: closedAt.toISOString() },
      });
    });
    await publish({ type: "CAMPAIGN_CLOSED", campaignId: id });
    revalidateAll();
    return { ok: true, message: "Kampanya kapatıldı." };
  });
}

/** 'Marka ödemesi alındı' — çekilebilir bakiyenin vade hesabına girer. */
export async function markBrandPaymentReceived(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  const id = str(fd, "id");
  const day = str(fd, "receivedAt");
  return attempt(async () => {
    if (day && !isDay(day)) throw new DomainError("DOGRULAMA", "Geçerli bir tarih girin.");
    const receivedAt = day ? zonedToUtc(day, "12:00", AGENCY_TZ) : new Date();
    if (receivedAt.getTime() > Date.now() + 60_000) throw new DomainError("DOGRULAMA", "Ödeme tarihi gelecekte olamaz.");
    await prisma.$transaction(async (tx) => {
      const c = await tx.campaign.findUnique({ where: { id }, select: { brandPaymentReceivedAt: true } });
      if (!c) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
      if (c.brandPaymentReceivedAt) throw new DomainError("KURAL_IHLALI", "Marka ödemesi zaten işaretlenmiş.");
      await tx.campaign.update({ where: { id }, data: { brandPaymentReceivedAt: receivedAt } });
      await audit.append({
        actor: toAuditActor(actor),
        action: "BRAND_PAYMENT_RECEIVED",
        entityType: "Campaign",
        entityId: id,
        data: { receivedAt: receivedAt.toISOString() },
      });
    });
    revalidateAll();
    return { ok: true, message: "Marka ödemesi alındı olarak işaretlendi." };
  });
}

/** Sihirbazın son adımı: md. 23/A + kullanım hakkı kapısından geçerse kampanyayı AKTIF yapar. */
export async function activateCampaign(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const id = str(fd, "id");
    const c = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
    if (!c) throw new DomainError("BULUNAMADI", "Kampanya bulunamadı.");
    if (c.status !== "TASLAK") throw new DomainError("GECERSIZ_GECIS", "Yalnız taslak kampanya aktif yapılabilir.");
    try {
      await assertCampaignCanGoLive(id);
    } catch (e) {
      if (e instanceof CampaignGateError) throw new DomainError("KURAL_IHLALI", e.message);
      throw e;
    }
    await prisma.$transaction(async (tx) => {
      await tx.campaign.update({ where: { id }, data: { status: "AKTIF" } });
      await audit.append({ actor: toAuditActor(actor), action: "CAMPAIGN_ACTIVATED", entityType: "Campaign", entityId: id, data: { from: "TASLAK", to: "AKTIF" } });
    });
    revalidateAll();
    return { ok: true, message: "Kampanya yayına alındı." };
  });
}
