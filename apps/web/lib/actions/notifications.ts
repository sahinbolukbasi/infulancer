"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@infulancer/core/db";
import { requireActor } from "@/lib/auth-guard";

const schema = z.object({ id: z.string().min(1).max(64).optional() });

/** Bildirim(ler)i okundu işaretler. id yoksa kullanıcının tüm okunmamışları. */
export async function markNotificationsRead(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const parsed = schema.safeParse({ id: formData.get("id") || undefined });
  if (!parsed.success) return;
  await prisma.notification.updateMany({
    // userId filtresi sahiplik kontrolüdür: başkasının bildirimi etkilenmez.
    where: { userId: actor.userId, readAt: null, ...(parsed.data.id ? { id: parsed.data.id } : {}) },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
