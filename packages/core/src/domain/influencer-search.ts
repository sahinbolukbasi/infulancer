import { prisma } from "../db";
import type { Platform, Prisma } from "../generated/prisma/client";

/**
 * Influencer arama filtreleri (admin listesi). Filtreler URL query'sinden okunur, paylaşılabilir.
 * Kitle filtreleri SocialAccount.demographics (gender.kadin, ageGroups["18-24"], topCities[]) üzerinden.
 */
export type InfluencerFilters = {
  q?: string;
  categoryIds?: string[];
  platform?: Platform;
  minFollowers?: number;
  maxFollowers?: number;
  minEr?: number; // oran (0.03 = %3)
  maxRisk?: number;
  minWomen?: number; // oran
  ageGroup?: string; // "18-24" vb., en az %25 pay
  city?: string;
  availableFrom?: Date;
  availableTo?: Date;
  taxStatus?: "istisna_20b" | "kayitli_mukellef" | "diger";
  sort?: "name" | "followers" | "er" | "risk";
};

export const AGE_GROUPS = ["13-17", "18-24", "25-34", "35-44", "45+"] as const;

function num(v: string | null | undefined): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function day(v: string | null | undefined): Date | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00+03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** URLSearchParams / Next searchParams → filtre nesnesi (geçersiz değerler yok sayılır). */
export function parseFilters(sp: Record<string, string | string[] | undefined>): InfluencerFilters {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const many = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).filter(Boolean);
  };
  const platform = one("platform");
  const tax = one("vergi");
  const sort = one("sirala");
  const er = num(one("minEr"));
  const women = num(one("minKadin"));
  return {
    q: one("q")?.trim().slice(0, 80) || undefined,
    categoryIds: many("kategori").slice(0, 20),
    platform: platform === "INSTAGRAM" || platform === "TIKTOK" || platform === "YOUTUBE" ? platform : undefined,
    minFollowers: num(one("minTakipci")),
    maxFollowers: num(one("maxTakipci")),
    minEr: er != null ? er / 100 : undefined,
    maxRisk: num(one("maxRisk")),
    minWomen: women != null ? women / 100 : undefined,
    ageGroup: AGE_GROUPS.includes(one("yas") as (typeof AGE_GROUPS)[number]) ? one("yas") : undefined,
    city: one("sehir")?.trim().slice(0, 40) || undefined,
    availableFrom: day(one("musaitBas")),
    availableTo: day(one("musaitBit")),
    taxStatus: tax === "istisna_20b" || tax === "kayitli_mukellef" || tax === "diger" ? tax : undefined,
    sort: sort === "followers" || sort === "er" || sort === "risk" ? sort : "name",
  };
}

export function activeFilterCount(f: InfluencerFilters): number {
  return Object.entries(f).filter(([k, v]) => k !== "sort" && (Array.isArray(v) ? v.length > 0 : v != null)).length;
}

type Demo = { gender?: { kadin?: number }; ageGroups?: Record<string, number>; topCities?: { city: string; share: number }[] };

/** Filtreye uyan influencer kimlikleri (veritabanı + kitle verisi üzerinde). */
export async function searchInfluencerIds(f: InfluencerFilters): Promise<string[]> {
  const accountWhere: Prisma.SocialAccountWhereInput = {
    ...(f.platform ? { platform: f.platform } : {}),
    ...(f.minFollowers != null || f.maxFollowers != null ? { followers: { ...(f.minFollowers != null ? { gte: f.minFollowers } : {}), ...(f.maxFollowers != null ? { lte: f.maxFollowers } : {}) } } : {}),
    ...(f.minEr != null ? { engagementRate: { gte: f.minEr } } : {}),
  };
  const hasAccountFilter = Object.keys(accountWhere).length > 0;

  // Seçilen ana kategori alt kategorilerini de kapsar.
  let categoryIds = f.categoryIds ?? [];
  if (categoryIds.length) {
    const children = await prisma.category.findMany({ where: { parentId: { in: categoryIds } }, select: { id: true } });
    categoryIds = [...new Set([...categoryIds, ...children.map((c) => c.id)])];
  }

  const where: Prisma.InfluencerWhereInput = {
    AND: [
      f.q
        ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { socialAccounts: { some: { handle: { contains: f.q.replace(/^@/, ""), mode: "insensitive" } } } }, { city: { contains: f.q, mode: "insensitive" } }] }
        : {},
      categoryIds.length ? { categories: { some: { categoryId: { in: categoryIds } } } } : {},
      hasAccountFilter ? { socialAccounts: { some: accountWhere } } : {},
      f.maxRisk != null ? { OR: [{ riskScore: null }, { riskScore: { lte: f.maxRisk } }] } : {},
      f.taxStatus ? { taxProfile: { status: f.taxStatus } } : {},
      f.availableFrom && f.availableTo
        ? { assignments: { none: { contractStatus: { not: "RED" }, deliverables: { some: { status: { not: "IPTAL" }, plannedAt: { gte: f.availableFrom, lte: new Date(f.availableTo.getTime() + 86_400_000) } } } } } }
        : {},
    ],
  };
  const rows = await prisma.influencer.findMany({ where, select: { id: true, city: true, socialAccounts: { where: hasAccountFilter ? accountWhere : undefined, select: { demographics: true } } } });

  return rows
    .filter((r) => {
      if (f.minWomen == null && !f.ageGroup && !f.city) return true;
      return r.socialAccounts.some((a) => {
        const d = (a.demographics ?? {}) as Demo;
        if (f.minWomen != null && (d.gender?.kadin ?? 0) < f.minWomen) return false;
        if (f.ageGroup && (d.ageGroups?.[f.ageGroup] ?? 0) < 0.25) return false;
        if (f.city) {
          const c = f.city.toLocaleLowerCase("tr");
          const inAudience = (d.topCities ?? []).some((x) => x.city.toLocaleLowerCase("tr") === c && x.share >= 0.1);
          if (!inAudience && r.city?.toLocaleLowerCase("tr") !== c) return false;
        }
        return true;
      });
    })
    .map((r) => r.id);
}
