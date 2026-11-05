import QRCode from "qrcode";
import { envStr } from "../env";

/**
 * Cüzdan (Apple Wallet / Google Wallet) ve QR altyapısı.
 *
 * QR üretimi gerçektir (qrcode kütüphanesi). Cüzdan "pass" üretimi anahtar gerektirir:
 * - Apple Wallet: PassKit imza sertifikası (.p12) + WWDR sertifikası
 * - Google Wallet: servis hesabı + Issuer ID (JWT imzalama)
 * Anahtarlar tanımlı DEĞİLSE mock modda çalışır: "Cüzdana ekle" bağlantısı üretilir ve
 * kullanıcı bilet/kupon web görünümüne yönlendirilir. Anahtar eklenince gerçek .pkpass /
 * Google Wallet JWT üretimi bu arayüzün arkasında devreye alınır.
 */
export type WalletKind = "ticket" | "coupon";

export type PassData = {
  kind: WalletKind;
  /** Pass üzerinde görünen başlık (etkinlik adı veya kupon başlığı). */
  title: string;
  /** Alt başlık (kişi adı veya marka adı). */
  subtitle: string;
  /** QR içeriğinde kodlanan doğrulama jetonu. */
  code: string;
  /** Ek alanlar (tarih, konum, değer, koşullar). */
  fields: { label: string; value: string }[];
  /** Marka rengi (hex). */
  accentColor?: string;
};

export type WalletLinks = {
  /** QR kodu PNG data URL (her zaman üretilir). */
  qrDataUrl: string;
  /** Apple Wallet'a ekleme bağlantısı (mock: web görünümü). */
  appleUrl: string;
  /** Google Wallet'a ekleme bağlantısı (mock: web görünümü). */
  googleUrl: string;
  /** Gerçek cüzdan imzalama aktif mi? */
  live: boolean;
};

function appBase(): string {
  return envStr("APP_URL", "http://localhost:3000").replace(/\/$/, "");
}

export function appleWalletConfigured(): boolean {
  return envStr("APPLE_WALLET_CERT", "").trim().length > 0 && envStr("APPLE_WALLET_TEAM_ID", "").trim().length > 0;
}
export function googleWalletConfigured(): boolean {
  return envStr("GOOGLE_WALLET_ISSUER_ID", "").trim().length > 0 && envStr("GOOGLE_WALLET_SA_KEY", "").trim().length > 0;
}

/** QR kodu PNG data URL üretir (yüksek hata düzeltme; baskı/ekran için uygun). */
export async function qrDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}

/** QR kodu SVG string üretir (ölçeklenebilir; bilet/kupon kartında gömülü kullanım). */
export async function qrSvg(content: string): Promise<string> {
  return QRCode.toString(content, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
}

/**
 * Bir bilet/kupon için cüzdan bağlantılarını üretir. Anahtar yoksa (mock) bağlantılar,
 * pass'in web görünümüne gider; anahtar varsa gerçek .pkpass / Google JWT uçlarına.
 */
export async function buildWalletLinks(kind: WalletKind, id: string, qrContent: string): Promise<WalletLinks> {
  const base = appBase();
  const appleLive = appleWalletConfigured();
  const googleLive = googleWalletConfigured();
  const path = kind === "ticket" ? "bilet" : "kupon";
  // Gerçek modda imzalı pass uçları; mock modda web görünümü.
  const appleUrl = appleLive ? `${base}/api/wallet/apple/${kind}/${id}` : `${base}/${path}/${id}`;
  const googleUrl = googleLive ? `${base}/api/wallet/google/${kind}/${id}` : `${base}/${path}/${id}`;
  return {
    qrDataUrl: await qrDataUrl(qrContent),
    appleUrl,
    googleUrl,
    live: appleLive || googleLive,
  };
}

/** Pass verisini JSON'a serialize eder (gerçek .pkpass / Google JWT üretimi buradan türer). */
export function serializePass(data: PassData): string {
  return JSON.stringify({
    formatVersion: 1,
    kind: data.kind,
    title: data.title,
    subtitle: data.subtitle,
    barcode: { format: "QR", message: data.code },
    fields: data.fields,
    accentColor: data.accentColor ?? "#ff2bd6",
  });
}
