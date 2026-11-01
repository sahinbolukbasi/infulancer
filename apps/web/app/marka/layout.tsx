import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

export default function BrandLayout({ children }: { children: ReactNode }) {
  return <AppShell role="BRAND">{children}</AppShell>;
}
