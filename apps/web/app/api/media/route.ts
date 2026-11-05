import { z } from "zod";
import { deleteObject, headObject, presignMediaPut } from "@infulancer/core/storage/s3";
import { requireApiActor } from "@/lib/auth-guard";

export const runtime = "nodejs";
const MAX = 8 * 1024 * 1024; // 8 MB (etkinlik/kupon görselleri)
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const putSchema = z.object({ mime: z.enum(["image/jpeg", "image/png", "image/webp"]), size: z.number().int().positive().max(MAX) });
const confirmSchema = z.object({ key: z.string().regex(/^media\/[a-f0-9-]+\.(jpg|png|webp)$/) });

/** Etkinlik/kupon görseli için presigned PUT (admin + marka). */
export async function POST(req: Request) {
  const auth = await requireApiActor("ADMIN", "BRAND");
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => null);
  const p = putSchema.safeParse(body);
  if (!p.success) return Response.json({ error: "Yalnız JPEG, PNG veya WebP; en çok 8 MB." }, { status: 400 });
  const { key, url } = await presignMediaPut(p.data.mime);
  return Response.json({ key, url }, { headers: { "Cache-Control": "no-store" } });
}

/** Yükleme doğrula: nesne var ve sınırlar içinde mi; key döndür (forma yazılır). */
export async function PUT(req: Request) {
  const auth = await requireApiActor("ADMIN", "BRAND");
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => null);
  const c = confirmSchema.safeParse(body);
  if (!c.success) return Response.json({ error: "Geçersiz anahtar." }, { status: 400 });
  const head = await headObject(c.data.key);
  if (!head || head.size === 0) return Response.json({ error: "Dosya yüklenmemiş görünüyor." }, { status: 400 });
  if (head.size > MAX || !MIMES.has(head.mime ?? "")) {
    await deleteObject(c.data.key);
    return Response.json({ error: "Dosya 8 MB'ı aşıyor veya desteklenmeyen türde." }, { status: 400 });
  }
  return Response.json({ ok: true, key: c.data.key }, { headers: { "Cache-Control": "no-store" } });
}
