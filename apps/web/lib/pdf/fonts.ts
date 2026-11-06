import path from "node:path";
import { Font } from "@react-pdf/renderer";
/**
 * PDF için Geist yazı tipini (Türkçe karakterler) tek yerden kaydeder.
 * Birden çok PDF belgesi (kampanya raporu, bilet, kupon) ortak kullanır.
 */
let registered = false;
export function registerPdfFonts(): void {
  if (registered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: "Geist",
    fonts: [
      { src: path.join(dir, "Geist-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Geist-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
