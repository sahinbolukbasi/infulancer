import { redirect } from "next/navigation";
/** Asistanlar artık Kanallar sayfasında. */
export default function BrandAssistantsPage() {
  redirect("/marka/kanallar?sekme=asistan");
}
