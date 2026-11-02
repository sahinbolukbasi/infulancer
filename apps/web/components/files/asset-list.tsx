import type { AssetDirection, AssetKind, UsageChannel } from "@infulancer/core/enums";
import { assetDirectionLabels, assetKindLabels, usageChannelLabels } from "@infulancer/core/domain/labels";
import { FileIcon } from "@/components/icons";
import { UsageRightsForm } from "@/components/forms/small-forms";
import { fmtDate } from "@/lib/time";

export type AssetRow = {
  id: string;
  fileName: string;
  kind: AssetKind;
  direction: AssetDirection;
  size: number;
  createdAt: Date;
  uploadedByName?: string;
  usageDurationDays: number | null;
  usageEndsAt: Date | null;
  usageChannel: UsageChannel | null;
  usageGeography: string[];
};

function fmtSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Dosya listesi: indirme bağlantısı (yetki + 302), kullanım hakları; admin için hak düzenleme. */
export function AssetList({ assets, editableRights = false, emptyText = "Dosya yok." }: { assets: AssetRow[]; editableRights?: boolean; emptyText?: string }) {
  if (assets.length === 0) return <p className="text-sm text-fg-passive">{emptyText}</p>;
  const now = new Date().getTime();
  return (
    <ul className="flex flex-col divide-y divide-border">
      {assets.map((a) => {
        const expired = a.usageEndsAt != null && a.usageEndsAt.getTime() < now;
        const rightsKind = a.kind === "HAM_DOSYA" || a.kind === "TASLAK";
        return (
          <li key={a.id} className="flex flex-col gap-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href={`/api/assets/${a.id}/download`} className="flex min-w-0 items-center gap-2 text-sm text-fg hover:underline">
                <FileIcon size={16} className="shrink-0 text-fg-muted" />
                <span className="truncate">{a.fileName}</span>
              </a>
              <span className="text-[12px] text-fg-passive">
                {assetKindLabels[a.kind]} · {assetDirectionLabels[a.direction]} · {fmtSize(a.size)} · {fmtDate(a.createdAt)}
                {a.uploadedByName ? ` · ${a.uploadedByName}` : ""}
              </span>
            </div>
            {rightsKind && (a.usageEndsAt || a.usageChannel || a.usageGeography.length) ? (
              <p className={expired ? "text-[13px] text-fg" : "text-[13px] text-fg-muted"}>
                {expired ? "Kullanım hakkı sona erdi" : `Kullanım hakkı${a.usageEndsAt ? ` ${fmtDate(a.usageEndsAt)} tarihine kadar` : ""}`}
                {a.usageChannel ? ` · ${usageChannelLabels[a.usageChannel]}` : ""}
                {a.usageGeography.length ? ` · ${a.usageGeography.join(", ")}` : ""}
              </p>
            ) : null}
            {editableRights && rightsKind ? (
              <details className="group">
                <summary className="cursor-pointer text-[13px] text-fg-muted hover:text-fg">Kullanım haklarını düzenle</summary>
                <div className="pt-3">
                  <UsageRightsForm
                    assetId={a.id}
                    values={{ usageDurationDays: a.usageDurationDays, usageChannel: a.usageChannel, usageGeography: a.usageGeography }}
                  />
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
