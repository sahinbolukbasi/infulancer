import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireActor } from "@/lib/auth-guard";
/** /creative: tüm roller kendi panel kabuğunda kullanır. */
export default async function CreativeLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  return <AppShell role={actor.role}>{children}</AppShell>;
}
