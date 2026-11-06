import { redirect } from "next/navigation";
/** Açık çağrılar artık Teklifler sayfasında. */
export default function OldInfluencerOpenCallsRedirect() {
  redirect("/influencer/teklifler?sekme=cagrilar");
}
