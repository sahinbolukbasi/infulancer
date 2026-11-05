"use server";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { getConfig, setConfig } from "@infulancer/core/config/store";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { assertPlatformAdmin, requireActor } from "@/lib/auth-guard";

/** Bir modelin lisans/durum ve özellik bayrağını yönetir (yalnız platform yöneticisi). */
export async function updateModelAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  assertPlatformAdmin(actor);
  return attempt(async () => {
    const input = parseInput(
      z.object({ key: z.string().min(2).max(80), license: z.enum(["cleared", "pending", "restricted"]), status: z.enum(["active", "deprecated"]) }),
      { key: str(fd, "key"), license: str(fd, "license"), status: str(fd, "status") },
    );
    const m = await prisma.modelRegistry.findUnique({ where: { key: input.key }, select: { key: true } });
    if (!m) throw new DomainError("BULUNAMADI", "Model bulunamadı.");
    await prisma.modelRegistry.update({ where: { key: input.key }, data: { licenseStatus: input.license, status: input.status } });
    await audit.append({ actor: toAuditActor(actor), action: "MODEL_UPDATED", entityType: "ModelRegistry", entityId: input.key, data: input });
    revalidateAll();
    return { ok: true, message: `${input.key} güncellendi.` };
  });
}

/** Özellik bayraklarını açıp kapatır (ör. creative.bedrockImage, creative.flux). */
export async function toggleFeatureAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  assertPlatformAdmin(actor);
  return attempt(async () => {
    const flag = str(fd, "flag");
    const on = bool(fd, "on");
    const features = { ...(await getConfig("features")) };
    if (!(flag in features)) throw new DomainError("BULUNAMADI", "Bilinmeyen özellik.");
    features[flag] = on;
    await setConfig("features", features, true);
    await audit.append({ actor: toAuditActor(actor), action: "FEATURE_TOGGLED", entityType: "Config", entityId: flag, data: { on } });
    revalidateAll();
    return { ok: true, message: `${flag} ${on ? "açıldı" : "kapatıldı"}.` };
  });
}
