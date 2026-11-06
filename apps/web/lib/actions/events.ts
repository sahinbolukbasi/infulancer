"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { createEvent, inviteManyToEvent, inviteToEvent, respondInvite, setEventStatus } from "@infulancer/core/events/service";
import { dispatchNotification } from "@infulancer/core/notify/dispatch";
import { fmtDateTime } from "@/lib/time";
import { DomainError } from "@infulancer/core/domain/errors";
import type { ActionState } from "@/lib/action-state";
import { attempt, bool, optStr, parseInput, revalidateAll, str } from "@/lib/action-utils";
import { requireActor } from "@/lib/auth-guard";
import { AGENCY_TZ, isDay } from "@/lib/time";
import { zonedToUtc } from "@/lib/time";

function dayToUtc(day: string, time: string): Date {
  return zonedToUtc(day, time, AGENCY_TZ);
}

const createSchema = z.object({
  title: z.string().min(3, { error: "Başlık en az 3 karakter." }).max(140),
  description: z.string().min(5, { error: "Açıklama gerekli." }).max(5000),
  venueName: z.string().max(200).optional(),
  address: z.string().max(400).optional(),
  city: z.string().max(80).optional(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  startsAtDay: z.string().refine(isDay, { error: "Geçerli bir başlangıç tarihi girin." }),
  startsAtTime: z.string(),
  endsAtDay: z.string().optional(),
  endsAtTime: z.string().optional(),
  visibility: z.enum(["HERKESE_ACIK", "KAPALI"]),
  capacity: z.number().int().positive().nullable(),
  coverImageKey: z.string().optional(),
});

/** Etkinlik oluşturur (admin veya marka). Taslak olarak başlar. */
export async function createEventAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  const created: { id?: string; brand?: boolean } = { brand: actor.role === "BRAND" };
  const res = await attempt(async () => {
    const latRaw = str(fd, "latitude");
    const lngRaw = str(fd, "longitude");
    const capRaw = str(fd, "capacity");
    const input = parseInput(createSchema, {
      title: str(fd, "title"),
      description: str(fd, "description"),
      venueName: str(fd, "venueName") || undefined,
      address: str(fd, "address") || undefined,
      city: str(fd, "city") || undefined,
      latitude: latRaw ? Number(latRaw.replace(",", ".")) : null,
      longitude: lngRaw ? Number(lngRaw.replace(",", ".")) : null,
      startsAtDay: str(fd, "startsAtDay"),
      startsAtTime: str(fd, "startsAtTime") || "19:00",
      endsAtDay: str(fd, "endsAtDay") || undefined,
      endsAtTime: str(fd, "endsAtTime") || undefined,
      visibility: str(fd, "visibility"),
      capacity: capRaw ? Number(capRaw) : null,
      coverImageKey: str(fd, "coverImageKey") || undefined,
    });
    const tenantId = actor.role === "BRAND" ? actor.brandId! : optStr(fd, "tenantId");
    const e: { id: string } = await createEvent({
      tenantId,
      title: input.title,
      description: input.description,
      venueName: input.venueName,
      address: input.address,
      city: input.city,
      latitude: input.latitude,
      longitude: input.longitude,
      startsAt: dayToUtc(input.startsAtDay, input.startsAtTime),
      endsAt: input.endsAtDay && isDay(input.endsAtDay) ? dayToUtc(input.endsAtDay, input.endsAtTime || "23:59") : null,
      visibility: input.visibility,
      capacity: input.capacity,
      coverImageKey: input.coverImageKey,
      createdByUserId: actor.userId,
    });
    await audit.append({ actor: toAuditActor(actor), action: "EVENT_CREATED", entityType: "Event", entityId: e.id, data: { title: input.title } });
    created.id = e.id;
    revalidateAll();
    return { ok: true, message: "Etkinlik taslağı oluşturuldu." };
  });
  if (res.ok && created.id) redirect(`${created.brand ? "/marka" : "/admin"}/etkinlikler/${created.id}`);
  return res;
}

export async function setEventStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const id = str(fd, "id");
    const to = str(fd, "to") as "TASLAK" | "YAYINDA" | "IPTAL" | "TAMAMLANDI";
    const ev = await prisma.event.findUnique({ where: { id }, select: { tenantId: true } });
    if (!ev) throw new DomainError("BULUNAMADI", "Etkinlik bulunamadı.");
    if (actor.role === "BRAND" && ev.tenantId !== actor.brandId) throw new DomainError("YETKISIZ", "Bu etkinlik sizin değil.");
    await setEventStatus(id, to);
    await audit.append({ actor: toAuditActor(actor), action: "EVENT_STATUS", entityType: "Event", entityId: id, data: { to } });
    revalidateAll();
    return { ok: true, message: "Etkinlik durumu güncellendi." };
  });
}

