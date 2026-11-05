/** Yüklenen avatar anahtarını uygulama içi servis URL'ine çevirir (imzalı S3'e yönlendirir). */
export function avatarSrc(avatarKey: string | null | undefined): string | null {
  if (!avatarKey) return null;
  const name = avatarKey.replace(/^avatars\//, "");
  return `/api/avatar/${name}`;
}
/** Yüklenen avatar varsa onu, yoksa sosyal hesaptan geleni kullan. */
export function resolveAvatar(uploadedKey: string | null | undefined, socialUrl: string | null | undefined): string | null {
  return avatarSrc(uploadedKey) ?? socialUrl ?? null;
}
