import { randomBytes } from "node:crypto";

/** Haritalara eklenebilir konum bağlantıları (yol tarifi). Koordinat varsa onu, yoksa adresi kullanır. */
export function mapLinks(input: { latitude?: number | null; longitude?: number | null; address?: string | null; venueName?: string | null }) {
  const hasCoords = input.latitude != null && input.longitude != null;
  const q = hasCoords ? `${input.latitude},${input.longitude}` : [input.venueName, input.address].filter(Boolean).join(" ");
  const enc = encodeURIComponent(q || "");
  return {
    google: hasCoords ? `https://www.google.com/maps/search/?api=1&query=${enc}` : `https://www.google.com/maps/search/?api=1&query=${enc}`,
    apple: hasCoords ? `https://maps.apple.com/?ll=${input.latitude},${input.longitude}&q=${encodeURIComponent(input.venueName || input.address || "Konum")}` : `https://maps.apple.com/?q=${enc}`,
    // Statik önizleme (anahtar gerektirmez): OpenStreetMap embed.
    osmEmbed: hasCoords ? `https://www.openstreetmap.org/export/embed.html?bbox=${input.longitude! - 0.01}%2C${input.latitude! - 0.01}%2C${input.longitude! + 0.01}%2C${input.latitude! + 0.01}&marker=${input.latitude}%2C${input.longitude}` : null,
    hasCoords,
  };
}

/** Benzersiz, okunabilir ama tahmin edilemez kod (bilet/kupon jetonu). */
export function uniqueCode(prefix: string): string {
  const raw = randomBytes(8).toString("base64url").replace(/[-_]/g, "").slice(0, 10).toUpperCase();
  return `${prefix}-${raw}`;
}
