"use server";
import { setBrandDefaultMode, setExecutionMode } from "@infulancer/core/domain/campaign-execution";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, str, revalidateAll } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";

function parseMode(v: string): "SELF" | "AJANS" {
  if (v !== "SELF" && v !== "AJANS") throw new DomainError("DOGRULAMA", "Geçersiz çalışma modu.");
  return v;
}

/** Kampanyanın yürütme modunu değiştir (marka: kendi kampanyası; ajans: her kampanya). */
export async function setCampaignModeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const campaignId = str(fd, "campaignId");
    const mode = parseMode(str(fd, "mode"));
    const res = await setExecutionMode(actor, campaignId, mode);
    revalidateAll();
    return {
      ok: true,
      message: !res.changed
        ? "Mod zaten bu."
        : mode === "AJANS"
          ? "Kampanya ajansa devredildi. Ajans influencer ataması ve yayın kontrolünü yapacak."
          : "Kampanyayı kendiniz yürütüyorsunuz. Influencer'ı siz atar ve yayına siz alırsınız.",
    };
  });
}

/** Markanın varsayılan çalışma modu (yeni kampanyalar bununla açılır). */
export async function setBrandDefaultModeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const brandId = actor.role === "BRAND" ? actor.brandId! : str(fd, "brandId");
    const mode = parseMode(str(fd, "mode"));
    await setBrandDefaultMode(actor, brandId, mode);
    revalidateAll();
    return { ok: true, message: mode === "SELF" ? "Varsayılan: kampanyaları kendiniz yürüteceksiniz." : "Varsayılan: kampanyaları ajans yürütecek." };
  });
}
