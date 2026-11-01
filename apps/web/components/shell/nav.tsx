"use client";

import type { ComponentType } from "react";
import type { Role } from "@infulancer/core/enums";
import {
  BuildingIcon,
  CalendarIcon,
  HomeIcon,
  LinkIcon,
  MegaphoneIcon,
  SparkleIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from "@/components/icons";

export type NavItem = { href: string; label: string; icon: ComponentType<IconProps>; exact?: boolean };

/** Rol başına gezinme öğeleri (kenar çubuğu ve mobil sekme çubuğu ortak kullanır). */
export const navByRole: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "Genel bakış", icon: HomeIcon, exact: true },
    { href: "/admin/kampanyalar", label: "Kampanyalar", icon: MegaphoneIcon },
    { href: "/admin/takvim", label: "Takvim", icon: CalendarIcon },
    { href: "/admin/influencerlar", label: "Influencerlar", icon: UsersIcon },
    { href: "/admin/markalar", label: "Markalar", icon: BuildingIcon },
    { href: "/admin/finans", label: "Finans", icon: WalletIcon },
    { href: "/admin/agent", label: "Agent", icon: SparkleIcon },
  ],
  BRAND: [
    { href: "/marka", label: "Kampanyalarım", icon: MegaphoneIcon, exact: true },
  ],
  INFLUENCER: [
    { href: "/influencer", label: "İşlerim", icon: HomeIcon, exact: true },
    { href: "/influencer/odemeler", label: "Ödemeler", icon: WalletIcon },
    { href: "/influencer/hesaplar", label: "Hesaplar", icon: LinkIcon },
  ],
};

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
