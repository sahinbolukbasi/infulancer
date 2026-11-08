"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";

export type PreviewTemplate = "ig-post" | "ig-story" | "ig-reels" | "tiktok" | "yt-shorts" | "yt-video";
export const TEMPLATES: { id: PreviewTemplate; label: string; ratio: string }[] = [
  { id: "ig-post", label: "Instagram gönderi", ratio: "4:5" },
  { id: "ig-story", label: "Instagram story", ratio: "9:16" },
  { id: "ig-reels", label: "Instagram reels", ratio: "9:16" },
  { id: "tiktok", label: "TikTok", ratio: "9:16" },
  { id: "yt-shorts", label: "YouTube Shorts", ratio: "9:16" },
  { id: "yt-video", label: "YouTube video", ratio: "16:9" },
];

function Media({ src, kind, className, alt }: { src: string; kind: "image" | "video"; className?: string; alt: string }) {
  return kind === "video" ? (
    <video src={src} autoPlay muted loop playsInline className={cn("h-full w-full object-cover", className)} aria-label={alt} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- imzalı S3 URL'i
    <img src={src} alt={alt} className={cn("h-full w-full object-cover", className)} />
  );
}

const Avatar = ({ name }: { name: string }) => (
  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-violet-600 text-[10px] font-bold text-white ring-2 ring-white/80">{name.slice(0, 1).toUpperCase()}</span>
);

/** Platform arayüzü (yaklaşık): içeriğin telefonda nasıl görüneceğini gösterir; güvenli alanlar dahil. */
function Screen({ t, src, kind, username, caption }: { t: PreviewTemplate; src: string; kind: "image" | "video"; username: string; caption: string }) {
  const cap = caption.trim() || "Gönderi metni burada görünür #reklam";
  if (t === "ig-post") {
    return (
      <div className="flex h-full flex-col bg-white text-black">
        <div className="flex items-center justify-between px-3 py-2 text-[12px] font-semibold">
          <span>Instagram</span>
          <span aria-hidden>♡ ✉</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
          <Avatar name={username} />
          <span className="flex flex-col leading-tight">
            <span className="font-semibold">{username}</span>
            <span className="text-[9px] text-gray-500">Ücretli ortaklık</span>
          </span>
          <span className="ml-auto" aria-hidden>
            •••
          </span>
        </div>
        <div className="aspect-[4/5] w-full overflow-hidden bg-gray-100">
          <Media src={src} kind={kind} alt="Gönderi önizlemesi" />
        </div>
        <div className="flex gap-3 px-3 py-2 text-[14px]" aria-hidden>
          <span>♡</span>
          <span>💬</span>
          <span>➤</span>
          <span className="ml-auto">🔖</span>
        </div>
        <p className="line-clamp-3 px-3 text-[11px] leading-snug">
          <span className="font-semibold">{username} </span>
          {cap}
        </p>
      </div>
    );
  }
  if (t === "yt-video") {
    return (
      <div className="flex h-full flex-col bg-[#0f0f0f] text-white">
        <div className="px-3 py-2 text-[12px] font-semibold">▶ YouTube</div>
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <Media src={src} kind={kind} alt="Video önizlemesi" />
          <span className="absolute right-1.5 bottom-1.5 rounded bg-black/80 px-1 text-[9px]">0:30</span>
        </div>
        <div className="flex gap-2 px-3 py-2">
          <Avatar name={username} />
          <div className="flex min-w-0 flex-col">
            <p className="line-clamp-2 text-[12px] font-medium leading-snug">{cap.split("#")[0]}</p>
            <p className="text-[10px] text-gray-400">{username} · 12 B görüntüleme · 1 saat önce</p>
          </div>
        </div>
        <div className="mx-3 mt-1 rounded-lg bg-white/10 px-2 py-1.5 text-[10px] text-gray-300">Ücretli tanıtım içerir</div>
      </div>
    );
  }
  // Dikey tam ekran şablonlar
  const story = t === "ig-story";
  return (
    <div className="relative h-full overflow-hidden bg-black text-white">
      <Media src={src} kind={kind} alt="Dikey önizleme" />
      {/* Arayüz alanları: üstte profil/ilerleme, altta yanıt/açıklama — metni bu alanlara koymayın */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-3 pt-3 pb-6">
        {story ? (
          <div className="mb-2 flex gap-1" aria-hidden>
            <span className="h-0.5 flex-1 rounded bg-white" />
            <span className="h-0.5 flex-1 rounded bg-white/40" />
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-[11px]">
          {story ? <Avatar name={username} /> : null}
          <span className="font-semibold">{story ? username : t === "tiktok" ? "Takip edilen  ·  Senin için" : t === "yt-shorts" ? "Shorts" : "Reels"}</span>
          {story ? <span className="text-white/70">2 sa · Ücretli ortaklık</span> : null}
        </div>
      </div>
      {story ? (
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2" aria-hidden>
          <span className="flex-1 rounded-full border border-white/60 px-3 py-1.5 text-[10px] text-white/80">Mesaj gönder</span>
          <span>♡</span>
          <span>➤</span>
        </div>
      ) : (
        <>
          <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3 text-[13px]" aria-hidden>
            <span>♡</span>
            <span>💬</span>
            <span>➤</span>
            {t === "tiktok" ? <span>🔖</span> : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-10 pb-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold">
              <Avatar name={username} /> @{username.replace(/\s+/g, "").toLowerCase()}
              <span className="rounded border border-white/70 px-1 text-[9px] font-normal">Takip et</span>
            </div>
            <p className="line-clamp-2 pr-8 text-[10px] leading-snug text-white/90">{cap}</p>
            <p className="mt-1 text-[9px] text-white/70">{t === "tiktok" ? "Ücretli ortaklık · ♪ orijinal ses" : "Ücretli tanıtım"}</p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Telefon önizlemesi: içerik Instagram (gönderi/story/reels), TikTok ve YouTube (Shorts/video)
 * arayüzünde nasıl görünür. Arayüzün kapattığı alanlar gerçeğe yakın gösterilir.
 */
export function PhonePreview({
  src,
  kind,
  username = "markaniz",
  caption = "",
  initial,
  className,
}: {
  src: string;
  kind: "image" | "video";
  username?: string;
  caption?: string;
  initial?: PreviewTemplate;
  className?: string;
}) {
  const [t, setT] = useState<PreviewTemplate>(initial ?? (kind === "video" ? "ig-reels" : "ig-post"));
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Platform şablonu">
        {TEMPLATES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={t === x.id}
            onClick={() => setT(x.id)}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] transition-standard", t === x.id ? "border-fg bg-fg text-bg" : "border-line text-fg-muted hover:text-fg")}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="relative w-[260px] rounded-[42px] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl" role="img" aria-label={`${TEMPLATES.find((x) => x.id === t)?.label} önizlemesi`}>
        <div className="absolute top-1.5 left-1/2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black" aria-hidden />
        <div className="aspect-[9/19.5] overflow-hidden rounded-[32px]">
          <Screen t={t} src={src} kind={kind} username={username} caption={caption} />
        </div>
      </div>
      <p className="max-w-[280px] text-center text-[11px] text-fg-passive">Yaklaşık görünüm. Metni ve logoyu üst/alt arayüz alanlarının dışına yerleştirin.</p>
    </div>
  );
}
