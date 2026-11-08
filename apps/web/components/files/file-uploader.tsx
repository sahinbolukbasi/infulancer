"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetKind } from "@infulancer/core/enums";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Select } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/progress";

// core/storage/s3 ile aynı eşikler (istemciye AWS SDK taşımamak için kopya).
const MULTIPART_THRESHOLD = 50 * 1024 * 1024;

type Target = { type: "deliverable" | "campaign"; id: string };
type Uploaded = { assetId: string; fileName: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `İstek başarısız (${res.status}).`);
  return data;
}

/** Presigned URL'e doğrudan PUT (uygulama sunucusundan geçmez); ETag döner. */
function putBlob(url: string, blob: Blob, contentType: string | null, onProgress: (loaded: number) => void): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.getResponseHeader("ETag")) : reject(new Error(`Depolama yüklemeyi reddetti (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Ağ hatası: dosya yüklenemedi."));
    xhr.send(blob);
  });
}

/**
 * İki yönlü dosya paylaşımı için yükleyici. ≤50 MB tek PUT, üstü 10 MB parçalı
 * multipart; her parça için ilerleme gösterilir.
 */
export function FileUploader({
  target,
  kinds,
  label = "Dosya yükle",
  hint,
  accept,
  multiple = false,
  onUploaded,
}: {
  target: Target;
  kinds: { value: AssetKind; label: string }[];
  label?: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  onUploaded?: (asset: Uploaded) => void;
}) {
  const router = useRouter();
  const kindId = useId();
  const [kind, setKind] = useState<AssetKind>(kinds[0]!.value);
  const [progress, setProgress] = useState<{ name: string; value: number; detail: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const busy = progress !== null;

  const upload = async (file: File) => {
    const mime = file.type || "application/octet-stream";
    const meta = { target, kind, fileName: file.name, mime, size: file.size };
    setMessage(null);
    setProgress({ name: file.name, value: 0, detail: "Hazırlanıyor…" });
    try {
      let done: Uploaded;
      if (file.size <= MULTIPART_THRESHOLD) {
        const p = await postJson<{ assetId: string; url: string }>("/api/uploads/presign", meta);
        await putBlob(p.url, file, mime, (loaded) => setProgress({ name: file.name, value: loaded / file.size, detail: "Yükleniyor" }));
        done = await postJson<Uploaded>("/api/uploads/confirm", { assetId: p.assetId });
      } else {
        const c = await postJson<{ assetId: string; uploadId: string; partSize: number; partCount: number }>("/api/uploads/multipart/create", meta);
        try {
          const parts: { partNumber: number; etag: string }[] = [];
          let uploaded = 0;
          for (let partNumber = 1; partNumber <= c.partCount; partNumber++) {
            const blob = file.slice((partNumber - 1) * c.partSize, partNumber * c.partSize);
            const s = await postJson<{ url: string }>("/api/uploads/multipart/sign-part", { assetId: c.assetId, uploadId: c.uploadId, partNumber });
            const etag = await putBlob(s.url, blob, null, (loaded) =>
              setProgress({ name: file.name, value: (uploaded + loaded) / file.size, detail: `Parça ${partNumber}/${c.partCount}` }),
            );
            if (!etag) throw new Error("Depolama parça imzası (ETag) döndürmedi.");
            uploaded += blob.size;
            parts.push({ partNumber, etag });
          }
          done = await postJson<Uploaded>("/api/uploads/multipart/complete", { assetId: c.assetId, uploadId: c.uploadId, parts });
        } catch (err) {
          await postJson("/api/uploads/multipart/abort", { assetId: c.assetId, uploadId: c.uploadId }).catch(() => undefined);
          throw err;
        }
      }
      setMessage({ text: `${done.fileName} yüklendi.`, error: false });
      onUploaded?.(done);
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Yükleme başarısız.", error: true });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {kinds.length > 1 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={kindId} className="text-label text-fg-muted">
            Dosya türü
          </label>
          <Select id={kindId} value={kind} onChange={(e) => setKind(e.target.value as AssetKind)} disabled={busy}>
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <FileDropzone
        label={label}
        hint={hint ?? "50 MB üzeri dosyalar 10 MB'lık parçalar halinde yüklenir."}
        accept={accept}
        disabled={busy}
        multiple={multiple}
        onFiles={(files) => {
          void (async () => {
            for (const f of multiple ? files : files.slice(0, 1)) await upload(f);
          })();
        }}
      />
      {progress ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <div className="flex justify-between text-[13px] text-fg-muted">
            <span className="truncate">{progress.name}</span>
            <span className="tabular-nums">
              {progress.detail} · %{Math.round(progress.value * 100)}
            </span>
          </div>
          <ProgressBar value={progress.value} label={`${progress.name} yükleme ilerlemesi`} />
        </div>
      ) : null}
      {message ? (
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-[13px] text-critical" : "text-[13px] text-fg-muted"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
