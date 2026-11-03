import { prisma } from "../db";
import { getConfig } from "../config/store";
import { envStr } from "../env";
import { notifyAdmins } from "../agents/common";
import type { ConsentChannel, ConsentState } from "../generated/prisma/enums";
import { addBusinessDays, isOlderThanBusinessDays, loadCalendar } from "./business-days";

/**
 * İYS onay kapısı (SERT BLOK).
 * - Onay anahtarı (recipient, channel, brand_id) — UNIQUE; tenant başına ayrı İYS markası.
 * - Her onay/ret yakalanışı 3 İŞ GÜNÜ içinde iys-register'a ulaşmalı (Türk iş günü takvimi).
 * - iys-register atomiktir: tek geçersiz kayıt → 422. İstemci tarafı doğrulama + dedupe + chunk;
 *   422'de batch ikiye bölünür, hatalı kayıt izole edilir.
 * - Gönderim anında CANLI iys-check; cache yalnız ön-filtre.
 * - RET terminal; UI/CSV ile silinemez/üzerine yazılamaz (DB trigger + uygulama kontrolü).
 */
export const E164_RE = /^\+[1-9]\d{7,14}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class IysValidationError extends Error {
  readonly status = 422;
  constructor(message = "İYS kayıt isteği reddedildi (422)") {
    super(message);
  }
}

export class ConsentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsentError";
  }
}

export type IysRecord = { recipient: string; channel: ConsentChannel; state: ConsentState; consentedAt: Date; source: string };

export interface IysProvider {
  /** 1–5.000 kayıt, atomik. Başarıda işlem kimliği döner. */
  register(brandRef: string, records: IysRecord[]): Promise<{ transactionId: string }>;
  check(brandRef: string, recipient: string, channel: ConsentChannel): Promise<ConsentState | null>;
}

/** Mock İYS: kurala uymayan alıcı biçimi olan batch'i 422 ile tümden reddeder. */
const remote = new Map<string, ConsentState>();
let tx = 0;
export const mockIys: IysProvider & { reset(): void; calls: number } = {
  calls: 0,
  reset() {
    remote.clear();
    this.calls = 0;
  },
  async register(brandRef, records) {
    this.calls++;
    if (records.length === 0 || records.length > 5000) throw new IysValidationError("Kayıt sayısı 1–5.000 olmalı");
    if (records.some((r) => !isValidRecipient(r.recipient, r.channel))) throw new IysValidationError();
    for (const r of records) remote.set(`${brandRef}|${r.recipient}|${r.channel}`, r.state);
    return { transactionId: `iys-mock-${++tx}` };
  },
  async check(brandRef, recipient, channel) {
    return remote.get(`${brandRef}|${recipient}|${channel}`) ?? null;
  },
};

let provider: IysProvider = mockIys;
export function setIysProvider(p: IysProvider): void {
  provider = p;
}
export function iys(): IysProvider {
  if (envStr("IYS_MODE", "mock") !== "mock" && provider === mockIys) {
    throw new Error("IYS_MODE=mock dışında entegratör adapter'ı yapılandırılmalı");
  }
  return provider;
}

export function isValidRecipient(recipient: string, channel: ConsentChannel): boolean {
  return channel === "EPOSTA" ? EMAIL_RE.test(recipient) : E164_RE.test(recipient);
}

