import { prisma } from "@infulancer/core/db";
import { DomainError } from "@infulancer/core/domain/errors";

/** Form'dan kategori seçimini okur; geriye uyumlu metin alanı için ana kategorinin adını döndürür. */
export async function readCategorySelection(fd: FormData) {
  const ids = [...new Set(fd.getAll("categoryIds").map(String).filter((x) => /^[a-z0-9_]{3,64}$/i.test(x)))];
  if (ids.length === 0) throw new DomainError("DOGRULAMA", "En az bir kategori seçin.");
  const rawPrimary = String(fd.get("primaryCategoryId") ?? "");
  const primaryId = ids.includes(rawPrimary) ? rawPrimary : ids[0]!;
  const primary = await prisma.category.findUnique({ where: { id: primaryId }, include: { parent: { select: { name: true } } } });
  if (!primary) throw new DomainError("DOGRULAMA", "Geçersiz kategori seçimi.");
  return { ids, primaryId, legacyName: (primary.parent?.name ?? primary.name).toLocaleLowerCase("tr") };
}
