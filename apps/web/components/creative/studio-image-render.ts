/**
 * Tarayıcıda görsel düzenleme (ücretsiz, sunucuya/AI'ye gitmez).
 * Filtreler piksel düzeyinde uygulanır: canvas `ctx.filter` her tarayıcıda (Safari) yok.
 */
export type Aspect = "orijinal" | "1:1" | "4:5" | "9:16" | "16:9";
export type TextPos = "ust" | "orta" | "alt";
export type ImageEdits = {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  aspect: Aspect;
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  preset: Preset;
  text: string;
  textSize: number; // çıktı genişliğine oranla % (2..15)
  textColor: string;
  textPos: TextPos;
};
export type Preset = "yok" | "sicak" | "soguk" | "siyah-beyaz" | "vintage" | "canli";
export const PRESETS: { id: Preset; label: string }[] = [
  { id: "yok", label: "Yok" },
  { id: "canli", label: "Canlı" },
  { id: "sicak", label: "Sıcak" },
  { id: "soguk", label: "Soğuk" },
  { id: "vintage", label: "Vintage" },
  { id: "siyah-beyaz", label: "Siyah-beyaz" },
];
export const DEFAULT_EDITS: ImageEdits = { rotate: 0, flipH: false, aspect: "orijinal", brightness: 0, contrast: 0, saturation: 0, preset: "yok", text: "", textSize: 7, textColor: "#ffffff", textPos: "alt" };

const RATIO: Record<Exclude<Aspect, "orijinal">, number> = { "1:1": 1, "4:5": 4 / 5, "9:16": 9 / 16, "16:9": 16 / 9 };

/** Düzenlemeleri uygulayıp canvas'a çizer. maxSide: çıktının en uzun kenarı (önizleme için küçük). */
export function renderEdits(img: HTMLImageElement, edits: ImageEdits, canvas: HTMLCanvasElement, maxSide: number): void {
  const rot = edits.rotate % 180 !== 0;
  const srcW = rot ? img.naturalHeight : img.naturalWidth;
  const srcH = rot ? img.naturalWidth : img.naturalHeight;
  // Kadraj (ortadan kırpma)
  let cropW = srcW;
  let cropH = srcH;
  if (edits.aspect !== "orijinal") {
    const r = RATIO[edits.aspect];
    if (srcW / srcH > r) cropW = Math.round(srcH * r);
    else cropH = Math.round(srcW / r);
  }
  const scale = Math.min(1, maxSide / Math.max(cropW, cropH));
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.scale(scale, scale);
  ctx.rotate((edits.rotate * Math.PI) / 180);
  if (edits.flipH) ctx.scale(-1, 1);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
  applyPixels(ctx, outW, outH, edits);
  drawText(ctx, outW, outH, edits);
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function applyPixels(ctx: CanvasRenderingContext2D, w: number, h: number, e: ImageEdits): void {
  const p = presetAdjust(e.preset);
  const b = (e.brightness + p.brightness) * 1.28;
  const c = e.contrast + p.contrast;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const s = 1 + (e.saturation + p.saturation) / 100;
  if (b === 0 && c === 0 && s === 1 && !p.tint && !p.gray && !p.sepia) return;
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]!;
    let g = d[i + 1]!;
    let bl = d[i + 2]!;
    r = cf * (r - 128) + 128 + b;
    g = cf * (g - 128) + 128 + b;
    bl = cf * (bl - 128) + 128 + b;
    const l = 0.299 * r + 0.587 * g + 0.114 * bl;
    r = l + (r - l) * s;
    g = l + (g - l) * s;
    bl = l + (bl - l) * s;
    if (p.gray) r = g = bl = l;
    if (p.sepia) {
      const tr = 0.393 * r + 0.769 * g + 0.189 * bl;
      const tg = 0.349 * r + 0.686 * g + 0.168 * bl;
      const tb = 0.272 * r + 0.534 * g + 0.131 * bl;
      r = r * 0.4 + tr * 0.6;
      g = g * 0.4 + tg * 0.6;
      bl = bl * 0.4 + tb * 0.6;
    }
    if (p.tint) {
      r += p.tint[0];
      g += p.tint[1];
      bl += p.tint[2];
    }
    d[i] = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(bl);
  }
  ctx.putImageData(data, 0, 0);
}

function presetAdjust(p: Preset): { brightness: number; contrast: number; saturation: number; tint?: [number, number, number]; gray?: boolean; sepia?: boolean } {
  switch (p) {
    case "canli":
      return { brightness: 4, contrast: 12, saturation: 35 };
    case "sicak":
      return { brightness: 3, contrast: 6, saturation: 10, tint: [18, 6, -14] };
    case "soguk":
      return { brightness: 0, contrast: 6, saturation: -5, tint: [-12, 2, 18] };
    case "vintage":
      return { brightness: 6, contrast: -10, saturation: -25, sepia: true };
    case "siyah-beyaz":
      return { brightness: 0, contrast: 14, saturation: 0, gray: true };
    default:
      return { brightness: 0, contrast: 0, saturation: 0 };
  }
}

function drawText(ctx: CanvasRenderingContext2D, w: number, h: number, e: ImageEdits): void {
  const text = e.text.trim();
  if (!text) return;
  const size = Math.max(10, Math.round((w * e.textSize) / 100));
  ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Satırlara böl (genişliğe sığdır)
  const maxW = w * 0.88;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const lh = size * 1.2;
  const block = lh * lines.length;
  const y0 = e.textPos === "ust" ? h * 0.08 + lh / 2 : e.textPos === "orta" ? h / 2 - block / 2 + lh / 2 : h - h * 0.08 - block + lh / 2;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.round(size * 0.35);
  ctx.fillStyle = e.textColor;
  lines.forEach((l, i) => ctx.fillText(l, w / 2, y0 + i * lh));
  ctx.shadowBlur = 0;
}
