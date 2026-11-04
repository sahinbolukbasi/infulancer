import type { Metadata } from "next";
import { LandingEditor } from "@/components/landing/landing-editor";
import { PageHeader } from "@/components/ui/layout";
import { requireAdmin } from "@/lib/auth-guard";
import { CREATOR_TONES, getLandingContent, LANDING_TONES } from "@/lib/landing-store";
import { getLegalEntity } from "@/lib/legal";
import { LegalEntityForm } from "@/components/legal/legal-entity-form";
export const metadata: Metadata = { title: "Tanıtım sayfası" };
export const dynamic = "force-dynamic";
/** Ana sayfadaki video/reklam kartları, referanslar ve içerik üreticisi şeridinin yönetimi. */
export default async function LandingAdminPage() {
  await requireAdmin();
  const [content, legal] = await Promise.all([getLandingContent(), getLegalEntity()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tanıtım sayfası"
        description="Ana sayfada görünen video ve reklam kartlarını, referansları ve içerik üreticisi şeridini buradan yönetin. Kaydettiğinizde site hemen güncellenir."
      />
      <LandingEditor initial={content} tones={LANDING_TONES} creatorTones={CREATOR_TONES} />
      <details className="rounded-3xl border border-line bg-glass px-5 py-4">
        <summary className="cursor-pointer text-sm font-medium">Şirket bilgileri (Gizlilik, KVKK, Çerez, Kullanım koşulları)</summary>
        <div className="mt-4">
          <LegalEntityForm entity={legal} />
        </div>
      </details>
    </div>
  );
}
