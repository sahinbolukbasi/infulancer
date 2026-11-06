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
export type NavItem = { href: string; label: string; icon: ComponentType<IconProps>; exact?: boolean; section?: string };
/**
 * Rol başına gezinme öğeleri (kenar çubuğu ve mobil sekme çubuğu ortak kullanır).
 * Sıra önemlidir: mobil sekme çubuğu yalnız ilk 5 öğeyi gösterir, bu yüzden en sık
 * kullanılanlar başa alınır. `section` alanı kenar çubuğunda grup başlığı oluşturur.
 */
export const navByRole: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "Genel bakış", icon: HomeIcon, exact: true, section: "Çalışma" },
    { href: "/admin/kampanyalar", label: "Kampanyalar", icon: MegaphoneIcon, section: "Çalışma" },
    { href: "/admin/teklifler", label: "Teklifler", icon: WalletIcon, section: "Çalışma" },
    { href: "/admin/takvim", label: "Takvim", icon: CalendarIcon, section: "Çalışma" },
    { href: "/admin/influencerlar", label: "Influencerlar", icon: UsersIcon, section: "Taraflar" },
    { href: "/admin/markalar", label: "Markalar", icon: BuildingIcon, section: "Taraflar" },
    { href: "/admin/kanallar", label: "Mesajlar ve asistan", icon: LinkIcon, section: "Taraflar" },
    { href: "/admin/reklam", label: "Reklam", icon: MegaphoneIcon, section: "İçerik ve AI" },
    { href: "/creative", label: "Creative", icon: SparkleIcon, section: "İçerik ve AI" },
    { href: "/admin/ai", label: "AI sağlayıcıları", icon: SparkleIcon, section: "İçerik ve AI" },
    { href: "/admin/bildirimler", label: "Bildirimler", icon: BellIcon, section: "İçerik ve AI" },
    { href: "/admin/etkinlikler", label: "Etkinlikler", icon: CalendarIcon, section: "İçerik ve AI" },
    { href: "/admin/kuponlar", label: "Kuponlar", icon: WalletIcon, section: "İçerik ve AI" },
    { href: "/admin/finans", label: "Finans", icon: WalletIcon, section: "Para ve uyum" },
    { href: "/admin/uyum", label: "Uyum", icon: AlertIcon, section: "Para ve uyum" },
    { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: UsersIcon, section: "Yönetim" },
    { href: "/admin/yetkiler", label: "Rol ve yetkiler", icon: SettingsIcon, section: "Yönetim" },
    { href: "/admin/davetler", label: "Davetler", icon: UserIcon, section: "Yönetim" },
    { href: "/admin/kategoriler", label: "Kategoriler", icon: CalendarIcon, section: "Yönetim" },
    { href: "/admin/agent", label: "Agent merkezi", icon: SparkleIcon, section: "Yönetim" },
    { href: "/admin/tanitim", label: "Tanıtım sayfası", icon: GridIcon, section: "Yönetim" },
    { href: "/docs", label: "Dokümantasyon", icon: FileIcon, section: "Yönetim" },
  ],
  // Ajans çalışanı: yönetici ekranları (kullanıcılar, yetkiler, finans, tanıtım, AI sağlayıcıları) hariç.
  AGENCY: [],
  BRAND: [
    { href: "/marka", label: "Kampanyalarım", icon: MegaphoneIcon, exact: true },
    { href: "/marka/kesfet", label: "Influencer bul", icon: UsersIcon },
    { href: "/marka/teklifler", label: "Teklifler", icon: WalletIcon },
    { href: "/creative", label: "Creative", icon: SparkleIcon },
    { href: "/marka/reklam", label: "Reklam", icon: MegaphoneIcon },
    { href: "/marka/etkinlikler", label: "Etkinlikler", icon: CalendarIcon },
    { href: "/marka/kuponlar", label: "Kuponlar", icon: WalletIcon },
    { href: "/marka/gelen-kutusu", label: "Gelen kutusu", icon: BellIcon },
    { href: "/marka/kanallar", label: "Kanallar ve asistan", icon: LinkIcon },
    { href: "/profil", label: "Profilim", icon: UserIcon },
    { href: "/docs", label: "Yardım", icon: FileIcon },
  ],
  INFLUENCER: [
    { href: "/influencer", label: "İşlerim", icon: HomeIcon, exact: true },
    { href: "/influencer/teklifler", label: "Teklifler", icon: MegaphoneIcon },
    { href: "/influencer/davetlerim", label: "Davetlerim", icon: CalendarIcon },
    { href: "/creative", label: "Creative", icon: SparkleIcon },
    { href: "/influencer/odemeler", label: "Ödemeler", icon: WalletIcon },
    { href: "/profil", label: "Profilim", icon: UserIcon },
    { href: "/docs", label: "Rehber", icon: FileIcon },
  ],
};
navByRole.AGENCY = navByRole.ADMIN.filter((i) => !["/admin/kullanicilar", "/admin/yetkiler", "/admin/tanitim", "/admin/finans", "/admin/ai"].includes(i.href));
export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
