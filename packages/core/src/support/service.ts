import { prisma } from "../db";
import { DomainError } from "../domain/errors";
import { notifyAdmins } from "../agents/common";
import { SUPPORT_EMAIL } from "../brand";

export type SupportCategory = "HATA" | "SORU" | "ISTEK" | "DIGER";
export type SupportStatus = "ACIK" | "INCELEMEDE" | "COZULDU" | "KAPANDI";

export const supportCategoryLabel: Record<SupportCategory, string> = {
  HATA: "Hata bildirimi",
  SORU: "Soru",
  ISTEK: "İstek / öneri",
  DIGER: "Diğer",
};
export const supportStatusLabel: Record<SupportStatus, string> = {
  ACIK: "Açık",
  INCELEMEDE: "İncelemede",
  COZULDU: "Çözüldü",
  KAPANDI: "Kapandı",
};

export type CreateSupportTicketInput = {
  userId?: string | null;
  role?: string | null;
  name: string;
  email: string;
  category: SupportCategory;
  subject: string;
  message: string;
  pageUrl?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kullanıcı destek talebi oluşturur ve yöneticilere bildirim düşer. */
export async function createSupportTicket(input: CreateSupportTicketInput) {
  const name = input.name.trim();
  const email = input.email.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (name.length < 2) throw new DomainError("DOGRULAMA", "Adınızı girin.");
  if (!EMAIL_RE.test(email)) throw new DomainError("DOGRULAMA", "Geçerli bir e-posta girin.");
  if (subject.length < 3) throw new DomainError("DOGRULAMA", "Konu en az 3 karakter olmalı.");
  if (message.length < 10) throw new DomainError("DOGRULAMA", "Mesaj en az 10 karakter olmalı.");
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: input.userId ?? null,
      role: input.role ?? null,
      name,
      email,
      category: input.category,
      subject: subject.slice(0, 200),
      message: message.slice(0, 5000),
      pageUrl: input.pageUrl?.slice(0, 500) ?? null,
    },
  });
  await notifyAdmins(
    `Yeni destek talebi: ${supportCategoryLabel[input.category]}`,
    `${name} (${email}): ${subject}`,
    "/admin/destek",
  );
  return ticket;
}

/** Yönetici: talep durumunu ve notunu günceller. */
export async function updateSupportTicket(id: string, data: { status?: SupportStatus; adminNote?: string | null }) {
  const t = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
  if (!t) throw new DomainError("BULUNAMADI", "Destek talebi bulunamadı.");
  return prisma.supportTicket.update({
    where: { id },
    data: { status: data.status, adminNote: data.adminNote === undefined ? undefined : (data.adminNote?.trim() || null) },
  });
}

export { SUPPORT_EMAIL };
