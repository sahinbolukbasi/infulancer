import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import GithubSlugger from "github-slugger";
import { getFrontmatter } from "next-mdx-remote-client/utils";
import type { Role } from "@infulancer/core/enums";

/**
 * /docs içerik deposu: content/docs/<bölüm>/<sayfa>.mdx. Frontmatter:
 * title, slug, updatedAt, verification (dogrulandi | dogrulanmadi | kismi), summary, sources[{label,url,checkedAt}].
 * Erişim: admin + marka tüm sayfalar; influencer yalnız slug'ı "influencer-" ile başlayan sayfalar.
 */
export type Verification = "dogrulandi" | "dogrulanmadi" | "kismi";
export type DocSource = { label: string; url: string; checkedAt?: string };
export type DocMeta = {
  path: string; // "platformlar/meta-marketing-api"
  section: string;
  title: string;
  slug: string;
  summary: string;
  updatedAt: string;
  verification: Verification;
  sources: DocSource[];
  order: number;
};
export type DocHeading = { depth: 2 | 3; text: string; id: string };
export type DocEntry = DocMeta & { body: string; headings: DocHeading[]; plain: string };

export const SECTION_LABELS: Record<string, string> = {
  baslangic: "Başlangıç",
  platformlar: "Platformlar",
  uyum: "Uyum",
  creative: "Creative",
  operasyon: "Operasyon",
  influencer: "Influencer rehberi",
};
const SECTION_ORDER = ["baslangic", "platformlar", "uyum", "creative", "operasyon", "influencer"];

function root() {
  return path.join(process.cwd(), "content", "docs");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f.endsWith(".mdx") ? [p] : [];
  });
}

function headingsOf(body: string): DocHeading[] {
  const slugger = new GithubSlugger();
  const out: DocHeading[] = [];
  let inCode = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("```")) inCode = !inCode;
    if (inCode) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (m) {
      const text = m[2]!.replace(/[`*_]/g, "");
      out.push({ depth: m[1]!.length as 2 | 3, text, id: slugger.slug(text) });
    }
  }
  return out;
}

function plainOf(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>|[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

export const allDocs = cache((): DocEntry[] => {
  const base = root();
  return walk(base)
    .map((file) => {
      const rel = path.relative(base, file).replace(/\\/g, "/").replace(/\.mdx$/, "");
      const raw = readFileSync(file, "utf8");
      const { frontmatter, strippedSource } = getFrontmatter<Record<string, unknown>>(raw);
      const section = rel.split("/")[0]!;
      const v = String(frontmatter.verification ?? "dogrulanmadi");
      return {
        path: rel,
        section,
        title: String(frontmatter.title ?? rel),
        slug: String(frontmatter.slug ?? rel.split("/").pop()),
        summary: String(frontmatter.summary ?? ""),
        updatedAt: String(frontmatter.updatedAt ?? ""),
        verification: (v === "dogrulandi" || v === "kismi" ? v : "dogrulanmadi") as Verification,
        sources: Array.isArray(frontmatter.sources) ? (frontmatter.sources as DocSource[]) : [],
        order: Number(frontmatter.order ?? 100),
        body: strippedSource,
        headings: headingsOf(strippedSource),
        plain: plainOf(strippedSource),
      };
    })
    .sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.order - b.order || a.title.localeCompare(b.title, "tr"));
});

export function canRead(role: Role, doc: Pick<DocMeta, "slug">): boolean {
  if (role === "ADMIN" || role === "BRAND") return true;
  return doc.slug.startsWith("influencer-");
}

export function docsFor(role: Role): DocEntry[] {
  return allDocs().filter((d) => canRead(role, d));
}

export function findDoc(pathOrSlug: string): DocEntry | undefined {
  const all = allDocs();
  return all.find((d) => d.path === pathOrSlug) ?? all.find((d) => d.slug === pathOrSlug);
}

export function docTree(role: Role) {
  const docs = docsFor(role);
  return SECTION_ORDER.filter((s) => docs.some((d) => d.section === s)).map((s) => ({
    section: s,
    label: SECTION_LABELS[s] ?? s,
    items: docs.filter((d) => d.section === s).map((d) => ({ path: d.path, title: d.title, verification: d.verification })),
  }));
}

export const verificationLabels: Record<Verification, string> = {
  dogrulandi: "Doğrulandı",
  kismi: "Kısmen doğrulandı",
  dogrulanmadi: "Doğrulanmadı",
};
