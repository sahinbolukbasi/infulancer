import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { CreatorShowcase } from "@/components/showcase/creator-showcase";
import { ButtonLink } from "@/components/ui/form";
import { requireActor } from "@/lib/auth-guard";
export const metadata: Metadata = { title: "İçerik üreticisi profili" };
export const dynamic = "force-dynamic";

/** Marka: içerik üreticisinin detaylı profili (vitrin). Gizli profiller açılmaz. */
export default async function CreatorProfileForBrand({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("BRAND");
  const { id } = await params;
  const inf = await prisma.influencer.findFirst({ where: { id, showcaseVisible: true, user: { status: "ACTIVE" } }, select: { id: true } });
  if (!inf) notFound();
  return (
    <div className="flex flex-col gap-4">
      <ButtonLink href="/marka/kesfet" variant="ghost" size="sm" className="w-fit">
        ← Influencer bul
      </ButtonLink>
      <CreatorShowcase
        influencerId={inf.id}
        actions={
          <ButtonLink href={`/marka/kesfet?sec=${inf.id}`} className="bg-neon text-black">
            Teklif gönder →
          </ButtonLink>
        }
      />
    </div>
  );
}
