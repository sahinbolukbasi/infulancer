/** Verilen media S3 anahtarından görüntüleme URL'i (hem sunucu hem istemcide kullanılır). */
export function mediaSrc(key: string | null | undefined): string | null {
  return key ? `/api/media/${key.replace(/^media\//, "")}` : null;
}
