import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { CookieBanner } from "@/components/legal/cookie-banner";
import { BRAND_NAME } from "@/lib/brand";
import { getPreferences } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { MessagesProvider } from "@/lib/i18n/tt-client";
import { messagesFor } from "@/lib/i18n/messages";

const geistSans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://nordvow.com"),
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: `${BRAND_NAME} — influencer pazarlama ve ajans operasyon platformu`,
  applicationName: BRAND_NAME,
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: `${BRAND_NAME} — influencer pazarlama ve ajans operasyon platformu`,
    locale: "tr_TR",
  },
  twitter: { card: "summary_large_image", title: BRAND_NAME, description: `${BRAND_NAME} — influencer pazarlama platformu` },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#05050a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Dil/bölge: hesap ayarı ya da ilk ziyarette otomatik algılanan (konum + tarayıcı dili).
  const { locale, region } = await getPreferences();
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <I18nProvider locale={locale} country={region.code} currency={region.currency}>
          <MessagesProvider messages={messagesFor(locale)}>
            {children}
            <CookieBanner />
          </MessagesProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
