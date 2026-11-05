/** Apple/Google Wallet "ekle" butonları. Mock modda web görünümüne, gerçek modda imzalı pass'e gider. */
export function WalletButtons({ appleUrl, googleUrl, live }: { appleUrl: string; googleUrl: string; live: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <a href={appleUrl} className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-[13px] font-medium text-white ring-1 ring-white/20">
          Apple Wallet&apos;a ekle
        </a>
        <a href={googleUrl} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black ring-1 ring-black/10">
          Google Wallet&apos;a ekle
        </a>
      </div>
      {!live ? <p className="text-[11px] text-fg-passive">Cüzdan imzalama anahtarları eklenince kart doğrudan cüzdana eklenir; şu an bilet/kupon web görünümü açılır.</p> : null}
    </div>
  );
}

/** QR kod görseli (data URL, sunucuda üretildi). */
export function QrImage({ dataUrl, alt }: { dataUrl: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- QR data URL
  return <img src={dataUrl} alt={alt} width={220} height={220} className="rounded-xl bg-white p-2" />;
}
