import { getLlm } from "../llm";
import { parseJsonObject } from "../llm/bedrock";
import { videoOpsSchema, type VideoOps } from "./video-edit";

/**
 * "Brief ile AI düzenle": kullanıcının yazdığı isteği (ör. "ilk 15 saniyeyi story formatında, canlı
 * renklerle, sessiz ve hızlı yap") videonun gerçek düzenleme adımlarına çevirir. Düzenleme sunucuda
 * ffmpeg ile yapılır (fal maliyeti yok). Metin modeli (Bedrock) varsa onu kullanır; yoksa veya çıktısı
 * geçersizse Türkçe anahtar kelime çözümleyicisi devreye girer. Çıktı her zaman şemadan geçer.
 */
export type BriefPlan = { ops: VideoOps; summary: string[]; source: "ai" | "kurallar" };

const num = (s: string) => Number(s.replace(",", "."));

/** Anahtar kelime çözümleyicisi (deterministik; test edilir). */
export function planFromKeywords(brief: string, durationSec: number | null): BriefPlan {
  const t = brief.toLocaleLowerCase("tr");
  const ops: Partial<VideoOps> = {};
  const summary: string[] = [];
  if (/story|reels|tiktok|shorts|dikey|9[:/x]16/.test(t)) ((ops.aspect = "9:16"), summary.push("Dikey 9:16 (Story/Reels/TikTok)"));
  else if (/kare|1[:/x]1/.test(t)) ((ops.aspect = "1:1"), summary.push("Kare 1:1"));
  else if (/4[:/x]5|gönderi|post/.test(t)) ((ops.aspect = "4:5"), summary.push("Gönderi 4:5"));
  else if (/yatay|youtube|16[:/x]9/.test(t)) ((ops.aspect = "16:9"), summary.push("Yatay 16:9"));
  const first = /(?:ilk|baştan)\s*(\d+(?:[.,]\d+)?)\s*(?:sn|saniye)/.exec(t);
  const range = /(\d+(?:[.,]\d+)?)\s*(?:\.|-|–|ile)?\s*(?:sn|saniye)?\s*(?:-|–|ile|ila|den|dan)\s*(\d+(?:[.,]\d+)?)\s*(?:\.|-)?\s*(?:sn|saniye)/.exec(t);
  const last = /son\s*(\d+(?:[.,]\d+)?)\s*(?:sn|saniye)/.exec(t);
  const max = /(?:en fazla|maksimum|max|kısalt[a-z]*)\s*(\d+(?:[.,]\d+)?)\s*(?:sn|saniye)/.exec(t);
  if (range) {
    ops.trimStart = num(range[1]!);
    ops.trimEnd = num(range[2]!);
    summary.push(`${ops.trimStart}–${ops.trimEnd}. saniyeler`);
  } else if (first) {
    ops.trimStart = 0;
    ops.trimEnd = num(first[1]!);
    summary.push(`İlk ${ops.trimEnd} saniye`);
  } else if (last && durationSec) {
    ops.trimStart = Math.max(0, durationSec - num(last[1]!));
    ops.trimEnd = durationSec;
    summary.push(`Son ${num(last[1]!)} saniye`);
  } else if (max) {
    ops.trimStart = 0;
    ops.trimEnd = num(max[1]!);
    summary.push(`${ops.trimEnd} saniyeye kısaltıldı`);
  }
  if (/2\s*x|iki kat|çok hızlı/.test(t)) ((ops.speed = 2), summary.push("2x hız"));
  else if (/hızlandır|hızlı|1[.,]5\s*x/.test(t)) ((ops.speed = 1.5), summary.push("1,5x hız"));
  else if (/yavaş|slow/.test(t)) ((ops.speed = 0.5), summary.push("Yavaş çekim 0,5x"));
  if (/sessiz|sesi (kapat|kaldır|sil)|sessize|müziksiz/.test(t)) ((ops.mute = true), summary.push("Ses kapalı"));
  if (/siyah[- ]?beyaz|black.?white/.test(t)) ((ops.look = "siyah-beyaz"), summary.push("Siyah-beyaz"));
  else if (/canlı|parlak|doygun|renkli/.test(t)) ((ops.look = "canli"), summary.push("Canlı renkler"));
  else if (/sıcak|altın|gün batımı/.test(t)) ((ops.look = "sicak"), summary.push("Sıcak tonlar"));
  else if (/soğuk|mavi ton/.test(t)) ((ops.look = "soguk"), summary.push("Soğuk tonlar"));
  if (/geçiş|fade|karar(ma|t)|yumuşak (başla|bitir)/.test(t)) ((ops.fade = true), summary.push("Başta/sonda yumuşak geçiş"));
  const parsed = videoOpsSchema.parse({ ...ops, brief: brief.slice(0, 1000) });
  return { ops: parsed, summary: summary.length ? summary : ["Değişiklik bulunamadı: videoyu 720p'ye uyarla"], source: "kurallar" };
}

/** Brief → düzenleme planı (LLM; olmazsa kural çözümleyici). */
export async function planVideoEditFromBrief(brief: string, durationSec: number | null): Promise<BriefPlan> {
  const fallback = planFromKeywords(brief, durationSec);
  try {
    const r = await getLlm().completeText({
      system:
        'Video kurgu asistanı. Kullanıcının Türkçe isteğini yalnız şu JSON alanlarına çevir: {"trimStart": saniye, "trimEnd": saniye|null, "aspect": "orijinal"|"9:16"|"1:1"|"4:5"|"16:9", "speed": 0.5|1|1.5|2, "mute": bool, "look": "orijinal"|"canli"|"siyah-beyaz"|"sicak"|"soguk", "fade": bool, "summary": ["kısa Türkçe madde"]}. Yalnız JSON döndür.',
      promptVersion: "video-brief@1",
      prompt: `Video süresi: ${durationSec ?? "bilinmiyor"} sn.\nİstek: ${brief}`,
    });
    const obj = parseJsonObject(r.text);
    if (!obj) return fallback;
    const ops = videoOpsSchema.safeParse({ ...obj, brief: brief.slice(0, 1000) });
    if (!ops.success) return fallback;
    const summary = Array.isArray(obj.summary) ? obj.summary.filter((x): x is string => typeof x === "string").slice(0, 8) : fallback.summary;
    return { ops: ops.data, summary: summary.length ? summary : fallback.summary, source: "ai" };
  } catch {
    return fallback;
  }
}
