/**
 * Apple/Google Wallet "ekle" rozetleri. Sertifika varsa imzalı pass indirilir (telefonda
 * doğrudan cüzdana eklenir); yoksa şık web görünümüne yönlendirir.
 */
export function WalletButtons({ appleUrl, googleUrl, live }: { appleUrl: string; googleUrl: string; live: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <a href={appleUrl} aria-label="Apple Wallet'a ekle" className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-white ring-1 ring-white/20 transition-standard hover:ring-white/40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.37 1.43c.06 1-.33 1.98-.95 2.69-.66.76-1.73 1.35-2.77 1.27-.08-.98.37-2 .95-2.64.66-.73 1.82-1.28 2.77-1.32zM19.8 8.4c-1.08.65-1.76 1.8-1.76 3.08 0 1.44.86 2.74 2.2 3.31-.26.83-.6 1.63-1.08 2.37-.66 1-1.35 1.98-2.44 2-1.05.02-1.4-.62-2.6-.62-1.2 0-1.59.6-2.58.64-1.05.04-1.85-1.07-2.52-2.06C5.3 17.1 4.2 13.6 5.62 11.2c.7-1.18 1.96-1.93 3.32-1.95 1.03-.02 2 .69 2.6.69.6 0 1.78-.86 3-.73.5.02 1.95.2 2.88 1.52l-.02.01z"/></svg>
          <span className="flex flex-col leading-none">
            <span className="text-[9px] opacity-80">Ekle</span>
            <span className="text-[13px] font-semibold">Apple Wallet</span>
          </span>
        </a>
        <a href={googleUrl} aria-label="Google Wallet'a ekle" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-black ring-1 ring-black/10 transition-standard hover:ring-black/30">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5.04 5.04 0 0 1-2.19 3.3v2.74h3.54c2.07-1.9 3.26-4.7 3.26-7.88z"/><path fill="#34A853" d="M12 23c2.95 0 5.43-.98 7.24-2.66l-3.54-2.74c-.98.66-2.24 1.05-3.7 1.05-2.85 0-5.26-1.92-6.12-4.5H2.22v2.83A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.88 14.15a6.6 6.6 0 0 1 0-4.3V7.02H2.22a11 11 0 0 0 0 9.96l3.66-2.83z"/><path fill="#EA4335" d="M12 5.5c1.6 0 3.05.55 4.19 1.64l3.14-3.14C17.43 2.1 14.95 1 12 1 7.7 1 3.99 3.47 2.22 7.02l3.66 2.83C6.74 7.42 9.15 5.5 12 5.5z"/></svg>
          <span className="flex flex-col leading-none">
            <span className="text-[9px] opacity-60">Ekle</span>
            <span className="text-[13px] font-semibold">Google Wallet</span>
          </span>
        </a>
      </div>
      {!live ? <p className="text-[11px] text-white/40">Cüzdan imzalama anahtarları eklenince kart telefonda doğrudan cüzdana eklenir; şu an web kart görünümü açılır.</p> : null}
    </div>
  );
}

/** QR kod görseli (data URL, sunucuda üretildi). */
export function QrImage({ dataUrl, alt }: { dataUrl: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- QR data URL
  return <img src={dataUrl} alt={alt} width={208} height={208} className="rounded-2xl bg-white p-3 shadow-lg" />;
}
