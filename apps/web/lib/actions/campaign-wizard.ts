"use server";
import { redirect } from "next/navigation";
import type { Actor } from "@infulancer/core/access/actor";
import {
  createDraft,
  saveDraftBrief,
  submitDraft,
  updateAudience,
  updateBasics,
  updateContentPlan,
  updateSchedule,
  updateShortlist,
} from "@infulancer/core/domain/campaign-draft";
import { nextStep, type WizardStepKey } from "@infulancer/core/domain/campaign-plan";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, intOrNull, lines, optStr, revalidateAll, str, tags, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { AGENCY_TZ, isDay, zonedToUtc } from "@/lib/time";
import { wizardBase } from "@/lib/campaign-wizard-paths";

/**
 * Kampanya sihirbazı adımları (marka ve ajans). Her adım kendi formunda kaydedilir:
 *  - "Kaydet ve devam" (intent boş) → sonraki adım
 *  - "Taslağı kaydet" (intent=stay) → aynı adımda kalır, kaydedildi mesajı
 * Kurallar core/domain/campaign-draft.ts'te (yetki, marka yalnız kendi TASLAK kampanyası).
 */
async function actor() {
  return requireActor("ADMIN", "BRAND");
}

/** Kayıt sonrası yönlendirme: kal / sonraki adım. redirect attempt() dışında çağrılır. */
async function finish(a: Actor, id: string, step: WizardStepKey, fd: FormData, res: ActionState): Promise<ActionState> {
  if (!res.ok) return res;
  revalidateAll();
  if (str(fd, "intent") === "stay") return { ok: true, message: "Taslak kaydedildi." };
  const next = nextStep(step);
  redirect(`${wizardBase(a.role, id)}?adim=${next ?? "ozet"}`);
}

export async function wizardBasicsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  let id = optStr(fd, "id");
  const res = await attempt(async () => {
    const input = { name: str(fd, "name"), objective: str(fd, "objective"), description: optStr(fd, "description") };
    if (id) await updateBasics(a, id, input);
    else id = (await createDraft(a, { ...input, brandId: optStr(fd, "brandId") })).id;
    return { ok: true };
  });
  if (!id) return res;
  return finish(a, id, "temel", fd, res);
}

export async function wizardAudienceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  const id = str(fd, "id");
  const age = (k: string) => {
    const n = intOrNull(str(fd, k));
    return n == null || Number.isNaN(n) ? null : n;
  };
  const res = await attempt(async () => {
    await updateAudience(a, id, {
      targetCountries: fd.getAll("targetCountries").map(String),
      platforms: fd.getAll("platforms").map(String),
      audienceAgeMin: age("audienceAgeMin"),
      audienceAgeMax: age("audienceAgeMax"),
      audienceGender: optStr(fd, "audienceGender"),
      audienceInterests: tags(str(fd, "audienceInterests").replace(/#/g, "")).slice(0, 15),
    });
    return { ok: true };
  });
  return finish(a, id, "kitle", fd, res);
}

export async function wizardScheduleAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  const id = str(fd, "id");
  const res = await attempt(async () => {
    const s = str(fd, "startsAt");
    const e = str(fd, "endsAt");
    if (!isDay(s) || !isDay(e)) throw new DomainError("DOGRULAMA", "Başlangıç ve bitiş tarihini girin.");
    const fee = tlToKurus(str(fd, "brandTotalFee"));
    if (!Number.isFinite(fee)) throw new DomainError("DOGRULAMA", "Toplam bütçe: geçerli bir tutar girin (ör. 250.000).");
    const budgetRaw = str(fd, "budget");
    const budget = budgetRaw ? tlToKurus(budgetRaw) : null;
    if (budget != null && !Number.isFinite(budget)) throw new DomainError("DOGRULAMA", "Influencer bütçesi: geçerli bir tutar girin.");
    await updateSchedule(a, id, { startsAt: zonedToUtc(s, "00:00", AGENCY_TZ), endsAt: zonedToUtc(e, "23:59", AGENCY_TZ), brandTotalFeeKurus: fee, budgetKurus: budget });
    return { ok: true };
  });
  return finish(a, id, "butce", fd, res);
}

export async function wizardContentPlanAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  const id = str(fd, "id");
  const res = await attempt(async () => {
    let plan: unknown;
    try {
      plan = JSON.parse(str(fd, "plan") || "[]");
    } catch {
      throw new DomainError("DOGRULAMA", "İçerik planı okunamadı.");
    }
    await updateContentPlan(a, id, plan);
    return { ok: true };
  });
  return finish(a, id, "icerik", fd, res);
}

export async function wizardBriefAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  const id = str(fd, "id");
  const res = await attempt(async () => {
    // Brief değişmediyse yeni sürüm açma (yalnız ilerle).
    if (str(fd, "unchanged") === "1" && str(fd, "intent") !== "stay") return { ok: true };
    await saveDraftBrief(a, id, {
      text: str(fd, "text"),
      dos: lines(str(fd, "dos")),
      donts: lines(str(fd, "donts")),
      hashtags: tags(str(fd, "hashtags")).map((h) => (h.startsWith("#") ? h : `#${h}`)),
      mentions: tags(str(fd, "mentions")).map((m) => (m.startsWith("@") ? m : `@${m}`)),
      disclosureRequired: bool(fd, "disclosureRequired"),
    });
    return { ok: true };
  });
  return finish(a, id, "brief", fd, res);
}

/** Medya adımı: dosyalar yüklendiği anda kaydedilir; bu form yalnız ilerletir. */
export async function wizardMediaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  const id = str(fd, "id");
  return finish(a, id, "medya", fd, { ok: true });
}

export async function wizardInfluencersAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  const id = str(fd, "id");
  const res = await attempt(async () => {
    const ids = fd.getAll("influencerIds").map(String).filter(Boolean);
    const n = await updateShortlist(a, id, ids);
    return { ok: true, message: `${n} influencer kaydedildi.` };
  });
  return finish(a, id, "influencer", fd, res);
}

/** Son adım: marka → ajansa gönder; ajans → kuruluma (bedel, atama, yayın kontrolü) geç. */
export async function wizardSubmitAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const a = await actor();
  const id = str(fd, "id");
  const res = await attempt(async () => {
    const r = await submitDraft(a, id);
    return { ok: true, data: { mode: r.mode } };
  });
  if (!res.ok) return res;
  revalidateAll();
  const mode = (res.data as { mode?: string } | undefined)?.mode;
  if (a.role === "BRAND") {
    // SELF: marka kendi kurulumuna geçer; AJANS: ajansa gönderildi onayı.
    redirect(mode === "SELF" ? `/marka/kampanyalar/${id}/kurulum?adim=influencerlar` : `/marka/kampanyalar/${id}?gonderildi=1`);
  }
  redirect(`/admin/kampanyalar/${id}/kurulum?adim=influencerlar`);
}
