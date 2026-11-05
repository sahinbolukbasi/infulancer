"use client";
import type { ComponentType } from "react";
import type { Role } from "@infulancer/core/enums";
import {
  AlertIcon,
  FileIcon,
  GridIcon,
  SettingsIcon,
  UserIcon,
  BellIcon,
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
    { href: "/admin/teklifler", label: "Teklifler", icon: WalletIcon },
    { href: "/admin/takvim", label: "Takvim", icon: CalendarIcon },
    { href: "/admin/influencerlar", label: "Influencerlar", icon: UsersIcon },
    { href: "/admin/markalar", label: "Markalar", icon: BuildingIcon },
    { href: "/admin/finans", label: "Finans", icon: WalletIcon },
    { href: "/admin/agent", label: "Agent merkezi", icon: SparkleIcon },
    { href: "/admin/kanallar", label: "Kanallar", icon: LinkIcon },
    { href: "/admin/uyum", label: "Uyum", icon: AlertIcon },
    { href: "/admin/reklam", label: "Reklam", icon: MegaphoneIcon },
    { href: "/admin/creative", label: "Creative", icon: SparkleIcon },
    { href: "/admin/ai", label: "AI sağlayıcıları", icon: SparkleIcon },
    { href: "/admin/kategoriler", label: "Kategoriler", icon: CalendarIcon },
    { href: "/admin/davetler", label: "Davetler", icon: UserIcon },
    { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: UsersIcon },
    { href: "/admin/yetkiler", label: "Rol ve yetkiler", icon: SettingsIcon },
    { href: "/admin/tanitim", label: "Tanıtım sayfası", icon: GridIcon },
    { href: "/docs", label: "Dokümantasyon", icon: FileIcon },
  ],
  // Ajans çalışanı: yönetici ekranları (kullanıcılar, yetkiler, finans, tanıtım, AI sağlayıcıları) hariç.
  AGENCY: [],
  BRAND: [
    { href: "/marka", label: "Kampanyalarım", icon: MegaphoneIcon, exact: true },
    { href: "/marka/kesfet", label: "Influencer bul", icon: UsersIcon },
    { href: "/marka/teklifler", label: "Teklifler", icon: WalletIcon },
    { href: "/marka/gelen-kutusu", label: "Gelen kutusu", icon: BellIcon },
    { href: "/marka/kanallar", label: "Kanallar ve asistan", icon: LinkIcon },
    { href: "/marka/uyum", label: "Uyum", icon: AlertIcon },
    { href: "/profil", label: "Profilim", icon: UserIcon },
    { href: "/docs", label: "Dokümantasyon", icon: FileIcon },
  ],
  INFLUENCER: [
    { href: "/influencer", label: "İşlerim", icon: HomeIcon, exact: true },
    { href: "/influencer/teklifler", label: "Teklifler", icon: MegaphoneIcon },
    { href: "/influencer/vitrin", label: "Vitrinim", icon: SparkleIcon },
    { href: "/influencer/odemeler", label: "Ödemeler", icon: WalletIcon },
    { href: "/influencer/hesaplar", label: "Hesaplar", icon: LinkIcon },
    { href: "/influencer/davet", label: "Davet et", icon: UserIcon },
    { href: "/profil", label: "Profilim", icon: UserIcon },
    { href: "/docs", label: "Rehber", icon: FileIcon },
  ],
};
navByRole.AGENCY = navByRole.ADMIN.filter((i) => !["/admin/kullanicilar", "/admin/yetkiler", "/admin/tanitim", "/admin/finans", "/admin/ai"].includes(i.href));
export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
