import type { ReactNode } from "react";
import Link from "next/link";
import type { LegalEntity } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: ReactNode };

const DOCS = [
  { href: "/gizlilik", label: "Gizlilik Politikası" },
  { href: "/kvkk", label: "KVKK Aydınlatma Metni" },
  { href: "/cerez-politikasi", label: "Çerez Politikası" },
  { href: "/kullanim-kosullari", label: "Kullanım Koşulları" },
];

/** Yasal belge şablonu: başlık, sürüm, içindekiler ve numaralı bölümler. */
export function LegalDoc({ title, intro, sections, entity, current }: { title: string; intro: ReactNode; sections: LegalSection[]; entity: LegalEntity; current: string }) {
  return (
    <div className="grid grid-cols-1 gap-10 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <nav aria-label="Yasal belgeler" className="flex flex-col gap-1 text-sm">
          {DOCS.map((d) => (
            <Link key={d.href} href={d.href} aria-current={d.href === current ? "page" : undefined} className={`rounded-lg px-3 py-2 ${d.href === current ? "bg-surface font-medium text-fg" : "text-fg-muted hover:text-fg"}`}>
              {d.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="İçindekiler" className="mt-6 hidden flex-col gap-1 border-l border-line pl-3 text-[13px] lg:flex">
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="py-0.5 text-fg-muted hover:text-fg">
              {i + 1}. {s.title}
            </a>
          ))}
        </nav>
      </aside>
      <article className="flex max-w-3xl flex-col gap-8 leading-relaxed">
        <header className="flex flex-col gap-3 border-b border-line pb-6">
          <h1 className="text-[34px] font-semibold tracking-tight">{title}</h1>
          <p className="text-[13px] text-fg-passive">
            Yürürlük ve son güncelleme: {entity.updatedAt} · Sürüm 1.0
          </p>
          <div className="text-[15px] text-fg-muted">{intro}</div>
        </header>
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="flex scroll-mt-20 flex-col gap-3 text-[15px] [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_strong]:text-fg">
            <h2 className="text-lg font-semibold">
              {i + 1}. {s.title}
            </h2>
            <div className="flex flex-col gap-3 text-fg-muted">{s.body}</div>
          </section>
        ))}
        <footer className="rounded-2xl border border-line bg-glass p-5 text-[14px] text-fg-muted">
          <p className="font-medium text-fg">{entity.title}</p>
          <p>{entity.address}</p>
          <p>
            E-posta: <a href={`mailto:${entity.email}`} className="underline underline-offset-4">{entity.email}</a> · KVKK başvuruları:{" "}
            <a href={`mailto:${entity.kvkkEmail}`} className="underline underline-offset-4">{entity.kvkkEmail}</a>
            {entity.kep ? ` · KEP: ${entity.kep}` : ""}
          </p>
          {entity.mersis || entity.taxNumber ? (
            <p>
              {entity.mersis ? `MERSİS: ${entity.mersis}` : ""}
              {entity.taxNumber ? ` · ${entity.taxOffice} V.D. ${entity.taxNumber}` : ""}
            </p>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
