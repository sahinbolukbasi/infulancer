import { redirect } from "next/navigation";
/** Başvuru çağrıları artık Teklifler sayfasında. */
export default function OldOpenCallsRedirect() {
  redirect("/marka/teklifler?sekme=cagrilar");
}
