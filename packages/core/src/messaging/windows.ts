import type { ChannelProvider } from "../generated/prisma/enums";

/**
 * Konuşma pencereleri.
 * - service: her INBOUND mesaj/çağrı ile +24 saat
 * - fep: Click-to-WhatsApp/Click-to-Direct reklamından gelen ilk mesajda +7 gün (tüm kategoriler ücretsiz)
 * - humanAgent: IG/Messenger'da son kullanıcı mesajından +7 gün (HUMAN_AGENT tag)
 */
export type WindowConfig = { serviceWindowHours: number; fepWindowDays: number; humanAgentWindowDays: number };

export type WindowState = {
  serviceWindowExpiresAt: Date | null;
  fepWindowExpiresAt: Date | null;
  humanAgentWindowExpiresAt: Date | null;
};

const H = 3_600_000;

export function onInbound(
  prev: WindowState,
  at: Date,
  channel: ChannelProvider,
  opts: { fromAd: boolean; isFirstMessage: boolean },
  cfg: WindowConfig,
): WindowState {
  const next: WindowState = { ...prev, serviceWindowExpiresAt: new Date(at.getTime() + cfg.serviceWindowHours * H) };
  if (opts.fromAd && opts.isFirstMessage && !prev.fepWindowExpiresAt) {
    next.fepWindowExpiresAt = new Date(at.getTime() + cfg.fepWindowDays * 24 * H);
  }
  if (channel === "INSTAGRAM" || channel === "MESSENGER") {
    next.humanAgentWindowExpiresAt = new Date(at.getTime() + cfg.humanAgentWindowDays * 24 * H);
  }
  return next;
}

export function isOpen(expiresAt: Date | null | undefined, now: Date): boolean {
  return !!expiresAt && expiresAt.getTime() > now.getTime();
}

export type ComposerMode =
  | { mode: "free_text"; tag?: "HUMAN_AGENT" }
  | { mode: "template_only"; reason: string }
  | { mode: "blocked"; reason: string };

/**
 * Pencere kapalıyken serbest metin DEVRE DIŞI: WhatsApp'ta yalnız onaylı template;
 * IG/Messenger'da 24 saat sonrası yalnız temsilci yanıtı (HUMAN_AGENT, 7 gün) — promosyon yok.
 */
export function composerMode(channel: ChannelProvider, w: WindowState, now: Date, byHuman: boolean): ComposerMode {
  if (isOpen(w.serviceWindowExpiresAt, now)) return { mode: "free_text" };
  if (channel === "WHATSAPP") {
    return { mode: "template_only", reason: "24 saatlik servis penceresi kapalı: yalnız onaylı template gönderilebilir." };
  }
  if ((channel === "INSTAGRAM" || channel === "MESSENGER") && byHuman && isOpen(w.humanAgentWindowExpiresAt, now)) {
    return { mode: "free_text", tag: "HUMAN_AGENT" };
  }
  return {
    mode: "blocked",
    reason:
      channel === "INSTAGRAM" || channel === "MESSENGER"
        ? "Pencere kapalı. Instagram/Messenger'da işletme konuşma başlatamaz; 24 saat dışı yeniden etkileşim (drip, sepet hatırlatma) mümkün değil."
        : "Bu kanalda mesaj gönderilemez.",
  };
}

/** Geri sayım (dakika hassasiyetinde). */
export function minutesLeft(expiresAt: Date | null | undefined, now: Date): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60_000));
}
