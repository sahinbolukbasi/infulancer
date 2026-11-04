"use server";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { runTracker, TRACKER_KEYS, TRACKER_TEMPLATES, trackerSettings, type TrackerTemplateKey } from "@infulancer/core/agents/trackers";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

async function targetName(scope: string, id: string): Promise<string | null> {
  if (scope === "CAMPAIGN") return (await prisma.campaign.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  if (scope === "INFLUENCER") return (await prisma.influencer.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  return (await prisma.brand.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
}

const createSchema = z.object({
  template: z.enum(TRACKER_KEYS as [TrackerTemplateKey, ...TrackerTemplateKey[]]),
  targetId: z.string().min(1, { error: "Takip edilecek kaydı seçin." }).max(64),
  name: z.string().trim().max(120).nullable(),
  notifyBrand: z.boolean(),
  notifyInfluencer: z.boolean(),
});

/** Şablondan takip agent'ı kurar (ör. "Story takibi" → kampanya seç → kur). */
export async function createTrackerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(createSchema, {
      template: str(fd, "template"),
      targetId: str(fd, "targetId"),
      name: optStr(fd, "name"),
      notifyBrand: bool(fd, "notifyBrand"),
      notifyInfluencer: bool(fd, "notifyInfluencer"),
    });
    const tpl = TRACKER_TEMPLATES[input.template];
    const tName = await targetName(tpl.scope, input.targetId);
    if (!tName) throw new DomainError("BULUNAMADI", "Seçilen kayıt bulunamadı.");
    const dup = await prisma.trackerAgent.findFirst({ where: { template: input.template, targetId: input.targetId }, select: { id: true } });
    if (dup) throw new DomainError("DOGRULAMA", "Bu kayıt için aynı şablonda bir takipçi zaten var.");
    const settings: Record<string, number> = {};
    for (const k of Object.keys(tpl.defaults)) {
      const v = str(fd, `s_${k}`);
      if (v) settings[k] = Number(v.replace(",", "."));
    }
    const t = await prisma.trackerAgent.create({
      data: {
        name: input.name || `${tpl.title} · ${tName}`.slice(0, 120),
        template: input.template,
        scope: tpl.scope,
        targetId: input.targetId,
        settings: trackerSettings(input.template, settings),
        notifyBrand: input.notifyBrand,
        notifyInfluencer: input.notifyInfluencer,
        createdById: actor.userId,
      },
    });
    await audit.append({ actor: toAuditActor(actor), action: "TRACKER_CREATED", entityType: "TrackerAgent", entityId: t.id, data: { template: t.template, targetId: t.targetId } });
    await runTracker(t.id).catch(() => null);
    revalidateAll();
    return { ok: true, message: "Takipçi kuruldu ve ilk kontrol yapıldı." };
  });
}

const idSchema = z.object({ id: z.string().min(1).max(64), op: z.enum(["toggle", "run", "delete"]) });
/** Takipçi aç/kapat, şimdi çalıştır, sil. */
export async function trackerOpAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const { id, op } = parseInput(idSchema, { id: str(fd, "id"), op: str(fd, "op") });
    const t = await prisma.trackerAgent.findUnique({ where: { id }, select: { id: true, enabled: true } });
    if (!t) throw new DomainError("BULUNAMADI", "Takipçi bulunamadı.");
    let message = "";
    if (op === "toggle") {
      await prisma.trackerAgent.update({ where: { id }, data: { enabled: !t.enabled } });
      message = t.enabled ? "Takipçi durduruldu." : "Takipçi açıldı.";
    } else if (op === "run") {
      const r = await runTracker(id);
      message = `${r.findings} bulgu (${r.fresh} yeni).`;
    } else {
      await prisma.trackerAgent.delete({ where: { id } });
      message = "Takipçi silindi.";
    }
    await audit.append({ actor: toAuditActor(actor), action: `TRACKER_${op.toUpperCase()}`, entityType: "TrackerAgent", entityId: id, data: {} });
    revalidateAll();
    return { ok: true, message };
  });
}
