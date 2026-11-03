import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote-client/rsc";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { mdxComponents, VerificationBadge } from "@/components/docs/doc-components";
import { requireActor } from "@/lib/auth-guard";
import { canRead, findDoc, SECTION_LABELS } from "@/lib/docs";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = findDoc(slug.join("/"));
  return { title: doc ? `${doc.title} · Dokümantasyon` : "Dokümantasyon" };
}

export default async function DocPage({ params }: Props) {
  const actor = await requireActor();
  const { slug } = await params;
  const doc = findDoc(slug.join("/"));
  if (!doc || !canRead(actor.role, doc)) notFound();

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_220px]">
      <article className="min-w-0 max-w-3xl">
        <p className="text-label text-fg-passive">{SECTION_LABELS[doc.section] ?? doc.section}</p>
        <h1 className="mt-1 text-[32px] font-semibold tracking-tight">{doc.title}</h1>
        <div className="mt-3 flex flex-col gap-3">
          <VerificationBadge value={doc.verification} />
          {doc.updatedAt ? <p className="text-[12px] text-fg-passive">Son güncelleme: {doc.updatedAt}</p> : null}
        </div>
        <div className="mt-6">
          <MDXRemote
            source={doc.body}
            components={mdxComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] }, disableImports: true, disableExports: true }}
          />
        </div>
        {doc.sources.length ? (
          <section className="mt-10 border-t border-border pt-6" aria-labelledby="kaynaklar">
            <h2 id="kaynaklar" className="text-sm font-semibold text-fg">
              Kaynaklar
            </h2>
            <ul className="mt-2 flex flex-col gap-1 text-[13px] text-fg-muted">
              {doc.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {s.label}
                    <span className="sr-only"> (yeni sekmede açılır)</span>
                  </a>
                  {s.checkedAt ? <span className="text-fg-passive"> · kontrol {s.checkedAt}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
      {doc.headings.length ? (
        <nav aria-label="Sayfa içi başlıklar" className="hidden xl:sticky xl:top-6 xl:block xl:self-start">
          <p className="text-label text-fg-passive">Bu sayfada</p>
          <ul className="mt-2 flex flex-col gap-1 text-[13px]">
            {doc.headings.map((h) => (
              <li key={h.id} className={h.depth === 3 ? "pl-3" : ""}>
                <a href={`#${h.id}`} className="text-fg-muted hover:text-fg">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
