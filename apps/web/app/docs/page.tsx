import type { Metadata } from "next";
import Link from "next/link";
import { requireActor } from "@/lib/auth-guard";
import { docTree, docsFor } from "@/lib/docs";
import { getPreferences } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Dokümantasyon" };

export default async function DocsIndexPage() {
  const actor = await requireActor();
  const { locale } = await getPreferences();
  const tree = docTree(actor.role, locale);
  const docs = docsFor(actor.role, locale);
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-3xl text-sm text-fg-muted">
        Operasyon ekranları sayı ve durum gösterir; “neden böyle” burada anlatılır. Platform kısıtları (Meta, Instagram, WhatsApp, TikTok, YouTube), yasal uyum kuralları ve AI üretim
        kuralları tek yerde. Sarı işaretli sayfalarda birincil kaynaktan doğrulanmamış bilgiler vardır.
      </p>
      {tree.map((s) => (
        <section key={s.section} className="flex flex-col gap-3" aria-labelledby={`sec-${s.section}`}>
          <h2 id={`sec-${s.section}`} className="text-section">
            {s.label}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {s.items.map((i) => {
              const d = docs.find((x) => x.path === i.path)!;
              return (
                <Link key={i.path} href={`/docs/${i.path}`} className="flex flex-col gap-1 rounded-[8px] border border-border p-4 hover:border-fg-muted">
                  <span className="text-sm text-fg">
                    {d.title}
                    {d.verification === "dogrulanmadi" ? <span className="ml-2 text-[11px] text-[#facc15]">doğrulanmadı</span> : null}
                  </span>
                  <span className="text-[13px] text-fg-muted">{d.summary}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
