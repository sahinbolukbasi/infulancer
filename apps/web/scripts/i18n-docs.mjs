/**
 * Dokümantasyon (content/docs/*.mdx) çevirileri: her .mdx dosyasını EN/DE/FR'ye çevirip
 * content/docs-i18n/<lang>/<aynı yol>.mdx olarak yazar. Frontmatter'ın title/summary'si çevrilir,
 * teknik alanlar (slug, order, verification, sources, updatedAt, dosya yolları, kod, md. 23/A) korunur.
 * Zaten çevrilmiş dosyalar atlanır (yeniden çevirmek için ilgili dosyayı silin).
 *
 *   AWS kimlik bilgileriyle: node scripts/i18n-docs.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "content/docs");
const OUT = path.join(ROOT, "content/docs-i18n");
const MODEL = process.env.BEDROCK_TEXT_MODEL_ID || "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
const LANGS = { en: "English", de: "German", fr: "French" };
const client = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || "eu-central-1" });

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith(".mdx")) out.push(p);
  }
  return out;
}

/**
 * Çevrilen title/summary değerleri düz tırnak ("...") veya ":" içerebilir; bu YAML'ı bozar.
 * title: ve summary: satırlarını güvenli tek-tırnaklı YAML skaları olarak yeniden yazar
 * (varsa dıştaki tırnakları soyar, içteki tek tırnakları ikizler). Frontmatter sadece ilk bloktur.
 */
function safeFrontmatter(doc) {
  const m = doc.match(/^(---\n)([\s\S]*?)(\n---\n?)/);
  if (!m) return doc;
  const body = m[2]
    .split("\n")
    .map((line) => {
      const fm = line.match(/^(title|summary):\s*(.*)$/);
      if (!fm) return line;
      let v = fm[2].trim();
      // Dıştaki çift/tek tırnakları soy (tüm değeri sarıyorsa).
      if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) || (v.startsWith("'") && v.endsWith("'") && v.length > 1)) {
        v = v.slice(1, -1);
      }
      return `${fm[1]}: '${v.replace(/'/g, "''")}'`;
    })
    .join("\n");
  return m[1] + body + m[3] + doc.slice(m[0].length);
}

const SYSTEM = (lang) =>
  `You translate Markdown (MDX) documentation for "Nordvow", an influencer marketing SaaS, from Turkish to ${lang}. ` +
  `Return the FULL document translated, same structure. Rules: ` +
  `translate the frontmatter "title" and "summary" values only; keep all other frontmatter keys/values unchanged (slug, order, updatedAt, verification, sources). ` +
  `Keep Markdown syntax, headings, lists, tables, links and link targets (/docs/..., /admin/...), inline code and code blocks, URLs, numbers, @handles, #hashtags and brand/platform names (Nordvow, Instagram, TikTok, YouTube, WhatsApp, Meta, Reels, Story, Creative, C2PA, İYS, KVKK) unchanged. ` +
  `The legal reference "md. 23/A" stays unchanged. Link TEXT is translated but the URL in parentheses is not. Output only the document, no commentary, no code fences around the whole file.`;

async function translateDoc(lang, text) {
  const res = await client.send(
    new ConverseCommand({
      modelId: MODEL,
      system: [{ text: SYSTEM(LANGS[lang]) }],
      messages: [{ role: "user", content: [{ text }] }],
      inferenceConfig: { maxTokens: 8000, temperature: 0 },
    }),
  );
  let out = res.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";
  out = out.replace(/^```(?:mdx|markdown)?\n/, "").replace(/\n```\s*$/, "");
  return { out, stop: res.stopReason };
}

const files = walk(SRC);
console.log(`${files.length} doküman`);
for (const lang of Object.keys(LANGS)) {
  let done = 0, skip = 0, trunc = 0;
  for (const file of files) {
    const rel = path.relative(SRC, file);
    const dest = path.join(OUT, lang, rel);
    if (existsSync(dest)) { skip++; continue; }
    const src = readFileSync(file, "utf8");
    const { out, stop } = await translateDoc(lang, src);
    if (!out.includes("---") || out.length < src.length * 0.4) { console.warn(`  ${lang}/${rel}: şüpheli çıktı, atlandı (${stop})`); continue; }
    if (stop === "max_tokens") trunc++;
    mkdirSync(path.dirname(dest), { recursive: true });
    const safe = safeFrontmatter(out.endsWith("\n") ? out : out + "\n");
    writeFileSync(dest, safe);
    done++;
  }
  console.log(`${lang}: ${done} çevrildi, ${skip} atlandı${trunc ? `, ${trunc} kesik olabilir` : ""}`);
}
