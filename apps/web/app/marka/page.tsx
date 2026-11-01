import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Kampanyalarım" };

export default async function BrandHomePage() {
  await requireActor("BRAND");
  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader title="Kampanyalarım" description="Kampanya skorları, yayın takvimi ve onayınızı bekleyen taslaklar." />
      <EmptyState
        message="Ajansınız bir kampanya başlattığında skoru ve raporu burada görünecek."
        action={{ label: "Sayfayı yenile", href: "/marka" }}
      />
    </Stagger>
  );
}
