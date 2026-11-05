"use client";
/** Kök düzen çökerse devreye girer; kendi <html>/<body>'sini kurar. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#05050a", color: "#fafafa", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Bir sorun oluştu</h1>
        <p style={{ color: "#a1a1a1", maxWidth: 420 }}>Beklenmedik bir hata nedeniyle sayfa yüklenemedi.</p>
        {error.digest ? <p style={{ color: "#525252", fontSize: 12 }}>Hata kodu: {error.digest}</p> : null}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={reset} style={{ height: 44, padding: "0 24px", borderRadius: 999, border: "none", background: "#ff2bd6", color: "#000", fontWeight: 600, cursor: "pointer" }}>
            Tekrar dene
          </button>
          {/* global-error kök düzeni değiştirir; next/link burada kullanılamaz, düz <a> gerekir. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ height: 44, display: "inline-flex", alignItems: "center", padding: "0 24px", borderRadius: 999, border: "1px solid #333", color: "#fafafa", textDecoration: "none" }}>
            Ana sayfa
          </a>
        </div>
      </body>
    </html>
  );
}
