import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { MDXComponents } from "next-mdx-remote-client/rsc";
import { cn } from "@/lib/cn";
import { findDoc, verificationLabels, type Verification } from "@/lib/docs";

/** Doğrulama rozeti; "doğrulanmadı" ise sarı şerit. */
export function VerificationBadge({ value }: { value: Verification }) {
  if (value === "dogrulanmadi") {
    return (
      <p role="note" className="rounded-[8px] border border-[#eab308] bg-[#eab308]/10 px-4 py-2 text-[13px] text-[#facc15]">
        {verificationLabels[value]}: bu sayfadaki bazı sayılar veya davranışlar birincil kaynaktan teyit edilmedi; kesin bilgi olarak kullanmayın.
      </p>
    );
  }
  return (
    <span className={cn("inline-flex w-fit items-center rounded-full border px-3 py-1 text-[12px]", value === "dogrulandi" ? "border-fg-muted text-fg" : "border-[#eab308] text-[#facc15]")}>
      {verificationLabels[value]}
    </span>
  );
}

/** Operasyon ekranlarında tek satır özet + "Ayrıntı →" bağlantısı. */
export function DocLink({ slug, className }: { slug: string; className?: string }) {
  const doc = findDoc(slug);
  if (!doc) return null;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 text-[13px] text-fg-muted", className)}>
      <span>{doc.summary || doc.title}</span>
      <Link href={`/docs/${doc.path}`} className="text-fg underline-offset-4 hover:underline">
        Ayrıntı →
      </Link>
    </p>
  );
}

function Callout({ type = "bilgi", children }: { type?: "bilgi" | "uyari" | "yasak"; children: ReactNode }) {
  const tone = type === "yasak" ? "border-critical" : type === "uyari" ? "border-[#eab308]" : "border-border";
  const label = type === "yasak" ? "Yasak" : type === "uyari" ? "Dikkat" : "Bilgi";
  return (
    <aside className={cn("my-4 rounded-[8px] border-l-4 border-y border-r px-4 py-3 text-sm", tone)} aria-label={label}>
      <strong className="mr-2 text-fg">{label}:</strong>
      <span className="text-fg-muted">{children}</span>
    </aside>
  );
}

function Unverified({ children }: { children?: ReactNode }) {
  return (
    <span className="ml-1 inline-flex items-center rounded-full border border-[#eab308] px-2 py-0.5 align-middle text-[11px] uppercase tracking-wide text-[#facc15]">
      {children ?? "doğrulanmadı"}
    </span>
  );
}

function A({ href = "", ...rest }: ComponentProps<"a">) {
  const external = /^https?:\/\//.test(href);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-fg underline underline-offset-4" {...rest}>
        {rest.children}
        <span className="sr-only"> (yeni sekmede açılır)</span>
      </a>
    );
  }
  return <Link href={href} className="text-fg underline underline-offset-4" {...rest} />;
}

export const mdxComponents: MDXComponents = {
  h2: (p) => <h2 {...p} className="mt-10 scroll-mt-24 text-[22px] font-semibold tracking-tight text-fg" />,
  h3: (p) => <h3 {...p} className="mt-6 scroll-mt-24 text-[17px] font-semibold text-fg" />,
  p: (p) => <p {...p} className="my-3 text-[15px] leading-7 text-fg-muted" />,
  ul: (p) => <ul {...p} className="my-3 list-disc space-y-1.5 pl-6 text-[15px] leading-7 text-fg-muted" />,
  ol: (p) => <ol {...p} className="my-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-fg-muted" />,
  li: (p) => <li {...p} className="pl-1" />,
  strong: (p) => <strong {...p} className="font-semibold text-fg" />,
  code: (p) => <code {...p} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px] text-fg" />,
  pre: (p) => <pre {...p} className="my-4 overflow-x-auto rounded-[8px] border border-border bg-surface p-4 text-[13px]" />,
  table: (p) => (
    <div className="my-4 overflow-x-auto">
      <table {...p} className="w-full text-sm" />
    </div>
  ),
  th: (p) => <th {...p} className="border-b border-border py-2 pr-4 text-left font-normal text-fg-muted" />,
  td: (p) => <td {...p} className="border-b border-border py-2 pr-4 align-top text-fg" />,
  blockquote: (p) => <blockquote {...p} className="my-4 border-l-2 border-border pl-4 text-fg-muted" />,
  hr: () => <hr className="my-8 border-border" />,
  a: A,
  Callout,
  Unverified,
  DocLink,
};
