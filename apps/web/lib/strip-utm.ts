/** UTM parametrelerini atarak taban bağlantıyı döndürür (düzenleme formu için). */
export function stripUtm(link: string): string {
  try {
    const url = new URL(link);
    for (const k of [...url.searchParams.keys()]) if (k.startsWith("utm_")) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return link;
  }
}
