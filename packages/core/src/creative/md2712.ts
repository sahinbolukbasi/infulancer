import { prisma } from "../db";
import { getConfig } from "../config/store";

/**
 * HARD-BLOCK — Ticari Reklam Yönetmeliği md. 27/12: gerçek bir kişinin AI ile üretilmiş dijital
 * kopyasını, ürünü deneyimlemiş/kullanmış/önermiş izlenimi verecek şekilde kullanan reklam YASAKTIR;
 * etiketle bile mubah değildir. Yüz/ses klonlama, face swap ve "influencer'ın yüzüyle içerik" akışı YOKTUR.
 * Sanal/AI persona izinlidir ama "Reklam/Tanıtım" + AI açıklaması taşımalıdır.
 */
export class RealPersonBlockedError extends Error {
  readonly legalBasis = "Ticari Reklam Yönetmeliği md. 27/12";
}

const CLONE_RE = /(face\s?swap|yüz\s?değiştir|yüzünü\s?(kullan|koy)|yüzüyle|sesini\s?(klonla|kopyala)|ses\s?klon|voice\s?clone|deepfake|dijital\s?ikiz|benzerini\s?üret|aynı\s?yüz)/iu;

function norm(s: string) {
  return s.toLocaleLowerCase("tr").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export async function knownPersons(): Promise<string[]> {
  const [extra, influencers, handles] = await Promise.all([
    getConfig("creative.knownPersons"),
    prisma.influencer.findMany({ select: { name: true } }),
    prisma.socialAccount.findMany({ select: { handle: true } }),
  ]);
  return [...extra, ...influencers.map((i) => i.name), ...handles.map((h) => h.handle.replace(/^@/, ""))].filter((x) => x.trim().length >= 3);
}

export type BriefCheckInput = { prompt: string; referenceImageIsPortrait?: boolean; referencePersonName?: string | null };

export async function assertNoRealPersonClone(input: BriefCheckInput, persons?: string[]) {
  const text = norm(input.prompt);
  if (CLONE_RE.test(input.prompt)) {
    throw new RealPersonBlockedError("Yüz/ses klonlama, face swap veya gerçek kişinin kopyasıyla içerik üretimi yasaktır (md. 27/12).");
  }
  if (input.referenceImageIsPortrait || input.referencePersonName) {
    throw new RealPersonBlockedError("Tanınabilir gerçek kişinin referans portresiyle üretim yapılamaz (md. 27/12).");
  }
  const list = persons ?? (await knownPersons());
  const hit = list.find((p) => {
    const n = norm(p);
    return new RegExp(`(^|[^\\p{L}\\p{N}])@?${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u").test(text);
  });
  if (hit) {
    throw new RealPersonBlockedError(`Brief gerçek bir kişiye (${hit}) atıf içeriyor; o kişinin AI kopyası ürünü kullanıyormuş gibi gösterilemez (md. 27/12).`);
  }
}
