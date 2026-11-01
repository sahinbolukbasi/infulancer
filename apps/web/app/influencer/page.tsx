import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "İşlerim" };

export default async function InfluencerHomePage() {
  await requireActor("INFLUENCER");
  return (
    <Stagger className="flex flex-col gap-6">
      <PageHeader title="İşlerim" description="Brief, dosyalar, yayın tarihleri ve bakiyeniz tek yerde." />
      <EmptyState
        message="Size bir iş atandığında brief ve teslim tarihleri burada listelenecek."
        action={{ label: "Ödemelerim", href: "/influencer/odemeler" }}
      />
    </Stagger>
  );
}
