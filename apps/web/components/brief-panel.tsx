import { getTT } from "@/lib/i18n/tt-server";
import type { ReactNode } from "react";

export type BriefView = {
  version: number;
  text: string;
  dos: string[];
  donts: string[];
  hashtags: string[];
  mentions: string[];
  requiredPhrases: string[];
  bannedPhrases: string[];
  disclosureRequired: boolean;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label text-fg-muted">{title}</h3>
      {children}
    </div>
  );
}

function Items({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-[13px] text-fg-passive">—</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm text-fg">
      {items.map((i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="text-fg-passive">
            –
          </span>
          {i}
        </li>
      ))}
    </ul>
  );
}

/** Brief'in okunur görünümü (admin, influencer). */
export async function BriefPanel({ brief, disclosureLabel }: { brief: BriefView; disclosureLabel?: string }) {
  const tt = await getTT();
  return (
    <div className="flex flex-col gap-6">
      <p className="text-label text-fg-passive">{tt("Sürüm v")}{brief.version}</p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-fg">{brief.text}</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Group title={tt("Yapılacaklar")}>
          <Items items={brief.dos} />
        </Group>
        <Group title={tt("Yapılmayacaklar")}>
          <Items items={brief.donts} />
        </Group>
        <Group title={tt("Hashtag / bahsetme")}>
          <p className="text-sm text-fg">{[...brief.hashtags, ...brief.mentions].join(" ") || "—"}</p>
        </Group>
        <Group title={tt("Reklam ibaresi")}>
          <p className="text-sm text-fg">
            {brief.disclosureRequired ? `Zorunlu${disclosureLabel ? ` — ${disclosureLabel}` : ""}` : tt("Zorunlu değil")}
          </p>
        </Group>
        <Group title={tt("Zorunlu ifadeler")}>
          <Items items={brief.requiredPhrases} />
        </Group>
        <Group title={tt("Yasaklı ifadeler")}>
          <Items items={brief.bannedPhrases} />
        </Group>
      </div>
    </div>
  );
}
