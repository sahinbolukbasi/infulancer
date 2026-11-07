"use client";
import { useState } from "react";

/** Galeride AI çıktısının gerçek önizlemesi; dosya görüntülenemezse (demo çıktısı) gizlenir. */
export function AssetThumb({ id, kind, alt }: { id: string; kind: "image" | "video" | "audio"; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok || kind === "audio") return null;
  const src = `/api/creative/file/${id}?t=asset`;
  return kind === "video" ? (
    <video src={`${src}#t=0.5`} muted preload="metadata" playsInline onError={() => setOk(false)} className="absolute inset-0 h-full w-full object-cover" aria-label={alt} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- imzalı S3 URL'i
    <img src={src} alt={alt} loading="lazy" onError={() => setOk(false)} className="absolute inset-0 h-full w-full object-cover" />
  );
}
