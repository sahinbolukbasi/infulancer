/**
 * Sayfa ve sunucu metinlerini çevirir: koddaki tt("Türkçe") anahtarlarını, DomainError mesajlarını
 * ve action dönüş mesajlarını toplar; eksik olanları Bedrock (Claude) ile EN/DE/FR'ye çevirip
 * lib/i18n/messages/<dil>.json dosyalarına yazar. Mevcut (elle düzeltilmiş) çeviriler korunur.
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
  for (const m of src.matchAll(/\b(?:items|words|bullets|points)\s*:\s*\[([^\]]*)\]/g)) {
    for (const q of m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(q[1])) keys.add(JSON.parse(`"${q[1]}"`));
  }
}
// Sunucudan dönen kullanıcı mesajları (FormMessage ve bildirimler tt ile çevirir).
const CORE = path.resolve(ROOT, "../../packages/core/src");
function collectServer(dir) {
  for (const f of readdirSync(dir)) {
    if (f === "node_modules" || f === "generated") continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) { collectServer(p); continue; }
    if (!/\.ts$/.test(f)) continue;
    const src = readFileSync(p, "utf8");
    for (const re of [
      /new (?:DomainError\([^,]+,\s*|\w*Error\()("(?:[^"\\]|\\.)*")/g,
      /\b(?:error|message):\s*("(?:[^"\\]|\\.)*")\s*[},]/g,
    ]) {
      for (const m of src.matchAll(re)) {
        let v; try { v = JSON.parse(m[1]); } catch { continue; }
        if (/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v) && v.length >= 4 && !/\$\{|^[a-z0-9_.-]+$|^https?:/.test(v) && /\s|[.?!]/.test(v)) keys.add(v);
      }
    }
  }
}
collectServer(CORE);
collectServer(path.join(ROOT, "lib/actions"));
console.log(`${keys.size} anahtar`);

const SYSTEM = (lang) =>
  `You translate the user interface of "Nordvow", an influencer marketing SaaS (agencies, brands, creators), from Turkish to ${lang}. ` +
  `Input is a numbered list, one item per line as "<n>\\t<Turkish>". Output the SAME numbers, one per line, as "<n>\\t<translation>", nothing else — no code fences, no commentary. ` +
  `Keep it short and natural for UI. Keep punctuation, leading/trailing symbols (→, ·, ×, :, parentheses), emoji, placeholders, @handles, #hashtags, numbers, units and brand/platform names (Nordvow, Instagram, TikTok, YouTube, Reels, Story, Shorts, Creative, C2PA) unchanged. ` +
  `Fragments may be partial sentences around values; translate them as fragments. The legal reference "md. 23/A" stays unchanged. Never merge lines.`;

async function translateBatch(lang, batch, depth = 0) {
  const numbered = batch.map((t, i) => `${i}\t${t.replace(/\r?\n/g, " ")}`).join("\n");
  const res = await client.send(
    new ConverseCommand({
      modelId: MODEL,
      system: [{ text: SYSTEM(LANGS[lang]) }],
      messages: [{ role: "user", content: [{ text: numbered }] }],
      inferenceConfig: { maxTokens: 8000, temperature: 0 },
    }),
  );
  const text = res.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";
  const out = {};
  for (const line of text.split("\n")) {
    const m = /^\s*(\d+)\t([\s\S]*)$/.exec(line);
    if (m) { const i = Number(m[1]); if (batch[i] != null && m[2].trim()) out[batch[i]] = m[2].trim(); }
  }
  const missing = batch.filter((t) => !(t in out));
  if (missing.length && depth < 4) {
    // Eksik kalanları (model kesti veya atladı) daha küçük parçayla tamamla.
    const half = missing.length > 4 ? Math.ceil(missing.length / 2) : missing.length;
    for (let i = 0; i < missing.length; i += half) Object.assign(out, await translateBatch(lang, missing.slice(i, i + half), depth + 1));
  }
  return out;
}

for (const lang of Object.keys(LANGS)) {
  const file = path.join(ROOT, "lib/i18n/messages", `${lang}.json`);
  const cur = JSON.parse(readFileSync(file, "utf8"));
  const todo = [...keys].filter((k) => !(k in cur));
  console.log(`${lang}: ${todo.length} çevrilecek`);
  for (let i = 0; i < todo.length; i += 40) {
    const batch = todo.slice(i, i + 40);
    const out = await translateBatch(lang, batch);
    for (const k of batch) if (typeof out[k] === "string" && out[k].trim()) cur[k] = out[k];
    process.stdout.write(`  ${Math.min(i + 40, todo.length)}/${todo.length}\r`);
    writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(cur).sort(([a], [b]) => a.localeCompare(b, "tr"))), null, 1) + "\n");
  }
  console.log("");
}
