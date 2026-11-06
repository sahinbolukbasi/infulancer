import { BRAND_NAME } from "@/lib/brand";

/**
 * Nordvow logosu: yuvarlak köşeli kare içinde gradyan "N" monogramı.
 * Marka paleti (mor → pembe → cyan). Favicon ve panel/başlıklarda ortak kullanılır.
 * Sunucu ve istemci bileşenlerinde çalışır (saf SVG, durum yok).
 */
export function NordvowMark({ size = 28, className }: { size?: number; className?: string }) {
  const gid = "nordvow-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9d4dff" />
          <stop offset="0.5" stopColor="#ff2bd6" />
          <stop offset="1" stopColor="#00e5ff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gid})`} />
      {/* "N" monogramı */}
      <path
        d="M9 23V9h2.6l9.8 9.9V9H24v14h-2.6L11.6 13.1V23H9Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/** Logo + marka adı (yatay). Başlık/sidebar için. */
export function NordvowWordmark({ size = 24, className, textClassName }: { size?: number; className?: string; textClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <NordvowMark size={size} />
      <span className={textClassName ?? "text-[15px] font-semibold tracking-tight text-fg"}>{BRAND_NAME}</span>
    </span>
  );
}
