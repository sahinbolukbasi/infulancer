import type { Metadata } from "next";
import { LandingEditor } from "@/components/landing/landing-editor";
import { PageHeader } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";
import { CREATOR_TONES, getLandingContent, LANDING_TONES } from "@/lib/landing-store";
export const metadata: Metadata = { title: "Tanıtım sayfası" };
export const dynamic = "force-dynamic";
/** Ana sayfadaki video/reklam kartları, referanslar ve içerik üreticisi şeridinin yönetimi. */
export default async function LandingAdminPage() {
  await requireActor("ADMIN");
  const content = await getLandingContent();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tanıtım sayfası"
        description="Ana sayfada görünen video ve reklam kartlarını, referansları ve içerik üreticisi şeridini buradan yönetin. Kaydettiğinizde site hemen güncellenir."
      />
      <LandingEditor initial={content} tones={LANDING_TONES} creatorTones={CREATOR_TONES} />
    </div>
  );
}
