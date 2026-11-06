import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { envStr } from "../env";
import { DomainError } from "../domain/errors";

/** Kısa link: /l/<slug> → hedef URL. Her ziyaret tıklamayı sayar. */
function genSlug(): string {
  return randomBytes(5).toString("base64url").replace(/[-_]/g, "").slice(0, 7);
}

export async function createShortLink(targetUrl: string, opts?: { label?: string; createdByUserId?: string | null }): Promise<{ id: string; slug: string; shortUrl: string }> {
  try {
    new URL(targetUrl);
  } catch {
    throw new DomainError("DOGRULAMA", "Geçerli bir URL girin (http/https).");
  }
  let slug = genSlug();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.shortLink.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) break;
    slug = genSlug();
  }
  const link = await prisma.shortLink.create({ data: { slug, targetUrl, label: opts?.label ?? null, createdByUserId: opts?.createdByUserId ?? null } });
  const base = envStr("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  return { id: link.id, slug: link.slug, shortUrl: `${base}/l/${link.slug}` };
}

/** Slug'ı çözer ve tıklamayı artırır (yoksa null). */
export async function resolveAndCount(slug: string): Promise<string | null> {
  const link = await prisma.shortLink.findUnique({ where: { slug }, select: { id: true, targetUrl: true } });
  if (!link) return null;
  await prisma.shortLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 }, lastClickAt: new Date() } });
  return link.targetUrl;
}

/** Kısa linki siler (yönetici). */
export async function deleteShortLink(id: string): Promise<void> {
  await prisma.shortLink.deleteMany({ where: { id } });
}
