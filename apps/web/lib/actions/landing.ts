"use server";
import { revalidatePath } from "next/cache";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { requireActor } from "@/lib/auth-guard";
import { landingSchema, resetLandingContent, saveLandingContent } from "@/lib/landing-store";

export type LandingSaveResult = { ok: boolean; error?: string; path?: string };

/** Tanıtım sayfası içeriğini kaydeder (yalnız admin); doğrulama hatasında alan yolunu döndürür. */
export async function saveLandingAction(input: unknown): Promise<LandingSaveResult> {
  const actor = await requireActor("ADMIN");
  const parsed = landingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Geçersiz içerik.", path: issue?.path.join(".") };
  }
  await saveLandingContent(parsed.data);
  await audit.append({
    actor: toAuditActor(actor),
    action: "LANDING_UPDATED",
    entityType: "Landing",
    entityId: "landing",
    data: { videos: parsed.data.videos.length, references: parsed.data.references.length, creators: parsed.data.creators.length },
  });
  revalidatePath("/");
  revalidatePath("/admin/tanitim");
  return { ok: true };
}

export async function resetLandingAction(): Promise<LandingSaveResult> {
  const actor = await requireActor("ADMIN");
  await resetLandingContent();
  await audit.append({ actor: toAuditActor(actor), action: "LANDING_RESET", entityType: "Landing", entityId: "landing", data: {} });
  revalidatePath("/");
  revalidatePath("/admin/tanitim");
  return { ok: true };
}
