import { prisma } from "../db";
import { getConfig } from "../config/store";
import { addBusinessDays, loadCalendar } from "./business-days";

/**
 * KVKK yurt dışı aktarım — standart sözleşme akışı (açık rızaya DAYANILMAZ).
 * İki ayrı aktarım: (1) AWS eu-central-1, (2) Meta WhatsApp Cloud API.
 * İmzadan sonra 5 İŞ GÜNÜ içinde Kurul'a bildirim; makbuz yüklenmeden tenant production'a GEÇEMEZ.
 * Bildirmeme cezası: 90.308 – 1.806.377 TL.
 */
export const TRANSFER_TARGETS = [
  { key: "aws_eu_central_1", label: "AWS eu-central-1 (Frankfurt) — barındırma" },
  { key: "meta_cloud_api", label: "Meta WhatsApp Cloud API — mesaj işleme (alt-işleyen)" },
] as const;

export type TransferTarget = (typeof TRANSFER_TARGETS)[number]["key"];

export class KvkkGateError extends Error {}

export async function signStandardContract(tenantId: string, signedAt = new Date()) {
  const cal = await loadCalendar();
  const days = await getConfig("kvkk.filingBusinessDays");
  const dueAt = addBusinessDays(signedAt, days, cal);
  for (const t of TRANSFER_TARGETS) {
    await prisma.crossBorderFiling.upsert({
      where: { tenantId_transferTarget: { tenantId, transferTarget: t.key } },
      create: { tenantId, transferTarget: t.key, contractSignedAt: signedAt, dueAt },
      update: { contractSignedAt: signedAt, dueAt },
    });
  }
  await prisma.tenantSettings.upsert({ where: { tenantId }, create: { tenantId }, update: {} });
  return { dueAt };
}

export async function uploadFilingReceipt(tenantId: string, target: TransferTarget, s3Key: string, at = new Date()) {
  if (!s3Key.trim()) throw new KvkkGateError("Makbuz dosyası gerekli.");
  return prisma.crossBorderFiling.update({
    where: { tenantId_transferTarget: { tenantId, transferTarget: target } },
    data: { receiptS3Key: s3Key, receiptUploadedAt: at },
  });
}

export async function kvkkStatus(tenantId: string) {
  const filings = await prisma.crossBorderFiling.findMany({ where: { tenantId } });
  const missing = TRANSFER_TARGETS.filter((t) => !filings.find((f) => f.transferTarget === t.key && f.receiptS3Key));
  return { filings, missing, complete: missing.length === 0 };
}

/** Makbuz yoksa production moduna geçiş SERT BLOK. */
export async function setTenantMode(tenantId: string, mode: "sandbox" | "production") {
  if (mode === "production") {
    const s = await kvkkStatus(tenantId);
    if (!s.complete) {
      throw new KvkkGateError(
        `KVKK bildirim makbuzu yüklenmeden canlıya geçilemez. Eksik: ${s.missing.map((m) => m.label).join(", ")}.`,
      );
    }
  }
  return prisma.tenantSettings.upsert({ where: { tenantId }, create: { tenantId, mode }, update: { mode } });
}

/** 5 iş günü sayacı hatırlatmaları (job). */
export async function remindKvkkFilings(now = new Date()) {
  const due = await prisma.crossBorderFiling.findMany({ where: { receiptS3Key: null, remindedAt: null } });
  let n = 0;
  for (const f of due) {
    const users = await prisma.user.findMany({ where: { brandId: f.tenantId }, select: { id: true } });
    const late = f.dueAt <= now;
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: late ? "KVKK bildirimi gecikti" : "KVKK bildirimi bekleniyor",
        body: `Standart sözleşme bildirimi ${f.dueAt.toLocaleDateString("tr-TR")} tarihine kadar Kurul'a yapılmalı ve makbuz yüklenmeli.`,
        href: "/marka/uyum",
      })),
    });
    await prisma.crossBorderFiling.update({ where: { id: f.id }, data: { remindedAt: now } });
    n++;
  }
  return n;
}

export const kvkkConsentCopy = {
  marketing: "Kampanya ve tanıtım mesajları almak istiyorum (6563 sayılı Kanun / İYS).",
  aiProcessing: "Mesajlarımın yanıtlanması amacıyla yapay zekâ ile işlenmesine açık rıza veriyorum (KVKK).",
  note: "İki onay hukuken farklıdır ve ayrı ayrı alınır; birbirine bağlanamaz.",
};
