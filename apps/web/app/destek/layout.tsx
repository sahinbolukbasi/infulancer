import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { getActor } from "@/lib/auth-guard";
/** /destek: girişli kullanıcı kendi panel kabuğunda görür; girişsizse sade çerçeve. */
export default async function SupportLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) return <main className="min-h-dvh bg-bg">{children}</main>;
  return <AppShell role={actor.role}>{children}</AppShell>;
}
