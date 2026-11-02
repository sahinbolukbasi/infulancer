"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma, type Platform } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";
import { platformLabels } from "@infulancer/core/domain/labels";
import { publish } from "@infulancer/core/events";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, intOrNull, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { isValidTimeZone } from "@/lib/time";

const PLATFORMS: Platform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE"];

const influencerSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(60),
  iban: z.string().regex(/^TR\d{24}$/, { error: "TR ile başlayan 26 karakterlik IBAN girin." }),
  ibanHolder: z.string().min(2).max(120),
  taxStatus: z.enum(["FATURA", "SERBEST_MESLEK_MAKBUZU", "STOPAJLI"]),
  canIssueInvoice: z.enum(["true", "false"], { error: "Fatura kesebilir mi? seçimi zorunlu." }),
  audienceTimezone: z.string().refine(isValidTimeZone, { error: "Geçerli bir IANA saat dilimi seçin." }),
});

const labels: Record<string, string> = {
  name: "Ad soyad",
  category: "Kategori",
  iban: "IBAN",
  ibanHolder: "Hesap sahibi",
  taxStatus: "Vergi durumu",
  canIssueInvoice: "Fatura kesebilir mi?",
  audienceTimezone: "Kitle saat dilimi",
};

const demographicsSchema = z.record(z.string(), z.unknown());

type AccountInput = { platform: Platform; handle: string; followers: number; engagementRate: number; demographics: Record<string, unknown> };

function parseAccounts(fd: FormData): AccountInput[] {
  const out: AccountInput[] = [];
  for (const platform of PLATFORMS) {
    const p = `acc_${platform}_`;
    if (!bool(fd, `${p}enabled`)) continue;
    const label = platformLabels[platform];
    const handle = str(fd, `${p}handle`);
    if (!/^@?[\w.\-]{2,60}$/u.test(handle)) throw new DomainError("DOGRULAMA", `${label}: geçerli bir kullanıcı adı girin.`);
    const followers = intOrNull(str(fd, `${p}followers`));
    if (followers == null || Number.isNaN(followers) || followers < 0) {
      throw new DomainError("DOGRULAMA", `${label}: takipçi sayısı pozitif tam sayı olmalı.`);
    }
    const erRaw = str(fd, `${p}er`).replace(",", ".");
    const erPct = Number(erRaw);
    if (erRaw === "" || !Number.isFinite(erPct) || erPct < 0 || erPct > 100) {
      throw new DomainError("DOGRULAMA", `${label}: etkileşim oranı 0–100 arası yüzde olmalı.`);
    }
    const demoRaw = str(fd, `${p}demographics`) || "{}";
    let demographics: Record<string, unknown>;
    try {
      const parsed = demographicsSchema.safeParse(JSON.parse(demoRaw));
      if (!parsed.success) throw new Error("shape");
      demographics = parsed.data;
    } catch {
      throw new DomainError("DOGRULAMA", `${label}: demografi alanı geçerli bir JSON nesnesi olmalı (ör. {"kadin": 0.7}).`);
    }
    out.push({
      platform,
      handle: handle.startsWith("@") ? handle : `@${handle}`,
      followers,
      engagementRate: Math.round(erPct * 100) / 10000,
      demographics,
    });
  }
  return out;
}

/** Influencer oluşturur ya da günceller; hesaplar platform başına tektir. */
export async function saveInfluencer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  const id = optStr(fd, "id");
  const created: { id?: string } = {};
  const res = await attempt(async () => {
    const input = parseInput(
      influencerSchema,
      {
        name: str(fd, "name"),
        category: str(fd, "category").toLocaleLowerCase("tr"),
        iban: str(fd, "iban").replace(/\s/g, "").toUpperCase(),
        ibanHolder: str(fd, "ibanHolder"),
        taxStatus: str(fd, "taxStatus"),
        canIssueInvoice: str(fd, "canIssueInvoice"),
        audienceTimezone: str(fd, "audienceTimezone"),
      },
      labels,
    );
    const accounts = parseAccounts(fd);
    const userEmail = optStr(fd, "userEmail")?.toLowerCase() ?? null;
    const userPassword = str(fd, "userPassword");
    if (!id && userEmail) {
      if (!z.email().safeParse(userEmail).success) throw new DomainError("DOGRULAMA", "Kullanıcı e-postası geçersiz.");
      if (userPassword.length < 8) throw new DomainError("DOGRULAMA", "Geçici şifre en az 8 karakter olmalı.");
    }
    const passwordHash = !id && userEmail ? await bcrypt.hash(userPassword, 10) : null;
    const data = { ...input, canIssueInvoice: input.canIssueInvoice === "true" };

    await prisma.$transaction(async (tx) => {
      let influencerId: string;
      if (id) {
        const exists = await tx.influencer.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new DomainError("BULUNAMADI", "Influencer bulunamadı.");
        await tx.influencer.update({ where: { id }, data });
        influencerId = id;
      } else {
        influencerId = (await tx.influencer.create({ data })).id;
        created.id = influencerId;
      }

      const existing = await tx.socialAccount.findMany({ where: { influencerId } });
      const now = new Date();
      for (const acc of accounts) {
        const prev = existing.find((e) => e.platform === acc.platform);
        const values = {
          handle: acc.handle,
          followers: acc.followers,
          engagementRate: acc.engagementRate,
          demographics: acc.demographics as object,
        };
        const saved = prev
          ? await tx.socialAccount.update({ where: { id: prev.id }, data: values })
          : await tx.socialAccount.create({ data: { influencerId, platform: acc.platform, ...values } });
        // ER/takipçi trendi için değişiklikte geçmiş kaydı.
        if (!prev || prev.followers !== acc.followers || Number(prev.engagementRate) !== acc.engagementRate) {
          await tx.socialAccountSnapshot.create({
            data: {
              socialAccountId: saved.id,
              followers: acc.followers,
              engagementRate: acc.engagementRate,
              demographics: acc.demographics as object,
              takenAt: now,
            },
          });
        }
      }
      const removed = existing.filter((e) => !accounts.some((a) => a.platform === e.platform));
      if (removed.length) await tx.socialAccount.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });

      if (!id && userEmail && passwordHash) {
        await tx.user.create({
          data: { email: userEmail, name: input.name, role: "INFLUENCER", influencerId, passwordHash },
        });
      }
      await audit.append({
        actor: toAuditActor(actor),
        action: id ? "INFLUENCER_UPDATED" : "INFLUENCER_CREATED",
        entityType: "Influencer",
        entityId: influencerId,
        // IBAN audit'e maskeli yazılır.
        data: {
          ...input,
          iban: `${input.iban.slice(0, 4)}…${input.iban.slice(-4)}`,
          accounts: accounts.map((a) => ({ platform: a.platform, handle: a.handle, followers: a.followers })),
          userEmail: !id ? userEmail : undefined,
        },
      });
    });
    if (created.id) await publish({ type: "INFLUENCER_CREATED", influencerId: created.id });
    revalidateAll();
    return { ok: true, message: "Influencer kaydedildi." };
  });
  if (res.ok && created.id) redirect(`/admin/influencerlar/${created.id}/duzenle`);
  return res;
}
