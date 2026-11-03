import { prisma } from "../db";
import { defaultConfig, type ConfigKey, type ConfigShape } from "./defaults";

/**
 * Yapılandırma deposu: model ID'leri, kota limitleri, kademeler, tatil takvimi, oranlar
 * kodda değil `config_values` tablosundadır. Tabloda yoksa defaults.ts'deki tohum değer
 * kullanılır (seed bu değerleri tabloya yazar).
 */
const cache = new Map<string, { value: unknown; at: number }>();
const TTL_MS = 60_000;

export async function getConfig<K extends ConfigKey>(key: K): Promise<ConfigShape[K]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as ConfigShape[K];
  const row = await prisma.configValue.findUnique({ where: { key } });
  const value = (row?.value ?? defaultConfig[key].value) as ConfigShape[K];
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function setConfig<K extends ConfigKey>(key: K, value: ConfigShape[K], verified = false): Promise<void> {
  await prisma.configValue.upsert({
    where: { key },
    create: { key, value: value as object, verified, note: defaultConfig[key].note },
    update: { value: value as object, verified },
  });
  cache.delete(key);
}

export function clearConfigCache(): void {
  cache.clear();
}

/** Tohum değerleri tabloya yazar (var olanları ezmez). */
export async function seedConfig(): Promise<number> {
  let n = 0;
  for (const [key, def] of Object.entries(defaultConfig)) {
    const res = await prisma.configValue.upsert({
      where: { key },
      create: { key, value: def.value as object, verified: def.verified, note: def.note },
      update: {},
    });
    if (res) n++;
  }
  cache.clear();
  return n;
}
