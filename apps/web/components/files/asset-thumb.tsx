"use client";

import { useState } from "react";
import type { Platform } from "@infulancer/core/enums";
import { PlatformIcon } from "@/components/platform-icon";

/** İçerik galerisi küçük resmi: indirme rotası (302 → presigned) ya da platform ikonu. */
export function AssetThumb({ assetId, platform, alt }: { assetId?: string | null; platform: Platform; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!assetId || failed) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center bg-bg text-fg-passive">
        <PlatformIcon platform={platform} size={32} title={alt} />
      </div>
    );
  }
  return (
    // Presigned URL'ler kısa ömürlü ve özel bucket'tan; next/image optimizasyonu uygun değil.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/assets/${assetId}/download`}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[4/5] w-full bg-bg object-cover"
    />
  );
}
