import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, Stagger } from "@/components/ui/layout";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Genel bakış" };

export default async function AdminHomePage() {
  await requireActor("ADMIN");
  return (
    <Stagger className="flex flex-col gap-8">
      <PageHeader title="Genel bakış" description="Aktif kampanyalar, onay bekleyen içerikler ve agent uyarıları burada toplanır." />
      <EmptyState
        message="Operasyon özeti, aksiyon kuyruğu ve haftalık takvim kampanyalar oluşturuldukça burada görünecek."
        action={{ label: "Kampanyalara git", href: "/admin/kampanyalar" }}
      />
    </Stagger>
  );
}
