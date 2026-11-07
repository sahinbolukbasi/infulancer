import { importPKCS8, SignJWT } from "jose";
import { envStr } from "../env";
import { BRAND_NAME } from "../brand";
import { googleWalletConfigured, type PassData } from "./passes";

/**
 * Google Wallet "Save to Wallet" bağlantısı üretimi.
 *
 * Servis hesabı anahtarıyla (GOOGLE_WALLET_SA_KEY = JSON) imzalanmış bir JWT oluşturulur;
 * JWT içinde generic pass object gömülür. Kullanıcı linke tıklayınca Google Wallet'a eklenir.
 * Anahtar/Issuer ID yoksa null döner (çağıran web görünümüne düşer).
 *
 * Gereken ortam değişkenleri:
 *   GOOGLE_WALLET_ISSUER_ID  — pay.google.com/business/console'dan alınan 19 haneli numara
 *   GOOGLE_WALLET_SA_KEY     — servis hesabı anahtarı (tüm JSON içeriği)
 */
type ServiceAccount = { client_email: string; private_key: string };

function serviceAccount(): ServiceAccount | null {
  const raw = envStr("GOOGLE_WALLET_SA_KEY", "").trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as ServiceAccount;
    return j.client_email && j.private_key ? j : null;
  } catch {
    return null;
  }
}

/** Issuer ID ile sınıf (class) kimliği. Tür başına tek sınıf yeterli. */
function classId(issuerId: string, kind: PassData["kind"]): string {
  return `${issuerId}.nordvow_${kind}`;
}

/** Generic pass object'i (JWT içine gömülür). */
function buildGenericObject(issuerId: string, data: PassData, serial: string) {
  const objectId = `${issuerId}.${serial.replace(/[^\w.-]/g, "_")}`;
  const hex = (data.accentColor ?? "#ff2bd6").startsWith("#") ? (data.accentColor ?? "#ff2bd6") : "#ff2bd6";
  return {
    id: objectId,
    classId: classId(issuerId, data.kind),
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: hex,
    cardTitle: { defaultValue: { language: "tr", value: BRAND_NAME } },
    header: { defaultValue: { language: "tr", value: data.title } },
    subheader: { defaultValue: { language: "tr", value: data.subtitle } },
    barcode: { type: "QR_CODE", value: data.code },
    textModulesData: data.fields.slice(0, 4).map((f, i) => ({ id: `f${i}`, header: f.label, body: f.value })),
  };
}

/** Generic class tanımı (ilk kullanımda JWT içinde gönderilir; Google idempotent kabul eder). */
function buildGenericClass(issuerId: string, kind: PassData["kind"]) {
  return { id: classId(issuerId, kind) };
}

/**
 * "Save to Google Wallet" bağlantısı üretir. Anahtar yoksa null.
 * Döndürülen link doğrudan kullanıcıya sunulabilir.
 */
export async function buildGoogleWalletLink(data: PassData, serial: string): Promise<string | null> {
  if (!googleWalletConfigured()) return null;
  const sa = serviceAccount();
  const issuerId = envStr("GOOGLE_WALLET_ISSUER_ID", "").trim();
  if (!sa || !issuerId) return null;

  const payload = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    origins: [envStr("APP_URL", "https://nordvow.com").replace(/\/$/, "")],
    payload: {
      genericClasses: [buildGenericClass(issuerId, data.kind)],
      genericObjects: [buildGenericObject(issuerId, data, serial)],
    },
  };
  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT(payload).setProtectedHeader({ alg: "RS256", typ: "JWT" }).sign(key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
