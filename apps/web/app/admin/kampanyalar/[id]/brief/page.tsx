import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma, type CampaignBrief } from "@infulancer/core/db";
import { BriefForm } from "@/components/forms/brief-form";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Brief" };

const fieldLabels = {
  text: "Metin",
  dos: "Yapılacaklar",
  donts: "Yapılmayacaklar",
  hashtags: "Hashtagler",
  mentions: "Bahsetmeler",
  requiredPhrases: "Zorunlu ifadeler",
  bannedPhrases: "Yasaklı ifadeler",
  disclosureRequired: "Reklam ibaresi",
} as const;

/** Diff-lite: önceki sürüme göre değişen alanların listesi. */
function changedFields(prev: CampaignBrief | undefined, cur: CampaignBrief): string[] {
  if (!prev) return ["İlk sürüm"];
  return (Object.keys(fieldLabels) as (keyof typeof fieldLabels)[])
    .filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(cur[k]))
    .map((k) => fieldLabels[k]);
}

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const tt = await getTT();
  await requireActor("ADMIN");
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      briefs: { orderBy: { version: "asc" }, include: { createdBy: { select: { name: true } } } },
    },
  });
  if (!campaign) notFound();
  const versions = campaign.briefs;
  const latest = versions[versions.length - 1];

  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader
        title={`Brief · ${campaign.name}`}
        description={tt("Brief yerinde düzenlenmez; her kayıt yeni sürüm açar. Influencer her zaman son sürümü görür.")}
        actions={
          <ButtonLink href={`/admin/kampanyalar/${campaign.id}`} variant="secondary">{" "}{tt("Kampanyaya dön")}</ButtonLink>
        }
      />
      <div className="grid-12">
        <Card interactive={false} className="md:col-span-8">
          <BriefForm campaignId={campaign.id} latest={latest} nextVersion={(latest?.version ?? 0) + 1} />
        </Card>
        <Card interactive={false} className="flex flex-col gap-4 md:col-span-4">
          <CardTitle>{tt("Sürüm geçmişi")}</CardTitle>
          {versions.length === 0 ? (
            <p className="text-sm text-fg-passive">{tt("Henüz brief yok.")}</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {[...versions].reverse().map((v) => {
                const idx = versions.indexOf(v);
                const changes = changedFields(versions[idx - 1], v);
                return (
                  <li key={v.id} className="flex flex-col gap-1 border-l border-border pl-4">
                    <span className="text-sm text-fg">
                      v{v.version}
                      {v.id === latest?.id ? <span className="ml-2 text-[12px] text-fg-muted">{tt("güncel")}</span> : null}
                    </span>
                    <span className="text-[12px] text-fg-passive">
                      {fmtDateTime(v.createdAt)} · {v.createdBy.name}
                    </span>
                    <span className="text-[13px] text-fg-muted">
                      {changes.length ? `Değişen: ${changes.join(", ")}` : tt("Değişiklik yok")}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </Stagger>
  );
}
