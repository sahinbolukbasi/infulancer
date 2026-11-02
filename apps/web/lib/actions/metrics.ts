"use server";

import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { requireRole, toAuditActor } from "@infulancer/core/access/actor";
import { assertDeliverableAccess } from "@infulancer/core/access/ownership";
import { prisma, type MetricSource } from "@infulancer/core/db";
import { transitionDeliverable } from "@infulancer/core/domain/deliverable-status";
import { DomainError } from "@infulancer/core/domain/errors";
import { isStory, parsePlatformMetrics } from "@infulancer/core/domain/platform-rules";
import { publish } from "@infulancer/core/events";
import type { ActionState } from "@/lib/action-state";
import { attempt, intOrNull, optStr, revalidateAll, str, tlToKurus } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { commonMetricFields, platformMetricFields, type MetricField } from "@/lib/metric-fields";
import { notifyAdmins } from "@/lib/notify";
import { parseLocalInput, zonedToUtc } from "@/lib/time";

const stageSchema = z.enum(["H24", "D7", "D30", "ARA"], { error: "Ölçüm aşaması seçin." });

function readNumber(fd: FormData, name: string, field: MetricField): number | undefined {
  const raw = str(fd, name).replace(",", ".");
  if (raw === "") return undefined;
  const n = Number(raw);
  const bad = () => new DomainError("DOGRULAMA", `${field.label}: geçerli bir sayı girin.`);
  if (!Number.isFinite(n)) throw bad();
  switch (field.kind) {
    case "count":
      if (!Number.isInteger(n) || n < 0) throw bad();
      return n;
    case "signed":
      if (!Number.isInteger(n)) throw bad();
      return n;
    case "decimal":
      if (n < 0) throw bad();
      return n;
    case "ratio":
      if (n < 0 || n > 100) throw new DomainError("DOGRULAMA", `${field.label}: 0–100 arası yüzde girin.`);
      return Math.round(n * 100) / 10000;
  }
}

/**
 * Metrik girişi (influencer kendi işi / admin). Snapshot eklenir, asla güncellenmez.
 * Ekran görüntüsü → EKRAN_GORUNTUSU; yalnız admin görüntüsüz MANUEL girebilir; IG Story'de görüntü şart.
 */
export async function submitMetric(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = requireRole(await requireActor("ADMIN", "INFLUENCER"), "ADMIN", "INFLUENCER");
  return attempt(async () => {
    const deliverableId = str(fd, "deliverableId");
    const stage = stageSchema.safeParse(str(fd, "stage"));
    if (!stage.success) throw new DomainError("DOGRULAMA", "Ölçüm aşaması seçin.");
    const screenshotAssetId = optStr(fd, "screenshotAssetId");

    const result = await prisma.$transaction(async (tx) => {
      await assertDeliverableAccess(tx, actor, deliverableId);
      const d = await tx.deliverable.findUniqueOrThrow({
        where: { id: deliverableId },
        select: {
          id: true,
          status: true,
          platform: true,
          contentType: true,
          publishedAt: true,
          assignment: { select: { influencer: { select: { name: true, audienceTimezone: true } } } },
        },
      });
      if (!d.publishedAt || !["YAYINLANDI", "METRIK_BEKLIYOR", "TAMAMLANDI"].includes(d.status)) {
        throw new DomainError("KURAL_IHLALI", "Metrik yalnız yayınlanmış iş için girilebilir.");
      }

      const common: Record<string, number> = {};
      for (const f of commonMetricFields) {
        const v = readNumber(fd, `m_${f.key}`, f);
        if (v !== undefined) common[f.key] = v;
      }
      const pmRaw: Record<string, number> = {};
      for (const f of platformMetricFields[d.platform]) {
        const v = readNumber(fd, `pm_${f.key}`, f);
        if (v !== undefined) pmRaw[f.key] = v;
      }
      const platformMetrics = parsePlatformMetrics(d.platform, pmRaw);
      if (Object.keys(common).length === 0 && Object.keys(platformMetrics).length === 0) {
        throw new DomainError("DOGRULAMA", "En az bir metrik değeri girin.");
      }

      let source: MetricSource = "MANUEL";
      if (screenshotAssetId) {
        const asset = await tx.asset.findUnique({
          where: { id: screenshotAssetId },
          select: { deliverableId: true, kind: true, uploadStatus: true, _count: { select: { metricSnapshots: true } } },
        });
        if (!asset || asset.deliverableId !== d.id || asset.kind !== "METRIK_SS" || asset.uploadStatus !== "TAMAM") {
          throw new DomainError("DOGRULAMA", "Ekran görüntüsü bu işe ait değil veya yüklemesi tamamlanmadı.");
        }
        if (asset._count.metricSnapshots > 0) {
          throw new DomainError("DOGRULAMA", "Bu ekran görüntüsü başka bir metrik girişinde kullanıldı; yenisini yükleyin.");
        }
        source = "EKRAN_GORUNTUSU";
      } else if (isStory(d)) {
        throw new DomainError("KURAL_IHLALI", "Instagram Story metrikleri 24 saatte kaybolur; ekran görüntüsü zorunlu.");
      } else if (actor.role !== "ADMIN") {
        throw new DomainError("DOGRULAMA", "Metrik ekran görüntüsü yüklemek zorunlu.");
      }

      const measuredLocal = parseLocalInput(str(fd, "measuredAt"));
      const tz = d.assignment.influencer.audienceTimezone;
      const measuredAt = measuredLocal ? zonedToUtc(measuredLocal.day, measuredLocal.time, tz) : new Date();
      if (measuredAt.getTime() > Date.now() + 5 * 60_000) throw new DomainError("DOGRULAMA", "Ölçüm zamanı gelecekte olamaz.");
      if (measuredAt < d.publishedAt) throw new DomainError("DOGRULAMA", "Ölçüm zamanı yayından önce olamaz.");

      const snapshot = await tx.metricSnapshot.create({
        data: {
          deliverableId: d.id,
          stage: stage.data,
          source,
          measuredAt,
          ...common,
          platformMetrics,
          screenshotAssetId,
          enteredById: actor.userId,
        },
      });
      await audit.append({
        actor: toAuditActor(actor),
        action: "METRIC_SUBMITTED",
        entityType: "Deliverable",
        entityId: d.id,
        data: { metricSnapshotId: snapshot.id, stage: stage.data, source, ...common, platformMetrics },
      });
      if (d.status === "YAYINLANDI") {
        await transitionDeliverable(tx, { deliverableId: d.id, to: "METRIK_BEKLIYOR", actor, asSystem: true, note: "Metrik girildi" });
      }
      if (actor.role === "INFLUENCER") {
        await notifyAdmins(tx, {
          title: `Metrik girildi: ${d.assignment.influencer.name}`,
          body: "Yeni metrik girişi kontrol için hazır.",
          href: `/admin/teslimler/${d.id}`,
        });
      }
      return { snapshotId: snapshot.id, deliverableId: d.id };
    });
    await publish({ type: "METRIC_SUBMITTED", metricSnapshotId: result.snapshotId, deliverableId: result.deliverableId });
    revalidateAll();
    return { ok: true, message: "Metrik kaydedildi." };
  });
}

