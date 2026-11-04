"use server";
import { revalidatePath } from "next/cache";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { assertPlatformAdmin, requireActor } from "@/lib/auth-guard";
import { landingSchema, resetLandingContent, saveLandingContent } from "@/lib/landing-store";
import { legalEntitySchema, saveLegalEntity } from "@/lib/legal";
import type { ActionState } from "@/lib/action-state";
import { attempt, parseInput, str } from "@/lib/action-utils";

export type LandingSaveResult = { ok: boolean; error?: string; path?: string };

/** Tanıtım sayfası içeriğini kaydeder (yalnız admin); doğrulama hatasında alan yolunu döndürür. */
export async function saveLandingAction(input: unknown): Promise<LandingSaveResult> {
  const actor = await requireActor("ADMIN");
  assertPlatformAdmin(actor);
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
  assertPlatformAdmin(actor);
  await resetLandingContent();
  await audit.append({ actor: toAuditActor(actor), action: "LANDING_RESET", entityType: "Landing", entityId: "landing", data: {} });
  revalidatePath("/");
  revalidatePath("/admin/tanitim");
  return { ok: true };
}

/** Yasal metinlerdeki veri sorumlusu bilgileri (yalnız admin). */
export async function saveLegalEntityAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  assertPlatformAdmin(actor);
  return attempt(async () => {
    const keys = ["title", "shortName", "mersis", "taxOffice", "taxNumber", "address", "email", "kvkkEmail", "kep", "phone", "updatedAt"] as const;
    const raw = Object.fromEntries(keys.map((k) => [k, str(fd, k)]));
    const input = parseInput(legalEntitySchema, raw, { title: "Ticari unvan", address: "Adres", email: "E-posta", kvkkEmail: "KVKK e-postası" });
    await saveLegalEntity(input);
    await audit.append({ actor: toAuditActor(actor), action: "LEGAL_ENTITY_UPDATED", entityType: "Landing", entityId: "legal", data: { title: input.title } });
    for (const p of ["/gizlilik", "/kvkk", "/cerez-politikasi", "/kullanim-kosullari"]) revalidatePath(p);
    return { ok: true, message: "Şirket bilgileri yasal metinlere işlendi." };
  });
}
