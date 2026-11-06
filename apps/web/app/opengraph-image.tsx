import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/brand";

/** Sosyal paylaşım (Open Graph / Twitter) görseli — Nordvow banner'ı, dinamik PNG. */
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${BRAND_NAME} — İçerik üreticileriyle ölçülebilir büyüme`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b0b14 0%, #14101f 100%)",
          padding: "72px 96px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Üst: logo + marka adı */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 128,
              height: 128,
              borderRadius: 32,
              background: "linear-gradient(135deg, #9d4dff 0%, #ff2bd6 50%, #00e5ff 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 86,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            N
          </div>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3, color: "#fafafa" }}>{BRAND_NAME}</div>
        </div>

        {/* Orta: slogan */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1, color: "#fafafa" }}>İçerik üreticileriyle ölçülebilir büyüme</div>
          <div style={{ fontSize: 28, color: "#a1a1a1" }}>Kampanya, içerik, etkinlik, kupon ve ödeme — tek platformda.</div>
        </div>

        {/* Alt: marka şeridi + domain */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 520, height: 8, borderRadius: 4, background: "linear-gradient(90deg, #9d4dff, #ff2bd6, #00e5ff)" }} />
          <div style={{ fontSize: 26, color: "#8a8a8f" }}>nordvow.com</div>
        </div>
      </div>
    ),
    size,
  );
}
