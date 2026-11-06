import type { CreativeKind } from "@/lib/creative-models";
/** Görsel / video / ses ikonu (sunucu ve istemcide kullanılabilir). */
export function KindIcon({ kind, size = 20 }: { kind: CreativeKind; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "image")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="m21 16-5-5-9 9" />
      </svg>
    );
  if (kind === "video")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="13" height="14" rx="3" />
        <path d="m16 10 5-3v10l-5-3" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
