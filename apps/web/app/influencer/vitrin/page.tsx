import { redirect } from "next/navigation";
/** Vitrin artık Profilim sayfasında. */
export default function ShowcaseRedirect() {
  redirect("/profil?sekme=vitrin");
}
