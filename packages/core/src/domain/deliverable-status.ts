import { audit } from "../audit";
import type { Tx } from "../db";
import type { DeliverableStatus, Role } from "../generated/prisma/enums";
import { toAuditActor, type Actor } from "../access/actor";
import { DomainError } from "./errors";
import { deliverableStatusLabels } from "./labels";
import { recordEarning } from "./ledger";
import { isStory } from "./platform-rules";

/**
 * Deliverable durum makinesi.
 * - İleri geçişler role göre tanımlıdır.
 * - Geri dönüş ve İPTAL yalnızca admin.
 * - Influencer: BRIEF_GONDERILDI→ICERIK_YUKLENDI, REVIZYON→ICERIK_YUKLENDI, ONAYLANDI→YAYINLANDI (postUrl zorunlu).
 * - YAYINLANDI→METRIK_BEKLIYOR otomatik (sistem).
 * - →TAMAMLANDI en az bir metrik ister; IG Story için ekran görüntülü metrik şarttır.
 */

export type TransitionRole = Role | "SYSTEM";

/** Akış sırası; geri dönüş tespitinde kullanılır. REVIZYON, ICERIK_YUKLENDI ile aynı kademededir. */
export const statusOrder: Record<DeliverableStatus, number> = {
  TASLAK: 0,
  ATANDI: 1,
  BRIEF_GONDERILDI: 2,
  ICERIK_YUKLENDI: 3,
  REVIZYON: 3,
  ONAYLANDI: 4,
  YAYINLANDI: 5,
  METRIK_BEKLIYOR: 6,
  TAMAMLANDI: 7,
  IPTAL: 99,
};

type Edge = { from: DeliverableStatus; to: DeliverableStatus; roles: readonly TransitionRole[] };

export const forwardTransitions: readonly Edge[] = [
  { from: "TASLAK", to: "ATANDI", roles: ["ADMIN"] },
  { from: "ATANDI", to: "BRIEF_GONDERILDI", roles: ["ADMIN"] },
  { from: "BRIEF_GONDERILDI", to: "ICERIK_YUKLENDI", roles: ["ADMIN", "INFLUENCER"] },
  { from: "ICERIK_YUKLENDI", to: "ONAYLANDI", roles: ["ADMIN"] },
  { from: "ICERIK_YUKLENDI", to: "REVIZYON", roles: ["ADMIN"] },
  { from: "REVIZYON", to: "ICERIK_YUKLENDI", roles: ["ADMIN", "INFLUENCER"] },
  { from: "ONAYLANDI", to: "YAYINLANDI", roles: ["ADMIN", "INFLUENCER"] },
  { from: "YAYINLANDI", to: "METRIK_BEKLIYOR", roles: ["SYSTEM", "ADMIN"] },
  { from: "METRIK_BEKLIYOR", to: "TAMAMLANDI", roles: ["ADMIN"] },
];

export function isBackward(from: DeliverableStatus, to: DeliverableStatus): boolean {
  return to !== "IPTAL" && from !== "IPTAL" && statusOrder[to] < statusOrder[from];
}

export function canTransition(
  role: TransitionRole,
  from: DeliverableStatus,
  to: DeliverableStatus,
): boolean {
  if (from === to) return false;
  if (from === "IPTAL") return false; // İptal edilmiş iş kapanmıştır.
  // İptal: admin; ayrıca sözleşme reddi gibi sistem kaskadları (SYSTEM).
  if (to === "IPTAL") return role === "ADMIN" || role === "SYSTEM";
  if (isBackward(from, to)) return role === "ADMIN";
  return forwardTransitions.some((e) => e.from === from && e.to === to && e.roles.includes(role));
}

/** Rolün mevcut durumdan gidebileceği durumlar (arayüz butonları için). */
export function allowedTargets(role: TransitionRole, from: DeliverableStatus): DeliverableStatus[] {
  return (Object.keys(statusOrder) as DeliverableStatus[]).filter((to) => canTransition(role, from, to));
}

export function assertTransition(
  role: TransitionRole,
  from: DeliverableStatus,
  to: DeliverableStatus,
): void {
  if (canTransition(role, from, to)) return;
  const fromLabel = deliverableStatusLabels[from];
  const toLabel = deliverableStatusLabels[to];
  const message =
    from === "IPTAL"
      ? "İptal edilmiş iş üzerinde durum değiştirilemez."
      : isBackward(from, to) || to === "IPTAL"
        ? `"${fromLabel}" → "${toLabel}" geçişi yalnızca admin yetkisiyle yapılabilir.`
        : `"${fromLabel}" → "${toLabel}" geçişine izin verilmiyor.`;
  throw new DomainError("GECERSIZ_GECIS", message, { from, to, role });
}

