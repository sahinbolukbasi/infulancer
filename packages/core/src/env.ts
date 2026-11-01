import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

/**
 * Repo kökündeki .env dosyasını (varsa) bir kez yükler. Next.js kendi .env'ini
 * yüklediği için orada zaten tanımlı değişkenler ezilmez (process.loadEnvFile
 * mevcut değerleri değiştirmez).
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.resolve(here, "../../../.env"));
  } catch {
    // import.meta.url bundle ortamında olmayabilir.
  }
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}

export function requireEnv(name: string): string {
  loadEnv();
  const value = process.env[name];
  if (!value) throw new Error(`Ortam değişkeni eksik: ${name}`);
  return value;
}

export function envInt(name: string, fallback: number): number {
  loadEnv();
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function envStr(name: string, fallback: string): string {
  loadEnv();
  return process.env[name] || fallback;
}
