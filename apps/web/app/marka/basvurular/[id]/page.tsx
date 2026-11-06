import { redirect } from "next/navigation";
/** Eski adres: çağrı detayı Teklifler altında. */
export default async function OldOpenCallDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/marka/teklifler/cagri/${id}`);
}
