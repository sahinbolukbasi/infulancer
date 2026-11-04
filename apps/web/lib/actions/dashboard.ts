"use server";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth-guard";
import { layoutSchema, saveDashboardLayoutFor } from "@/lib/dashboard";

/** Kullanıcının genel bakış düzenini kaydeder (sıra + gizlenen alanlar). */
export async function saveDashboardLayout(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("ADMIN");
  const parsed = layoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Geçersiz düzen." };
  await saveDashboardLayoutFor(actor.userId, parsed.data);
  revalidatePath("/admin");
  return { ok: true };
}
