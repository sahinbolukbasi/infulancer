import { getTT } from "@/lib/i18n/tt-server";
import type { AssetKind } from "@infulancer/core/enums";
import { assetKindLabels } from "@infulancer/core/domain/labels";
import { FileIcon } from "@/components/icons";
import { DeleteMediaButton } from "./campaign-media-delete";

export type MediaItem = { id: string; fileName: string; mime: string; kind: AssetKind; size: number; uploadedById: string; uploadedByName?: string };

function fmtSize(bytes: number): string {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Kampanya fotoğraf/video galerisi. Görsel ve videolar yetki kontrollü indirme rotasından
 * (302 → kısa ömürlü imzalı URL) gösterilir; diğer dosyalar indirme bağlantısıdır.
 * canDelete: verilen kullanıcı kendi yüklediğini (ya da ajans her dosyayı) silebilir.
 */
export async function CampaignMedia({ items, canDelete, emptyText = "Henüz fotoğraf veya video yok." }: { items: MediaItem[]; canDelete?: (m: MediaItem) => boolean; emptyText?: string }) {
  const tt = await getTT();
  if (items.length === 0) return <p className="text-[13px] text-fg-passive">{emptyText}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={tt("Kampanya medyası")}>
      {items.map((m) => {
        const src = `/api/assets/${m.id}/download`;
        return (
          <li key={m.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-glass">
            {m.mime.startsWith("image/") ? (
              // Özel bucket + kısa ömürlü imzalı URL: next/image optimizasyonu uygun değil.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={m.fileName} loading="lazy" className="aspect-square w-full bg-bg object-cover" />
            ) : m.mime.startsWith("video/") ? (
              <video src={src} controls preload="metadata" className="aspect-square w-full bg-black object-cover" aria-label={m.fileName} />
            ) : (
              <a href={src} className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-bg text-fg-muted hover:text-fg">
                <FileIcon size={28} />
                <span className="text-[12px]">{tt("İndir")}</span>
              </a>
            )}
            <div className="flex items-start justify-between gap-2 p-2.5">
              <div className="min-w-0">
                <a href={src} className="block truncate text-[12px] font-medium text-fg hover:underline" title={m.fileName}>
                  {m.fileName}
                </a>
                <span className="text-[11px] text-fg-passive">
                  {assetKindLabels[m.kind]} · {fmtSize(m.size)}
                  {m.uploadedByName ? ` · ${m.uploadedByName}` : ""}
                </span>
              </div>
              {canDelete?.(m) ? <DeleteMediaButton assetId={m.id} name={m.fileName} /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
