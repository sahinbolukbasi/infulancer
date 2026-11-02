"use server";

import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, intOrNull, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

const DAY_MS = 24 * 60 * 60 * 1000;

const schema = z.object({
  assetId: z.string().min(1).max(64),
  usageDurationDays: z.number({ error: "Tam sayı girin." }).int().min(0).max(3650).nullable(),
  usageChannel: z.enum(["ORGANIK", "PAID_DAHIL"]).nullable(),
  usageGeography: z.array(z.string().regex(/^[\p{L}\s-]{2,40}$/u, { error: "Bölge adı 2–40 harf olmalı." })).max(30),
});

/**
 * Kullanım hakları (yalnız admin; HAM_DOSYA/TASLAK). Süre, yayından (yoksa bugünden)
 * itibaren usageEndsAt'e çevrilir.
 */
export async function updateUsageRights(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const input = parseInput(
      schema,
      {
        assetId: str(fd, "assetId"),
        usageDurationDays: intOrNull(str(fd, "usageDurationDays")),
        usageChannel: optStr(fd, "usageChannel"),
        usageGeography: [
          ...new Set(
            str(fd, "usageGeography")
              .split(",")
              .map((g) => g.trim().toLocaleUpperCase("tr"))
              .filter(Boolean),
          ),
        ],
      },
      { usageDurationDays: "Kullanım süresi", usageChannel: "Kanal", usageGeography: "Coğrafya" },
    );
    await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: input.assetId },
        select: { id: true, kind: true, createdAt: true, deliverable: { select: { publishedAt: true } } },
      });
      if (!asset) throw new DomainError("BULUNAMADI", "Dosya bulunamadı.");
      if (asset.kind !== "HAM_DOSYA" && asset.kind !== "TASLAK") {
        throw new DomainError("KURAL_IHLALI", "Kullanım hakkı yalnız ham dosya ve taslak içerik için tanımlanır.");
      }
      const start = asset.deliverable?.publishedAt ?? new Date();
      const usageEndsAt = input.usageDurationDays != null ? new Date(start.getTime() + input.usageDurationDays * DAY_MS) : null;
      await tx.asset.update({
        where: { id: asset.id },
        data: {
          usageDurationDays: input.usageDurationDays,
          usageEndsAt,
          usageChannel: input.usageChannel,
          usageGeography: input.usageGeography,
        },
      });
      await audit.append({
        actor: toAuditActor(actor),
        action: "ASSET_USAGE_RIGHTS",
        entityType: "Asset",
        entityId: asset.id,
        data: { ...input, usageEndsAt: usageEndsAt?.toISOString() ?? null },
      });
    });
    revalidateAll();
    return { ok: true, message: "Kullanım hakları kaydedildi." };
  });
}
