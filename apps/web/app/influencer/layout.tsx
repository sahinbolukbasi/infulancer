import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

export default function InfluencerLayout({ children }: { children: ReactNode }) {
  return <AppShell role="INFLUENCER">{children}</AppShell>;
}
