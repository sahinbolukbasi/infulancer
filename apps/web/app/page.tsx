import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth-guard";
import { roleHome } from "@/lib/roles";

export default async function RootPage() {
  const actor = await getActor();
  redirect(actor ? roleHome[actor.role] : "/giris");
}
