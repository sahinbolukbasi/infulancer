import { redirect } from "next/navigation";
/** Creative tek stüdyoda birleşti; yönetim (kredi, modeller) /creative içindeki sekmede. */
export default function AdminCreativeRedirect() {
  redirect("/creative?sekme=yonetim");
}
