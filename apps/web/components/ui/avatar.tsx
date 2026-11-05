import { cn } from "@/lib/cn";

const TONES = ["from-neon-pink to-neon-violet", "from-neon-cyan to-neon-violet", "from-neon-lime to-neon-cyan", "from-neon-amber to-neon-pink"];
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr"))
    .join("");
}

/**
 * Profil fotoğrafı: bağlı sosyal hesaptan senkronla gelen görsel; yoksa baş harfler.
 * Platform CDN adresleri süreli olabilir; senkron her çalıştığında yenilenir.
 */
export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const tone = TONES[(name.charCodeAt(0) || 0) % TONES.length];
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-black ring-1 ring-line", tone, className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-hidden={src ? undefined : true}
    >
      {initials(name)}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- harici sosyal medya CDN görseli
        <img src={src} alt={`${name} profil fotoğrafı`} referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

/** Yüklenen avatar (varsa) > sosyal hesaplardan ilk mevcut fotoğraf (Instagram > YouTube > TikTok). */
export function pickAvatar(accounts: { platform: string; avatarUrl?: string | null }[], uploadedKey?: string | null): string | null {
  if (uploadedKey) return `/api/avatar/${uploadedKey.replace(/^avatars\//, "")}`;
  const order = ["INSTAGRAM", "YOUTUBE", "TIKTOK"];
  return [...accounts].sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform)).find((a) => a.avatarUrl)?.avatarUrl ?? null;
}
