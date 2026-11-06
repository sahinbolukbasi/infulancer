import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { CookieBanner } from "@/components/legal/cookie-banner";
import { BRAND_NAME } from "@/lib/brand";

const geistSans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://nordvow.com"),
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: `${BRAND_NAME} — influencer pazarlama ve ajans operasyon platformu`,
  applicationName: BRAND_NAME,
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#05050a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
