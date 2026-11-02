import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth-guard";

// Influencer takip profili FEAT-004'te; şimdilik düzenleme ekranına yönlendirir.
export default async function InfluencerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("ADMIN");
  const { id } = await params;
  redirect(`/admin/influencerlar/${encodeURIComponent(id)}/duzenle`);
}