/** Etkinliğe influencer davet eder (tek veya çoklu id, virgülle/satırla). */
export async function inviteEventAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const eventId = str(fd, "eventId");
    const ids = fd.getAll("influencerId").map(String).filter(Boolean);
    const guestName = str(fd, "guestName");
    const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { tenantId: true } });
    if (!ev) throw new DomainError("BULUNAMADI", "Etkinlik bulunamadı.");
    if (actor.role === "BRAND" && ev.tenantId !== actor.brandId) throw new DomainError("YETKISIZ", "Bu etkinlik sizin değil.");
    if (ids.length) {
      const r = await inviteManyToEvent(eventId, ids);
      await audit.append({ actor: toAuditActor(actor), action: "EVENT_INVITED", entityType: "Event", entityId: eventId, data: { count: r.length } });
      // Davet edilenlere çok kanallı bildirim.
      try {
        const full = await prisma.event.findUnique({ where: { id: eventId }, select: { title: true, startsAt: true } });
        const invited = await prisma.influencer.findMany({ where: { id: { in: r.map((x) => x.influencerId).filter((y): y is string => !!y) } }, select: { id: true, name: true, socialAccounts: { select: { platform: true, handle: true }, take: 1 }, user: { select: { id: true, email: true, phone: true } } } });
        const recipients = invited.filter((i) => i.user).map((i) => ({ userId: i.user!.id, email: i.user!.email, phone: i.user!.phone, instagram: i.socialAccounts[0]?.handle ?? null, vars: { ad: i.name, baslik: full?.title ?? "", tarih: full ? fmtDateTime(full.startsAt) : "", link: `/influencer/davetlerim` } }));
        if (recipients.length) await dispatchNotification("EVENT_INVITED", recipients);
      } catch { /* bildirim hatası daveti bozmasın */ }
      revalidateAll();
      return { ok: true, message: `${r.length} davet gönderildi.` };
    }
    if (guestName) {
      await inviteToEvent({ eventId, guestName });
      revalidateAll();
      return { ok: true, message: "Davet oluşturuldu." };
    }
    throw new DomainError("DOGRULAMA", "En az bir influencer veya misafir adı girin.");
  });
}

/** Davet/talebe yanıt: kabul (bilet üretir) veya ret. */
export async function respondInviteAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND", "INFLUENCER");
  return attempt(async () => {
    const inviteId = str(fd, "inviteId");
    const accept = bool(fd, "accept");
    const holderName = str(fd, "holderName") || undefined;
    // Sahiplik: influencer yalnız kendi davetini, marka yalnız kendi etkinliğinin davetini yanıtlar.
    const inv = await prisma.eventInvite.findUnique({ where: { id: inviteId }, select: { influencerId: true, event: { select: { tenantId: true } } } });
    if (!inv) throw new DomainError("BULUNAMADI", "Davet bulunamadı.");
    if (actor.role === "INFLUENCER" && inv.influencerId !== actor.influencerId) throw new DomainError("YETKISIZ", "Bu davet size ait değil.");
    if (actor.role === "BRAND" && inv.event.tenantId !== actor.brandId) throw new DomainError("YETKISIZ", "Bu etkinlik sizin değil.");
    await respondInvite(inviteId, accept, holderName);
    await audit.append({ actor: toAuditActor(actor), action: "EVENT_INVITE_RESPONSE", entityType: "EventInvite", entityId: inviteId, data: { accept } });
    revalidateAll();
    return { ok: true, message: accept ? "Katılımınız onaylandı; biletiniz hazır." : "Katılmayacağınız kaydedildi." };
  });
}

/** QR kodla etkinlik girişi (check-in). */
export async function checkInAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireActor("ADMIN", "BRAND");
  return attempt(async () => {
    const { checkInTicket } = await import("@infulancer/core/events/service");
    const code = str(fd, "code").trim().toUpperCase();
    if (actor.role === "BRAND") {
      const t = await prisma.eventTicket.findUnique({ where: { code }, select: { event: { select: { tenantId: true } } } });
      if (t && t.event.tenantId !== actor.brandId) throw new DomainError("YETKISIZ", "Bu bilet sizin etkinliğinize ait değil.");
    }
    const r = await checkInTicket(code);
    revalidateAll();
    if (r.alreadyUsed) return { ok: true, message: `Bu bilet zaten kullanılmış (${r.ticket.holderName}).` };
    return { ok: true, message: `Giriş onaylandı: ${r.ticket.holderName}.` };
  });
}
