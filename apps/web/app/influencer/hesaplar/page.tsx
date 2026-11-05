import { redirect } from "next/navigation";
/** Hesaplar artık Profilim sayfasında. */
export default function AccountsRedirect() {
  redirect("/profil?sekme=hesaplar");
}
