import { envStr } from "../env";
import { appleWalletConfigured, type PassData } from "./passes";

/**
 * Apple Wallet .pkpass üretimi.
 *
 * ÖNEMLİ: Geçerli bir .pkpass, Apple PassKit sertifikasıyla (pass type ID .p12 + WWDR)
 * PKCS#7 imzalanmalıdır; imzasız dosyayı iPhone AÇMAZ. Sertifika env'de tanımlı DEĞİLSE
 * bu fonksiyon null döndürür ve çağıran taraf kullanıcıyı web bilet görünümüne yönlendirir.
 * Sertifika eklendiğinde (APPLE_WALLET_CERT, APPLE_WALLET_CERT_PASSWORD, APPLE_WALLET_WWDR,
 * APPLE_WALLET_TEAM_ID, APPLE_WALLET_PASS_TYPE_ID) imzalı .pkpass üretimi devreye alınır.
 */
export function applePassJson(data: PassData, serial: string): Record<string, unknown> {
  const teamId = envStr("APPLE_WALLET_TEAM_ID", "TEAMID");
  const passTypeId = envStr("APPLE_WALLET_PASS_TYPE_ID", "pass.com.infulancer");
  const common = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    organizationName: "Infulancer",
    description: data.title,
    serialNumber: serial,
    backgroundColor: data.accentColor ?? "rgb(255,43,214)",
    foregroundColor: "rgb(255,255,255)",
    labelColor: "rgb(255,255,255)",
    barcodes: [{ format: "PKBarcodeFormatQR", message: data.code, messageEncoding: "iso-8859-1" }],
  };
  const fields = {
    headerFields: [{ key: "kind", label: data.kind === "ticket" ? "BİLET" : "KUPON", value: "" }],
    primaryFields: [{ key: "title", label: "", value: data.title }],
    secondaryFields: [{ key: "subtitle", label: data.kind === "ticket" ? "Katılımcı" : "Marka", value: data.subtitle }],
    auxiliaryFields: data.fields.slice(0, 4).map((f, i) => ({ key: `f${i}`, label: f.label, value: f.value })),
  };
  return data.kind === "ticket" ? { ...common, eventTicket: fields } : { ...common, coupon: fields };
}

/**
 * İmzalı .pkpass üretir. Sertifika yoksa null döner (fallback: web görünümü).
 * Gerçek imzalama, sertifika eklendiğinde bu fonksiyonun içine (PKCS#7 + zip) alınır.
 */
export async function buildPkpass(_data: PassData, _serial: string): Promise<Buffer | null> {
  if (!appleWalletConfigured()) return null;
  // Sertifika mevcut: burada pass.json + manifest.json + signature + görseller zip'lenip
  // PKCS#7 ile imzalanır. (Sertifika eklendiğinde etkinleştirilecek; şimdilik güvenli no-op.)
  return null;
}