export function normalizeRecipient(recipient: string, channel: ConsentChannel): string {
  if (channel === "EPOSTA") return recipient.trim().toLowerCase();
  const digits = recipient.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length === 11) return `+90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("5")) return `+90${digits}`;
  return `+${digits}`;
}

export type ConsentInput = {
  tenantId: string;
  recipient: string;
  channel: ConsentChannel;
  state: ConsentState;
  source: string;
  sourceDetail?: string;
  consentedAt: Date;
  aydinlatmaVersion: string;
  aydinlatmaText?: string;
  ip?: string;
  device?: string;
  /** Delil (ör. form kaydı, çağrı kaydı referansı). RET'i kaldıran ONAY için zorunlu. */
  evidence?: string;
};

async function brandOf(tenantId: string) {
  const b = await prisma.iysBrand.findUnique({ where: { tenantId } });
  if (!b) throw new ConsentError("Bu marka için İYS bağlantısı tanımlı değil.");
  return b;
}

/** Onay/ret kaydı + 3 iş günü SLA olayı + append-only delil. */
export async function recordConsent(input: ConsentInput) {
  const brand = await brandOf(input.tenantId);
  const recipient = normalizeRecipient(input.recipient, input.channel);
  if (!isValidRecipient(recipient, input.channel)) throw new ConsentError(`Geçersiz alıcı biçimi: ${input.recipient}`);
  const cal = await loadCalendar();
  const { slaBusinessDays } = await getConfig("iys.batch");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.consent.findUnique({ where: { recipient_channel_brandId: { recipient, channel: input.channel, brandId: brand.id } } });
    if (existing?.state === "RET") {
      if (input.state === "RET") return existing; // zaten RET
      if (input.source === "csv_import") throw new ConsentError("RET kaydı CSV içe aktarımıyla değiştirilemez.");
      if (!input.evidence || input.consentedAt <= existing.consentedAt) {
        throw new ConsentError("RET terminaldir: yalnızca daha yeni tarihli ve delilli bir ONAY kaldırabilir.");
      }
    }
    const data = {
      state: input.state,
      source: input.source,
      sourceDetail: input.sourceDetail ?? null,
      consentedAt: input.consentedAt,
      aydinlatmaVersion: input.aydinlatmaVersion,
      aydinlatmaText: input.aydinlatmaText ?? null,
      ip: input.ip ?? null,
      device: input.device ?? null,
      evidence: input.evidence ?? null,
      registeredAt: null,
      iysTransactionId: null,
    };
    const consent = existing
      ? await tx.consent.update({ where: { id: existing.id }, data })
      : await tx.consent.create({ data: { ...data, tenantId: input.tenantId, brandId: brand.id, recipient, channel: input.channel } });
    await tx.consentEvent.create({
      data: {
        consentId: consent.id,
        eventType: input.state === "ONAY" ? "REGISTER_ONAY" : "REGISTER_RET",
        payload: { recipient, channel: input.channel, state: input.state },
        dueAt: addBusinessDays(input.consentedAt, slaBusinessDays, cal),
      },
    });
    await tx.consentEvidenceLog.create({
      data: { tenantId: input.tenantId, consentId: consent.id, state: input.state, snapshot: { ...data, recipient, channel: input.channel, consentedAt: input.consentedAt.toISOString() } },
    });
    return consent;
  });
}

/** Her kanaldan opt-out (SMS STOP/İPTAL, WA promosyon durdur/blok, IG DM, e-posta unsubscribe) → RET. */
export async function captureOptOut(tenantId: string, recipient: string, channel: ConsentChannel, source: string, at = new Date()) {
  return recordConsent({ tenantId, recipient, channel, state: "RET", source, consentedAt: at, aydinlatmaVersion: "opt-out" });
}

export const OPT_OUT_RE = /^\s*(stop|iptal|dur|durdur|abonelikten çık|promosyonları durdur|istemiyorum)\s*[.!]?\s*$/iu;

export async function deleteConsent(): Promise<never> {
  throw new ConsentError("İYS onay kayıtları silinemez (10 yıllık delil saklama).");
}

/** CSV içe aktarma: mevcut RET kayıtları asla ezilmez. */
export async function importConsentsCsv(tenantId: string, rows: Omit<ConsentInput, "tenantId" | "source">[]) {
  const result = { imported: 0, skippedRet: 0, invalid: 0, errors: [] as string[] };
  for (const r of rows) {
    try {
      await recordConsent({ ...r, tenantId, source: "csv_import" });
      result.imported++;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("RET")) result.skippedRet++;
      else result.invalid++;
      result.errors.push(`${r.recipient}: ${msg}`);
    }
  }
  return result;
}

/** 422 alınırsa batch'i ikiye böl; tek kayda inince hatalı olarak işaretle. */
async function registerChunk(brandRef: string, items: { id: string; rec: IysRecord }[], ok: Map<string, string>, bad: Set<string>) {
  if (!items.length) return;
  try {
    const r = await iys().register(brandRef, items.map((i) => i.rec));
    for (const i of items) ok.set(i.id, r.transactionId);
  } catch (e) {
    if (!(e instanceof IysValidationError)) throw e;
    if (items.length === 1) {
      bad.add(items[0]!.id);
      return;
    }
    const mid = Math.ceil(items.length / 2);
    await registerChunk(brandRef, items.slice(0, mid), ok, bad);
    await registerChunk(brandRef, items.slice(mid), ok, bad);
  }
}

/** Bekleyen onay olaylarını İYS'ye yazar (job: iys-register). */
export async function registerPendingConsents(now = new Date()) {
  const { chunkSize } = await getConfig("iys.batch");
  const events = await prisma.consentEvent.findMany({
    where: { processedAt: null },
    include: { consent: { include: { brand: true } } },
    orderBy: { createdAt: "asc" },
  });
  const byBrand = new Map<string, typeof events>();
  for (const e of events) {
    const k = e.consent.brand.iysIntegratorAccountRef;
    byBrand.set(k, [...(byBrand.get(k) ?? []), e]);
  }
  let registered = 0;
  let failed = 0;
  for (const [brandRef, list] of byBrand) {
    // Dedupe: aynı alıcı/kanal için yalnız en son olay gönderilir.
    const latest = new Map<string, (typeof list)[number]>();
    for (const e of list) latest.set(`${e.consent.recipient}|${e.consent.channel}`, e);
    const superseded = list.filter((e) => !Array.from(latest.values()).includes(e));
    const valid: { id: string; rec: IysRecord }[] = [];
    const bad = new Set<string>();
    for (const e of latest.values()) {
      const c = e.consent;
      if (!isValidRecipient(c.recipient, c.channel)) {
        bad.add(e.id);
        continue;
      }
      valid.push({ id: e.id, rec: { recipient: c.recipient, channel: c.channel, state: c.state, consentedAt: c.consentedAt, source: c.source } });
    }
    const ok = new Map<string, string>();
    for (let i = 0; i < valid.length; i += chunkSize) await registerChunk(brandRef, valid.slice(i, i + chunkSize), ok, bad);
    for (const [eventId, txId] of ok) {
      const ev = list.find((x) => x.id === eventId)!;
      await prisma.consentEvent.update({ where: { id: eventId }, data: { processedAt: now, attempts: { increment: 1 } } });
      await prisma.consent.update({ where: { id: ev.consentId }, data: { registeredAt: now, iysTransactionId: txId } });
      registered++;
    }
    for (const eventId of bad) {
      await prisma.consentEvent.update({ where: { id: eventId }, data: { attempts: { increment: 1 }, lastError: "İYS doğrulama hatası (422)" } });
      failed++;
    }
    for (const e of superseded) await prisma.consentEvent.update({ where: { id: e.id }, data: { processedAt: now, lastError: "daha yeni olayla birleştirildi" } });
  }
  return { registered, failed };
}

/** Kuyruk yaşı 1 iş gününü geçen veya 3 iş günü SLA'sını aşan olaylar için alarm. */
export async function checkIysSla(now = new Date()) {
  const cal = await loadCalendar();
  const { alarmAfterBusinessDays } = await getConfig("iys.batch");
  const pending = await prisma.consentEvent.findMany({ where: { processedAt: null }, include: { consent: { select: { tenantId: true, recipient: true } } } });
  const aging = pending.filter((e) => isOlderThanBusinessDays(e.createdAt, alarmAfterBusinessDays, now, cal));
  const overdue = pending.filter((e) => e.dueAt <= now);
  if (aging.length || overdue.length) {
    await notifyAdmins(
      overdue.length ? "İYS SLA aşıldı" : "İYS kuyruğu gecikiyor",
      `${overdue.length} kayıt 3 iş günü sınırını aştı, ${aging.length} kayıt 1 iş gününden uzun süredir bekliyor.`,
      "/admin/uyum",
    );
  }
  return { aging: aging.map((e) => e.id), overdue: overdue.map((e) => e.id) };
}

export type GateResult = { ok: true } | { ok: false; reason: string };

/**
 * Gönderim anı kapısı. Önce yerel kayıt (ön-filtre), sonra CANLI iys-check (yetki kaynağı).
 * Tenant'lar arası onay kullanımı imkânsızdır: yalnız gönderen tenant'ın markası sorgulanır.
 */
export async function canSendCommercial(tenantId: string, recipient: string, channel: ConsentChannel = "MESAJ"): Promise<GateResult> {
  const brand = await prisma.iysBrand.findUnique({ where: { tenantId } });
  if (!brand) return { ok: false, reason: "İYS bağlantısı yok: ticari ileti gönderilemez." };
  const r = normalizeRecipient(recipient, channel);
  const local = await prisma.consent.findUnique({ where: { recipient_channel_brandId: { recipient: r, channel, brandId: brand.id } } });
  if (!local) return { ok: false, reason: "Alıcının İYS onayı (ONAY) yok: ticari ileti engellendi." };
  if (local.state === "RET") return { ok: false, reason: "Alıcı İYS'de RET durumunda: ticari ileti engellendi." };
  const live = await iys().check(brand.iysIntegratorAccountRef, r, channel);
  if (live !== "ONAY") {
    return { ok: false, reason: live === "RET" ? "Canlı İYS kontrolü: RET." : "Canlı İYS kontrolünde onay bulunamadı (kayıt henüz İYS'ye ulaşmamış olabilir)." };
  }
  return { ok: true };
}

/** Admin UI risk metni (6563 md. 12, 2026 bandları — alıcı başına). */
export const iysPenaltyBands = [
  { label: "İzinsiz ileti", range: "2.859 – 14.309 TL" },
  { label: "Gönderici/içerik bilgisi eksik", range: "2.859 – 28.620 TL" },
  { label: "Ret ihlali", range: "5.723 – 42.930 TL" },
  { label: "Aracı hizmet sağlayıcı", range: "28.620 – 286.206 TL" },
  { label: "Kayıt verilmemesi / ETBİS", range: "143.102 – 715.516 TL" },
];