/** Tam sayıyı n parçaya böler; kalan son parçaya eklenir. */
function split(total: number | null, n: number): (number | null)[] {
  if (total == null) return Array.from({ length: n }, () => null);
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - base * (n - 1) : base));
}

/**
 * Marka tarafı veri (UTM/kupon tıklama, satış, ciro) — kaynak MARKA (yüksek güven).
 * Kupon koduyla girilirse o atamanın iptal olmayan işlerine eşit bölünür.
 */
export async function submitBrandData(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN");
  return attempt(async () => {
    const mode = str(fd, "mode") === "coupon" ? "coupon" : "deliverable";
    const clicks = intOrNull(str(fd, "clicks"));
    const sales = intOrNull(str(fd, "sales"));
    const revenueKurus = str(fd, "revenue") ? tlToKurus(str(fd, "revenue")) : null;
    for (const [label, v] of [["Tıklama", clicks], ["Satış", sales], ["Ciro", revenueKurus]] as const) {
      if (v != null && (Number.isNaN(v) || v < 0)) throw new DomainError("DOGRULAMA", `${label}: geçerli bir değer girin.`);
    }
    if (clicks == null && sales == null && revenueKurus == null) throw new DomainError("DOGRULAMA", "En az bir değer girin.");

    const count = await prisma.$transaction(async (tx) => {
      let deliverableIds: string[];
      let reference: Record<string, string>;
      if (mode === "coupon") {
        const campaignId = str(fd, "campaignId");
        const couponCode = str(fd, "couponCode").toUpperCase();
        if (!couponCode) throw new DomainError("DOGRULAMA", "Kupon kodu girin.");
        const a = await tx.assignment.findFirst({
          where: { campaignId, couponCode: { equals: couponCode, mode: "insensitive" }, contractStatus: { not: "RED" } },
          select: { id: true, deliverables: { where: { status: { not: "IPTAL" } }, select: { id: true }, orderBy: { plannedAt: "asc" } } },
        });
        if (!a) throw new DomainError("BULUNAMADI", "Bu kampanyada kupon koduna ait atama bulunamadı.");
        if (a.deliverables.length === 0) throw new DomainError("KURAL_IHLALI", "Atamanın aktif işi yok.");
        deliverableIds = a.deliverables.map((d) => d.id);
        reference = { campaignId, couponCode, assignmentId: a.id };
      } else {
        const deliverableId = str(fd, "deliverableId");
        const d = await tx.deliverable.findUnique({ where: { id: deliverableId }, select: { id: true } });
        if (!d) throw new DomainError("BULUNAMADI", "İş bulunamadı.");
        deliverableIds = [d.id];
        reference = { deliverableId };
      }
      const n = deliverableIds.length;
      const c = split(clicks, n);
      const s = split(sales, n);
      const r = split(revenueKurus, n);
      const measuredAt = new Date();
      for (let i = 0; i < n; i++) {
        const snap = await tx.metricSnapshot.create({
          data: {
            deliverableId: deliverableIds[i]!,
            stage: "ARA",
            source: "MARKA",
            measuredAt,
            clicks: c[i],
            sales: s[i],
            revenueKurus: r[i],
            platformMetrics: {},
            enteredById: actor.userId,
          },
        });
        await audit.append({
          actor: toAuditActor(actor),
          action: "BRAND_DATA_SUBMITTED",
          entityType: "Deliverable",
          entityId: deliverableIds[i]!,
          data: { metricSnapshotId: snap.id, clicks: c[i], sales: s[i], revenueKurus: r[i], ...reference },
        });
      }
      return n;
    });
    revalidateAll();
    return { ok: true, message: count > 1 ? `Marka verisi ${count} işe bölündü.` : "Marka verisi kaydedildi." };
  });
}
