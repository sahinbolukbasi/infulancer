/**
 * Sayfa metinlerini çevirir: kaynak koddaki tt("Türkçe") anahtarlarını toplar, eksik olanları
 * Bedrock (Claude) ile EN/DE/FR'ye çevirip lib/i18n/messages/<dil>.json dosyalarına yazar.
 * Mevcut çeviriler korunur (elle düzeltilenler ezilmez).
 *
 *   AWS kimlik bilgileriyle: node scripts/i18n-translate.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MODEL = process.env.BEDROCK_TEXT_MODEL_ID || "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
const LANGS = { en: "English", de: "German", fr: "French" };
const client = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || "eu-central-1" });

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === "node_modules" || f.startsWith(".next")) continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p);
  }
  return out;
}
const keys = new Set();
for (const f of [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components")), ...walk(path.join(ROOT, "lib"))]) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\btt\(("(?:[^"\\]|\\.)*")\)/g)) keys.add(JSON.parse(m[1]));
}
// Tanıtım sayfası: nesne dizilerindeki metinler (tt(x.title) ile gösterilir).
for (const f of ["components/landing/landing-page.tsx", "components/landing/audience-hero.tsx", "components/landing/scroll-demo.tsx", "lib/landing-content.ts"]) {
  const src = readFileSync(path.join(ROOT, f), "utf8");
  for (const m of src.matchAll(/\b(?:title|text|cta|badgeText|q|a|label|niche|sector|quote|eyebrow|tab|tag|caption|metric|creator|city)\s*:\s*("(?:[^"\\]|\\.)*")/g)) {
    const v = JSON.parse(m[1]);
    if (/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(v) && !/^(from-|bg-|text-|\/)/.test(v)) keys.add(v);
  }
  // Demo tabloları: ["Bütçe", "450 bin TL"] gibi kısa diziler
  if (f.includes("scroll-demo")) for (const q of src.matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(q[1]) && !/^(from-|bg-|text-|rounded|flex|grid|h-|w-|p-|m-|border|\/|@|#[a-z]+\b$)/.test(q[1]) && !/[-:]/.test(q[1].split(" ")[0] ?? "")) keys.add(JSON.parse(`"${q[1]}"`));
  // Satır içi listeler: ["A", "B"].map( ve ["#id", "Etiket"] çiftleri; kişi/marka/değer alanları
  if (f.includes("landing")) {
    for (const m of src.matchAll(/\[((?:\s*"(?:[^"\\]|\\.)*"\s*,?)+)\]/g)) for (const q of m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}\s/.test(q[1]) || /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+( [a-zçğıöşü]+)?$/.test(q[1])) keys.add(JSON.parse(`"${q[1]}"`));
    for (const m of src.matchAll(/\b(?:name|person|brand|value|label|kind)\s*:\s*("(?:[^"\\]|\\.)*")/g)) { const v = JSON.parse(m[1]); if (/[a-zçğıöşü]{3,}/.test(v)) keys.add(v); }
  }
  // Dizi içindeki madde metinleri: items/words/bullets: ["…", "…"]
  for (const m of src.matchAll(/\b(?:items|words|bullets|points)\s*:\s*\[([^\]]*)\]/g)) {
    for (const q of m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(q[1])) keys.add(JSON.parse(`"${q[1]}"`));
  }
}
console.log(`${keys.size} anahtar`);

const SYSTEM = (lang) =>
  `You translate the user interface of "Nordvow", an influencer marketing SaaS (agencies, brands, creators), from Turkish to ${lang}. ` +
  `Return ONLY a JSON object mapping each input string (exact, unchanged) to its translation. Keep it short and natural for UI. ` +
  `Keep punctuation, leading/trailing symbols (→, ·, ×, :, parentheses), emoji, placeholders, @handles, #hashtags, numbers, units and brand/platform names (Nordvow, Instagram, TikTok, YouTube, Reels, Story, Shorts, Creative, C2PA) unchanged. ` +
  `Fragments may be partial sentences around values; translate them as fragments. Legal terms: "md. 23/A" stays as is; "Reklam" as an ad disclosure label becomes the target-language equivalent only when it is UI text, not inside quotes.`;

async function translateBatch(lang, batch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await client.send(
      new ConverseCommand({
        modelId: MODEL,
        system: [{ text: SYSTEM(LANGS[lang]) }],
        messages: [{ role: "user", content: [{ text: JSON.stringify(batch) }] }],
        inferenceConfig: { maxTokens: 8000, temperature: 0 },
      }),
    );
    const text = res.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    try {
      const obj = JSON.parse(json);
      return obj;
    } catch {
      console.warn(`  ${lang}: JSON okunamadı, tekrar (${attempt + 1})`, process.env.I18N_DEBUG ? JSON.stringify({ stop: res.stopReason, out: res.output }).slice(0, 600) : "");
    }
  }
  return {};
}

for (const lang of Object.keys(LANGS)) {
  const file = path.join(ROOT, "lib/i18n/messages", `${lang}.json`);
  const cur = JSON.parse(readFileSync(file, "utf8"));
  const todo = [...keys].filter((k) => !(k in cur));
  console.log(`${lang}: ${todo.length} çevrilecek`);
  for (let i = 0; i < todo.length; i += 30) {
    const batch = todo.slice(i, i + 30);
    const out = await translateBatch(lang, batch);
    for (const k of batch) if (typeof out[k] === "string" && out[k].trim()) cur[k] = out[k];
    process.stdout.write(`  ${Math.min(i + 30, todo.length)}/${todo.length}\r`);
    writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(cur).sort(([a], [b]) => a.localeCompare(b, "tr"))), null, 1) + "\n");
  }
  console.log("");
}
