"use server";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const URL_RE = /^https:\/\/(www\.|m\.|vm\.|vt\.)?(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)\/[^\s"'<>]+$/i;
const platformOf = (url: string) => (/tiktok\.com/i.test(url) ? "TIKTOK" : /youtu/i.test(url) ? "YOUTUBE" : "INSTAGRAM") as "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
const MAX_ITEMS = 24;

/** Vitrin ayarları: başlık, biyografi ve markalara görünürlük tercihleri. */
export async function saveShowcaseAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("INFLUENCER");
  return attempt(async () => {
    const input = parseInput(
      z.object({ headline: z.string().trim().max(120).nullable(), bio: z.string().trim().max(1500).nullable(), showcaseVisible: z.boolean(), showPrices: z.boolean(), showCollaborations: z.boolean() }),
      { headline: optStr(fd, "headline"), bio: optStr(fd, "bio"), showcaseVisible: bool(fd, "showcaseVisible"), showPrices: bool(fd, "showPrices"), showCollaborations: bool(fd, "showCollaborations") },
      { headline: "Başlık", bio: "Hakkımda" },
    );
    await prisma.influencer.update({ where: { id: actor.influencerId! }, data: input });
    await audit.append({ actor: toAuditActor(actor), action: "SHOWCASE_UPDATED", entityType: "Influencer", entityId: actor.influencerId!, data: { showcaseVisible: input.showcaseVisible, showPrices: input.showPrices, showCollaborations: input.showCollaborations } });
    revalidateAll();
    return { ok: true, message: "Vitrin güncellendi." };
  });
}

/** Öne çıkan iş ekler: elle bağlantı veya platformdaki yayınlanmış bir işten. */
export async function addPortfolioAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("INFLUENCER");
  return attempt(async () => {
    const influencerId = actor.influencerId!;
    if ((await prisma.portfolioItem.count({ where: { influencerId } })) >= MAX_ITEMS) throw new DomainError("KURAL_IHLALI", `En fazla ${MAX_ITEMS} iş öne çıkarılabilir.`);
    const deliverableId = optStr(fd, "deliverableId");
    let data: { title: string; url: string; platform: "INSTAGRAM" | "TIKTOK" | "YOUTUBE"; brandName: string | null; note: string | null; deliverableId: string | null };
    if (deliverableId) {
      const d = await prisma.deliverable.findFirst({
        where: { id: deliverableId, assignment: { influencerId }, postUrl: { not: null } },
        select: { postUrl: true, platform: true, contentType: true, assignment: { select: { campaign: { select: { name: true, brand: { select: { name: true } } } } } } },
      });
      if (!d?.postUrl) throw new DomainError("BULUNAMADI", "Yayın bağlantısı olan bir iş seçin.");
      if (await prisma.portfolioItem.findFirst({ where: { influencerId, deliverableId }, select: { id: true } })) throw new DomainError("DOGRULAMA", "Bu iş zaten vitrinde.");
      data = { title: d.assignment.campaign.name, url: d.postUrl, platform: d.platform, brandName: d.assignment.campaign.brand.name, note: null, deliverableId };
    } else {
      const input = parseInput(
        z.object({ title: z.string().trim().min(2).max(120), url: z.string().trim().max(1000).refine((v) => URL_RE.test(v), { error: "Instagram, TikTok veya YouTube bağlantısı girin (https://…)." }), brandName: z.string().trim().max(80).nullable(), note: z.string().trim().max(300).nullable() }),
        { title: str(fd, "title"), url: str(fd, "url"), brandName: optStr(fd, "brandName"), note: optStr(fd, "note") },
        { title: "Başlık", url: "Bağlantı", brandName: "Marka" },
      );
      data = { ...input, platform: platformOf(input.url), deliverableId: null };
    }
    const last = await prisma.portfolioItem.findFirst({ where: { influencerId }, orderBy: { sort: "desc" }, select: { sort: true } });
    const item = await prisma.portfolioItem.create({ data: { influencerId, ...data, sort: (last?.sort ?? -1) + 1 } });
    await audit.append({ actor: toAuditActor(actor), action: "PORTFOLIO_ADDED", entityType: "PortfolioItem", entityId: item.id, data: { url: item.url } });
    revalidateAll();
    return { ok: true, message: "Vitrine eklendi." };
  });
}

/** Sil / yukarı / aşağı. */
export async function portfolioOpAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("INFLUENCER");
  return attempt(async () => {
    const { id, op } = parseInput(z.object({ id: z.string().min(1).max(64), op: z.enum(["delete", "up", "down"]) }), { id: str(fd, "id"), op: str(fd, "op") });
    const influencerId = actor.influencerId!;
    const items = await prisma.portfolioItem.findMany({ where: { influencerId }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }], select: { id: true } });
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) throw new DomainError("BULUNAMADI", "Kayıt bulunamadı.");
    if (op === "delete") {
      await prisma.portfolioItem.delete({ where: { id } });
    } else {
      const j = op === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= items.length) return { ok: true, message: "" };
      const order = items.map((x) => x.id);
      [order[i], order[j]] = [order[j]!, order[i]!];
      await prisma.$transaction(order.map((oid, k) => prisma.portfolioItem.update({ where: { id: oid }, data: { sort: k } })));
    }
    revalidateAll();
    return { ok: true, message: op === "delete" ? "Kaldırıldı." : "Sıra güncellendi." };
  });
}
