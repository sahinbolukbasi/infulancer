import { prisma, type Tx } from "../db";
import { DomainError } from "./errors";

/**
 * Kategori taksonomisi (ana/alt). Influencer ve marka birden çok kategori taşır; biri "ana".
 * Geriye uyumluluk: Influencer.category / Brand.category ana kategorinin adını tutar
 * (marka çakışması, öneri agent'ı ve eski ekranlar bu alanı okumaya devam eder).
 */
export function slugify(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâî]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ALIASES: Record<string, string> = {
  kozmetik: "guzellik", "güzellik": "guzellik", giyim: "moda", spor: "spor-fitness", "spor giyim": "spor-fitness",
  "gıda": "yemek", "içecek": "yemek", "yaşam": "yasam-tarzi", lifestyle: "yasam-tarzi", "sağlık": "saglikli-yasam",
};

export type CategoryNode = { id: string; slug: string; name: string; children: { id: string; slug: string; name: string }[] };

export async function categoryTree(db: Tx = prisma): Promise<CategoryNode[]> {
  const all = await db.category.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
  const roots = all.filter((c) => !c.parentId);
  return roots.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    children: all.filter((c) => c.parentId === r.id).map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
  }));
}

/** Kategori kimliğinden, varsa ebeveyni dahil, okunur ad ("Güzellik › Makyaj"). */
export function categoryLabel(c: { name: string; parent?: { name: string } | null }): string {
  return c.parent ? `${c.parent.name} › ${c.name}` : c.name;
}

async function validate(db: Tx, ids: string[], primaryId: string | null) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new DomainError("DOGRULAMA", "En az bir kategori seçin.");
  if (unique.length > 8) throw new DomainError("DOGRULAMA", "En fazla 8 kategori seçilebilir.");
  const found = await db.category.findMany({ where: { id: { in: unique } }, include: { parent: { select: { name: true } } } });
  if (found.length !== unique.length) throw new DomainError("DOGRULAMA", "Geçersiz kategori seçimi.");
  const primary = found.find((c) => c.id === (primaryId && unique.includes(primaryId) ? primaryId : unique[0]))!;
  return { unique, primary };
}

export async function setInfluencerCategories(db: Tx, influencerId: string, ids: string[], primaryId: string | null) {
  const { unique, primary } = await validate(db, ids, primaryId);
  await db.influencerCategory.deleteMany({ where: { influencerId } });
  await db.influencerCategory.createMany({ data: unique.map((categoryId) => ({ influencerId, categoryId, primary: categoryId === primary.id })) });
  // Geriye uyumlu alan: ana kategorinin (alt kategoriyse ebeveyninin) adı.
  await db.influencer.update({ where: { id: influencerId }, data: { category: (primary.parent?.name ?? primary.name).toLocaleLowerCase("tr") } });
}

export async function setBrandCategories(db: Tx, brandId: string, ids: string[], primaryId: string | null) {
  const { unique, primary } = await validate(db, ids, primaryId);
  await db.brandCategory.deleteMany({ where: { brandId } });
  await db.brandCategory.createMany({ data: unique.map((categoryId) => ({ brandId, categoryId, primary: categoryId === primary.id })) });
  await db.brand.update({ where: { id: brandId }, data: { category: (primary.parent?.name ?? primary.name).toLocaleLowerCase("tr") } });
}

/** Kategori bağı olmayan kayıtları serbest metin alanından bağlar (seed ve eski veri için). */
export async function backfillLegacyCategories(db: Tx = prisma) {
  const cats = await db.category.findMany();
  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const resolve = async (raw: string) => {
    const key = raw.trim().toLocaleLowerCase("tr");
    if (!key) return null;
    const slug = ALIASES[key] ?? slugify(key);
    let c = bySlug.get(slug);
    if (!c) {
      c = await db.category.create({ data: { slug, name: key.charAt(0).toLocaleUpperCase("tr") + key.slice(1), sort: 900 } });
      bySlug.set(slug, c);
    }
    return c;
  };
  let n = 0;
  for (const i of await db.influencer.findMany({ where: { categories: { none: {} } }, select: { id: true, category: true } })) {
    const c = await resolve(i.category);
    if (c) {
      await db.influencerCategory.create({ data: { influencerId: i.id, categoryId: c.id, primary: true } });
      n++;
    }
  }
  for (const b of await db.brand.findMany({ where: { categories: { none: {} } }, select: { id: true, category: true } })) {
    const c = await resolve(b.category);
    if (c) {
      await db.brandCategory.create({ data: { brandId: b.id, categoryId: c.id, primary: true } });
      n++;
    }
  }
  return n;
}

export async function upsertCategory(input: { id?: string; name: string; parentId?: string | null; sort?: number; active?: boolean }) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new DomainError("DOGRULAMA", "Kategori adı 2–60 karakter olmalı.");
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new DomainError("DOGRULAMA", "Üst kategori bulunamadı.");
    if (parent.parentId) throw new DomainError("DOGRULAMA", "Yalnız iki seviye (ana › alt) desteklenir.");
    if (input.id && parent.id === input.id) throw new DomainError("DOGRULAMA", "Kategori kendi altına taşınamaz.");
  }
  const data = { name, parentId: input.parentId ?? null, sort: input.sort ?? 500, active: input.active ?? true };
  if (input.id) return prisma.category.update({ where: { id: input.id }, data });
  return prisma.category.create({ data: { ...data, slug: slugify(name) } });
}
