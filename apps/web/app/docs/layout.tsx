import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { DocSearch } from "@/components/docs/doc-search";
import { requireActor } from "@/lib/auth-guard";
import { docsFor, docTree } from "@/lib/docs";
import { getPreferences } from "@/lib/i18n/server";

/** /docs: sol sütunda ağaç navigasyon, üstte arama. Rol uygulamanın kabuğuyla aynı. */
export default async function DocsLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  const { locale } = await getPreferences();
  const tree = docTree(actor.role, locale);
  const items = docsFor(actor.role, locale).map((d) => ({ path: d.path, title: d.title, section: d.section, headings: d.headings, plain: d.plain }));
  return (
    <AppShell role={actor.role}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/docs" className="text-title">
            Dokümantasyon
          </Link>
          <div className="w-full md:w-96">
            <DocSearch items={items} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Doküman ağacı" className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
            {tree.map((s) => (
              <div key={s.section} className="flex flex-col gap-1">
                <span className="text-label text-fg-passive">{s.label}</span>
                {s.items.map((i) => (
                  <Link key={i.path} href={`/docs/${i.path}`} className="rounded-[6px] px-2 py-1 text-[13px] text-fg-muted hover:bg-surface hover:text-fg">
                    {i.title}
                    {i.verification === "dogrulanmadi" ? <span className="ml-1 text-[#facc15]" aria-label="doğrulanmadı">•</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
