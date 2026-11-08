/** Tarayıcıdan S3'e Creative yüklemesi (ilerleme çubuğu için XHR). Dosya işlemi yapanın kitaplığına düşer. */
export async function uploadFile(file: Blob, opts: { name: string; mime: string; tenantId?: string; parentId?: string; onProgress?: (p: number) => void }): Promise<{ id: string; kind: "image" | "video" }> {
  const pres = await fetch("/api/creative/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mime: opts.mime, size: file.size }) });
  const pj = await pres.json();
  if (!pres.ok) throw new Error(pj.error ?? "Yükleme hazırlanamadı.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", pj.url);
    xhr.setRequestHeader("content-type", opts.mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Yükleme başarısız.")));
    xhr.onerror = () => reject(new Error("Bağlantı hatası; tekrar deneyin."));
    xhr.send(file);
  });
  const conf = await fetch("/api/creative/upload", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: pj.key, name: opts.name, parentId: opts.parentId }) });
  const cj = await conf.json();
  if (!conf.ok) throw new Error(cj.error ?? "Dosya kaydedilemedi.");
  return { id: cj.id, kind: cj.kind };
}