export type TransitionInput = {
  deliverableId: string;
  to: DeliverableStatus;
  actor: Actor;
  note?: string | null;
  postUrl?: string | null;
  /**
   * Geçiş kuralları SYSTEM rolüyle denetlenir (ör. sözleşme reddinde işlerin
   * İPTAL'e kaskadı, metrik girişinde YAYINLANDI→METRIK_BEKLIYOR). Audit aktörü
   * yine işlemi tetikleyen kullanıcıdır.
   */
  asSystem?: boolean;
};

export type TransitionResult = {
  id: string;
  from: DeliverableStatus;
  status: DeliverableStatus;
  /** YAYINLANDI'ya geçildiyse true — çağıran, işlem bittikten sonra DELIVERABLE_PUBLISHED olayını yayınlar. */
  published: boolean;
};

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
    return url.toString();
  } catch {
    throw new DomainError("DOGRULAMA", "Geçerli bir paylaşım bağlantısı (https://…) girin.");
  }
}

/**
 * Durum geçişini uygular. Mutlaka prisma.$transaction içinde çağrılmalıdır:
 * DeliverableStatusChange + audit kaydı aynı akışta yazılır; audit hatası
 * işlemi geri alır.
 */
export async function transitionDeliverable(tx: Tx, input: TransitionInput): Promise<TransitionResult> {
  const { actor, to } = input;
  const deliverable = await tx.deliverable.findUnique({
    where: { id: input.deliverableId },
    select: {
      id: true,
      status: true,
      platform: true,
      contentType: true,
      postUrl: true,
      assignment: { select: { influencerId: true, contractStatus: true } },
    },
  });
  if (!deliverable) throw new DomainError("BULUNAMADI", "İş bulunamadı.");

  if (actor.role === "BRAND") {
    throw new DomainError("YETKISIZ", "Markalar durum değiştiremez; inceleme notu bırakabilir.");
  }
  if (actor.role === "INFLUENCER" && deliverable.assignment.influencerId !== actor.influencerId) {
    throw new DomainError("BULUNAMADI", "İş bulunamadı.");
  }

  const from = deliverable.status;
  const checkRole: TransitionRole = input.asSystem ? "SYSTEM" : actor.role;
  assertTransition(checkRole, from, to);

  if (to !== "IPTAL" && deliverable.assignment.contractStatus === "RED") {
    throw new DomainError("KURAL_IHLALI", "Sözleşmesi reddedilmiş atamanın işleri ilerletilemez.");
  }

  const data: { status: DeliverableStatus; postUrl?: string; publishedAt?: Date } = { status: to };

  if (to === "YAYINLANDI") {
    const url = input.postUrl ?? deliverable.postUrl;
    if (!url) throw new DomainError("DOGRULAMA", "Yayınlandı işaretlemek için paylaşım bağlantısı zorunlu.");
    data.postUrl = normalizeUrl(url);
    data.publishedAt = new Date();
  }

  if (to === "TAMAMLANDI") {
    const snapshots = await tx.metricSnapshot.findMany({
      where: { deliverableId: deliverable.id },
      select: { source: true, screenshotAssetId: true },
    });
    if (snapshots.length === 0) {
      throw new DomainError("KURAL_IHLALI", "Metrik girişi yapılmadan iş tamamlanamaz.");
    }
    if (
      isStory(deliverable) &&
      !snapshots.some((s) => s.source === "EKRAN_GORUNTUSU" && s.screenshotAssetId)
    ) {
      throw new DomainError(
        "KURAL_IHLALI",
        "Story için ekran görüntülü metrik girişi yapılmadan iş tamamlanamaz.",
      );
    }
  }

  await tx.deliverable.update({ where: { id: deliverable.id }, data });
  await tx.deliverableStatusChange.create({
    data: { deliverableId: deliverable.id, from, to, byUserId: actor.userId, note: input.note ?? null },
  });
  await audit.append({
    actor: toAuditActor(actor),
    action: "DELIVERABLE_STATUS",
    entityType: "Deliverable",
    entityId: deliverable.id,
    data: { from, to, note: input.note ?? null, postUrl: data.postUrl ?? null, asSystem: input.asSystem ?? false },
  });

  let status: DeliverableStatus = to;

  // Yayınlandı → metrik bekliyor otomatik.
  if (to === "YAYINLANDI") {
    status = "METRIK_BEKLIYOR";
    await tx.deliverable.update({ where: { id: deliverable.id }, data: { status } });
    await tx.deliverableStatusChange.create({
      data: { deliverableId: deliverable.id, from: "YAYINLANDI", to: status, byUserId: null, note: "Otomatik" },
    });
    await audit.append({
      actor: { id: null, role: "SYSTEM" },
      action: "DELIVERABLE_STATUS",
      entityType: "Deliverable",
      entityId: deliverable.id,
      data: { from: "YAYINLANDI", to: status, note: "Otomatik" },
    });
  }

  if (to === "TAMAMLANDI") {
    await recordEarning(tx, deliverable.id, toAuditActor(actor));
  }

  return { id: deliverable.id, from, status, published: to === "YAYINLANDI" };
}
