import { envStr } from "../env";

/**
 * Yayın bağlantısının canlı olup olmadığını kontrol eder.
 * LINK_CHECK_MODE=http: HEAD, olmazsa GET (10 sn zaman aşımı); 2xx/3xx = canlı.
 * mock (varsayılan): URL 'silindi' içeriyorsa ölü kabul edilir.
 */
export async function isLinkAlive(url: string): Promise<boolean> {
  if (envStr("LINK_CHECK_MODE", "mock") !== "http") {
    return !url.toLocaleLowerCase("tr").includes("silindi");
  }
  const attempt = async (method: "HEAD" | "GET") => {
    const res = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    return res.status >= 200 && res.status < 400;
  };
  try {
    if (await attempt("HEAD")) return true;
    return await attempt("GET");
  } catch {
    try {
      return await attempt("GET");
    } catch {
      return false;
    }
  }
}
