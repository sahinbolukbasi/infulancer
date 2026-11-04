import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { audit } from "../audit";
import { requireRole, toAuditActor, type Actor } from "./actor";
import { DomainError } from "../domain/errors";
import { setBrandCategories, setInfluencerCategories } from "../domain/categories";
import type { Role } from "../generated/prisma/enums";

/**
 * Davetle kayıt. Kayıt yalnız geçerli bir davet koduyla (özel link: /kayit?kod=...) yapılır; kayıt olan
 * kullanıcı PENDING durumunda girer, yalnız "üyeliğiniz onay bekliyor" ekranını görür. Admin onaylayınca
 * influencer/marka profili oluşturulur ve kullanıcı ACTIVE olur.
 * - Admin: influencer veya marka daveti üretir.
 * - Influencer: yalnız influencer daveti üretir (aynı anda en fazla 5 aktif davet, davet başına ≤ 3 kullanım, ≤ 30 gün).
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışan karakterler yok (0/O, 1/I)
export const INFLUENCER_INVITE_LIMITS = { active: 5, maxUses: 3, maxDays: 30 };

export function generateInviteCode(len = 10): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

export async function createInvite(actorIn: Actor, input: { targetRole: Role; maxUses?: number; expiresInDays?: number; note?: string | null }) {
  const actor = requireRole(actorIn, "ADMIN", "INFLUENCER");
  if (input.targetRole === "ADMIN") throw new DomainError("YETKISIZ", "Admin daveti oluşturulamaz.");
  let maxUses = Math.max(1, Math.min(input.maxUses ?? 1, 500));
  let days = Math.max(1, Math.min(input.expiresInDays ?? 14, 365));
  if (actor.role === "INFLUENCER") {
    if (input.targetRole !== "INFLUENCER") throw new DomainError("YETKISIZ", "Influencer yalnız influencer davet edebilir.");
    const active = await prisma.invite.count({ where: { createdById: actor.userId, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (active >= INFLUENCER_INVITE_LIMITS.active) throw new DomainError("KURAL_IHLALI", `Aynı anda en fazla ${INFLUENCER_INVITE_LIMITS.active} aktif davetiniz olabilir.`);
    maxUses = Math.min(maxUses, INFLUENCER_INVITE_LIMITS.maxUses);
    days = Math.min(days, INFLUENCER_INVITE_LIMITS.maxDays);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const inv = await prisma.invite.create({
        data: {
          code: generateInviteCode(),
          targetRole: input.targetRole,
          createdById: actor.userId,
          inviterInfluencerId: actor.role === "INFLUENCER" ? actor.influencerId : null,
          maxUses,
          expiresAt: new Date(Date.now() + days * 86_400_000),
          note: input.note?.slice(0, 200) ?? null,
        },
      });
      await audit.append({ actor: toAuditActor(actor), action: "INVITE_CREATED", entityType: "Invite", entityId: inv.id, data: { targetRole: inv.targetRole, maxUses, days } });
      return inv;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("Davet kodu üretilemedi");
}

export async function revokeInvite(actorIn: Actor, inviteId: string) {
  const actor = requireRole(actorIn, "ADMIN", "INFLUENCER");
  const inv = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!inv || (actor.role !== "ADMIN" && inv.createdById !== actor.userId)) throw new DomainError("BULUNAMADI", "Davet bulunamadı.");
  await prisma.invite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
  await audit.append({ actor: toAuditActor(actor), action: "INVITE_REVOKED", entityType: "Invite", entityId: inviteId, data: {} });
}

export type InviteCheck = { ok: true; invite: { id: string; code: string; targetRole: Role; inviterName: string | null } } | { ok: false; reason: string };

export async function checkInvite(rawCode: string, now = new Date()): Promise<InviteCheck> {
  const code = normalizeCode(rawCode);
  if (code.length < 6) return { ok: false, reason: "Geçerli bir davet kodu girin." };
  const inv = await prisma.invite.findUnique({ where: { code }, include: { createdBy: { select: { name: true, role: true } } } });
  // Neden geçersiz olduğu kodun varlığını sızdırmasın diye tek mesaj.
  if (!inv || inv.revokedAt || inv.expiresAt <= now || inv.uses >= inv.maxUses) return { ok: false, reason: "Davet kodu geçersiz, süresi dolmuş veya kullanım hakkı bitmiş." };
  return { ok: true, invite: { id: inv.id, code: inv.code, targetRole: inv.targetRole, inviterName: inv.createdBy.role === "INFLUENCER" ? inv.createdBy.name : null } };
}

export type InfluencerApplication = { kind: "INFLUENCER"; city?: string; categoryIds: string[]; instagram?: string; tiktok?: string; youtube?: string; about?: string };
export type BrandApplication = { kind: "BRAND"; companyName: string; taxOffice: string; taxNumber: string; categoryIds: string[]; website?: string; about?: string };

export type RegisterInput = {
  code: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  acceptTerms: boolean;
  application: InfluencerApplication | BrandApplication;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HANDLE_RE = /^@?[\w.\-]{2,60}$/u;

export async function registerWithInvite(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new DomainError("DOGRULAMA", "Geçerli bir e-posta girin.");
  if (input.password.length < 10) throw new DomainError("DOGRULAMA", "Şifre en az 10 karakter olmalı.");
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(input.password) || !/\d/.test(input.password)) throw new DomainError("DOGRULAMA", "Şifre harf ve rakam içermeli.");
  const name = input.name.trim();
  if (name.length < 3 || name.length > 80) throw new DomainError("DOGRULAMA", "Ad soyad 3–80 karakter olmalı.");
  const phone = input.phone.replace(/[^\d+]/g, "");
  if (!/^\+?\d{10,15}$/.test(phone)) throw new DomainError("DOGRULAMA", "Geçerli bir telefon numarası girin.");
  if (!input.acceptTerms) throw new DomainError("DOGRULAMA", "Kullanım koşulları ve gizlilik politikasını kabul etmelisiniz.");
  const a = input.application;
  if (!a.categoryIds.length || a.categoryIds.length > 8) throw new DomainError("DOGRULAMA", "1–8 kategori seçin.");
  const cats = await prisma.category.count({ where: { id: { in: a.categoryIds }, active: true } });
  if (cats !== new Set(a.categoryIds).size) throw new DomainError("DOGRULAMA", "Geçersiz kategori seçimi.");
  if (a.kind === "INFLUENCER") {
    const handles = [a.instagram, a.tiktok, a.youtube].filter((h) => h?.trim());
    if (!handles.length) throw new DomainError("DOGRULAMA", "En az bir sosyal medya hesabı girin.");
    if (handles.some((h) => !HANDLE_RE.test(h!.trim()))) throw new DomainError("DOGRULAMA", "Kullanıcı adları geçersiz.");
  } else {
    if (a.companyName.trim().length < 2) throw new DomainError("DOGRULAMA", "Şirket adı gerekli.");
    if (!/^\d{10,11}$/.test(a.taxNumber.trim())) throw new DomainError("DOGRULAMA", "Vergi/TC kimlik numarası 10–11 haneli olmalı.");
    if (a.taxOffice.trim().length < 2) throw new DomainError("DOGRULAMA", "Vergi dairesi gerekli.");
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const code = normalizeCode(input.code);

  const user = await prisma.$transaction(async (tx) => {
    const inv = await tx.invite.findUnique({ where: { code } });
    if (!inv || inv.revokedAt || inv.expiresAt <= new Date()) throw new DomainError("KURAL_IHLALI", "Davet kodu geçersiz veya süresi dolmuş.");
    if (inv.targetRole !== a.kind) throw new DomainError("KURAL_IHLALI", "Bu davet kodu bu üyelik türü için değil.");
    // Yarış güvenli kullanım hakkı düşümü.
    const claimed = await tx.invite.updateMany({ where: { id: inv.id, uses: { lt: inv.maxUses } }, data: { uses: { increment: 1 } } });
    if (claimed.count !== 1) throw new DomainError("KURAL_IHLALI", "Davet kodunun kullanım hakkı bitmiş.");
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) throw new DomainError("DOGRULAMA", "Bu e-posta ile kayıtlı bir hesap var.");
    const u = await tx.user.create({ data: { email, name, phone, passwordHash, role: inv.targetRole, status: "PENDING" } });
    await tx.signupApplication.create({ data: { userId: u.id, inviteId: inv.id, targetRole: inv.targetRole, data: a as object } });
    const admins = await tx.user.findMany({ where: { role: { in: ["ADMIN", "AGENCY"] }, status: "ACTIVE" }, select: { id: true } });
    await tx.notification.createMany({
      data: admins.map((x) => ({ userId: x.id, title: "Yeni üyelik başvurusu", body: `${name} (${a.kind === "BRAND" ? "marka" : "influencer"}) onayınızı bekliyor.`, href: "/admin/davetler?bolum=basvurular" })),
    });
    return u;
  });
  await audit.append({ actor: { id: user.id, role: user.role }, action: "SIGNUP_SUBMITTED", entityType: "User", entityId: user.id, data: { role: user.role, inviteCode: `${code.slice(0, 3)}…` } });
  return user;
}

function cleanHandle(h: string) {
  const t = h.trim().replace(/^https?:\/\/[^/]+\//, "").replace(/^@/, "");
  return `@${t}`;
}

/** Onay: profil oluşturulur, kullanıcı ACTIVE olur, başvuran ve davet eden bilgilendirilir. */
export async function approveApplication(actorIn: Actor, applicationId: string, opts: { existingBrandId?: string | null; note?: string | null } = {}) {
  const actor = requireRole(actorIn, "ADMIN");
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.signupApplication.findUnique({ where: { id: applicationId }, include: { user: true, invite: true } });
    if (!app) throw new DomainError("BULUNAMADI", "Başvuru bulunamadı.");
    if (app.status !== "PENDING") throw new DomainError("GECERSIZ_GECIS", "Başvuru zaten sonuçlandırılmış.");
    const data = app.data as InfluencerApplication | BrandApplication;
    const cats = await tx.category.findMany({ where: { id: { in: data.categoryIds } }, include: { parent: true } });
    const legacy = (cats[0]?.parent?.name ?? cats[0]?.name ?? "genel").toLocaleLowerCase("tr");
    if (data.kind === "INFLUENCER") {
      const inf = await tx.influencer.create({
        data: { name: app.user.name, category: legacy, city: data.city ?? null, bio: data.about ?? null, iban: "", ibanHolder: app.user.name, taxStatus: "FATURA", canIssueInvoice: false },
      });
      if (cats.length) await setInfluencerCategories(tx, inf.id, cats.map((c) => c.id), cats[0]!.id);
      for (const [platform, h] of [["INSTAGRAM", data.instagram], ["TIKTOK", data.tiktok], ["YOUTUBE", data.youtube]] as const) {
        if (h?.trim()) await tx.socialAccount.create({ data: { influencerId: inf.id, platform, handle: cleanHandle(h), followers: 0, engagementRate: 0, demographics: {} } });
      }
      // Vergi durumu belirlenene kadar ödeme kilitli.
      await tx.influencerTaxProfile.create({ data: { influencerId: inf.id, status: "diger" } });
      await tx.user.update({ where: { id: app.userId }, data: { status: "ACTIVE", influencerId: inf.id } });
    } else {
      let brandId = opts.existingBrandId ?? null;
      if (brandId) {
        if (!(await tx.brand.findUnique({ where: { id: brandId }, select: { id: true } }))) throw new DomainError("BULUNAMADI", "Marka bulunamadı.");
      } else {
        const b = await tx.brand.create({
          data: { name: data.companyName.trim(), taxOffice: data.taxOffice.trim(), taxNumber: data.taxNumber.trim(), contactName: app.user.name, contactEmail: app.user.email, contactPhone: app.user.phone ?? "", category: legacy, competitorBrandIds: [] },
        });
        if (cats.length) await setBrandCategories(tx, b.id, cats.map((c) => c.id), cats[0]!.id);
        await tx.tenantSettings.create({ data: { tenantId: b.id } });
        brandId = b.id;
      }
      await tx.user.update({ where: { id: app.userId }, data: { status: "ACTIVE", brandId } });
    }
    await tx.signupApplication.update({ where: { id: app.id }, data: { status: "APPROVED", reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: opts.note ?? null } });
    await tx.notification.create({ data: { userId: app.userId, title: "Üyeliğiniz onaylandı", body: "Hesabınız etkinleştirildi. Panele giriş yapabilirsiniz.", href: "/" } });
    if (app.invite.createdById !== actor.userId) {
      await tx.notification.create({ data: { userId: app.invite.createdById, title: "Davet ettiğiniz kişi onaylandı", body: `${app.user.name} platforma katıldı.`, href: null } });
    }
    return app;
  });
  await audit.append({ actor: toAuditActor(actor), action: "SIGNUP_APPROVED", entityType: "SignupApplication", entityId: applicationId, data: { userId: result.userId, role: result.targetRole } });
}

export async function rejectApplication(actorIn: Actor, applicationId: string, note: string) {
  const actor = requireRole(actorIn, "ADMIN");
  if (note.trim().length < 5) throw new DomainError("DOGRULAMA", "Red gerekçesi en az 5 karakter olmalı.");
  const app = await prisma.signupApplication.findUnique({ where: { id: applicationId } });
  if (!app) throw new DomainError("BULUNAMADI", "Başvuru bulunamadı.");
  if (app.status !== "PENDING") throw new DomainError("GECERSIZ_GECIS", "Başvuru zaten sonuçlandırılmış.");
  await prisma.$transaction([
    prisma.signupApplication.update({ where: { id: applicationId }, data: { status: "REJECTED", reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: note.trim() } }),
    prisma.user.update({ where: { id: app.userId }, data: { status: "REJECTED" } }),
  ]);
  await audit.append({ actor: toAuditActor(actor), action: "SIGNUP_REJECTED", entityType: "SignupApplication", entityId: applicationId, data: { note } });
}
