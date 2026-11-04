import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireActor } from "@/lib/auth-guard";
/** /profil: her rol kendi panel kabuğunda görür. */
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  return <AppShell role={actor.role}>{children}</AppShell>;
}
