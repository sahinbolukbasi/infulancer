import { z } from "zod";
import { audit } from "@infulancer/core/audit";
import { toAuditActor } from "@infulancer/core/access/actor";
import { prisma } from "@infulancer/core/db";
import { deleteObject, headObject, presignAvatarPut } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";

export const runtime = "nodejs";
const MAX = 5 * 1024 * 1024; // 5 MB
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const putSchema = z.object({ mime: z.enum(["image/jpeg", "image/png", "image/webp"]), size: z.number().int().positive().max(MAX) });
const confirmSchema = z.object({ key: z.string().regex(/^avatars\/[a-f0-9-]+\.(jpg|png|webp)$/) });

/** Profil fotoğrafı için presigned PUT (tüm roller, kendi fotoğrafı). */
export async function POST(req: Request) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => null);
  const p = putSchema.safeParse(body);
  if (!p.success) return Response.json({ error: "Yalnız JPEG, PNG veya WebP; en çok 5 MB." }, { status: 400 });
  if (!MIMES.has(p.data.mime)) return Response.json({ error: "Desteklenmeyen tür." }, { status: 400 });
  const { key, url } = await presignAvatarPut(p.data.mime);
  return Response.json({ key, url }, { headers: { "Cache-Control": "no-store" } });
}

/** Yükleme bitti: nesneyi doğrula, kullanıcının (ve varsa influencer profilinin) avatarKey'ini güncelle, eskisini sil. */
export async function PUT(req: Request) {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => null);
  const c = confirmSchema.safeParse(body);
  if (!c.success) return Response.json({ error: "Geçersiz anahtar." }, { status: 400 });
  const head = await headObject(c.data.key);
  if (!head || head.size === 0) return Response.json({ error: "Dosya yüklenmemiş görünüyor." }, { status: 400 });
  if (head.size > MAX || !MIMES.has(head.mime ?? "")) {
    await deleteObject(c.data.key);
    return Response.json({ error: "Dosya 5 MB'ı aşıyor veya desteklenmeyen türde." }, { status: 400 });
  }
  const actor = auth.actor;
  const old = await prisma.user.findUnique({ where: { id: actor.userId }, select: { avatarKey: true } });
  await prisma.user.update({ where: { id: actor.userId }, data: { avatarKey: c.data.key } });
  if (actor.influencerId) await prisma.influencer.update({ where: { id: actor.influencerId }, data: { avatarKey: c.data.key } });
  if (old?.avatarKey && old.avatarKey !== c.data.key) await deleteObject(old.avatarKey);
  await audit.append({ actor: toAuditActor(actor), action: "AVATAR_UPDATED", entityType: "User", entityId: actor.userId, data: {} });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

/** Fotoğrafı kaldır. */
export async function DELETE() {
  const auth = await requireApiActor();
  if (auth.response) return auth.response;
  const actor = auth.actor;
  const u = await prisma.user.findUnique({ where: { id: actor.userId }, select: { avatarKey: true } });
  await prisma.user.update({ where: { id: actor.userId }, data: { avatarKey: null } });
  if (actor.influencerId) await prisma.influencer.update({ where: { id: actor.influencerId }, data: { avatarKey: null } });
  if (u?.avatarKey) await deleteObject(u.avatarKey);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
