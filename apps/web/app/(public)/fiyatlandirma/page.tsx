import type { Metadata } from "next";
import { getConfig } from "@infulancer/core/config/store";
import { prisma } from "@infulancer/core/db";
import { UNVERIFIED_FACTS, withUnverified } from "@infulancer/core/unverified";
import { Card, CardTitle } from "@/components/ui/card";
import { InfoNote, UnverifiedBadge } from "@/components/ui/unverified";

export const metadata: Metadata = { title: "Fiyatlandırma" };
export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

export default async function PricingPage() {
  const [mba, competitors, bsp, rates] = await Promise.all([
    getConfig("pricing.metaBusinessAgent"),
    getConfig("pricing.competitors"),
    getConfig("pricing.bsp360dialog"),
    prisma.countryRate.findMany({ orderBy: [{ countryCode: "asc" }, { category: "asc" }] }),
  ]);
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-[40px] font-semibold leading-tight tracking-tight">Fiyatlandırma</h1>
        <p className="max-w-2xl text-fg-muted">
          Influencer iş akışı, Instagram DM ve md. 23/A reklam açıklaması otomasyonu tek panelde. Koltuk ücreti yok. Yapay zekâ cevaplayamadığında ya da müşteri
          temsilci istediğinde AI ücreti alınmaz; konuşma yeniden açılırsa ücret iade edilir.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>Bizim AI agent’ımız</CardTitle>
          <p className="text-sm text-fg-muted">Bedrock üzerinde çalışır; kredi ile ölçülür veya pakete dahildir. Bilgi tabanınızdan (RAG) yanıt verir.</p>
        </Card>
        <Card interactive={false} className="flex flex-col gap-3">
          <CardTitle>
            Meta Business Agent (karşılaştırma)
            <UnverifiedBadge />
          </CardTitle>
          <p className="text-sm text-fg-muted">
            {withUnverified(`${usd.format(mba.usdPerMillionTokens)} / 1M token, mesaj başına yaklaşık ${usd.format(mba.usdPerMessageApprox[0])}–${usd.format(mba.usdPerMessageApprox[1])}`, false)}
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">WhatsApp mesaj maliyetleri (Meta’ya doğrudan ödenir)</h2>
        <InfoNote>
          Tech Provider modelindeyiz: mesaj ücretlerini Meta sizin ödeme yönteminizden tahsil eder, biz mesaj marjı almayız. Numara başına ayda 1.000 servis mesajı ücretsizdir.
          Click-to-WhatsApp reklamından gelen kullanıcılarla 7 gün boyunca ücretsiz konuşursunuz. {UNVERIFIED_FACTS.trRates}
        </InfoNote>
        <table className="w-full text-sm">
          <caption className="sr-only">Ülke ve kategoriye göre mesaj ücretleri</caption>
          <thead>
            <tr className="border-b border-border text-left text-fg-muted">
              <th className="py-2 font-normal">Ülke</th>
              <th className="py-2 font-normal">Kategori</th>
              <th className="py-2 font-normal">Mesaj başı</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={`${r.countryCode}-${r.category}-${r.effectiveFrom.toISOString()}`} className="border-b border-border">
                <td className="py-2">{r.countryCode}</td>
                <td className="py-2">{r.category}</td>
                <td className="py-2 tabular-nums">
                  {usd.format(Number(r.rateUsd))}
                  <UnverifiedBadge verified={r.verified} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">
          Piyasa referansları
          <UnverifiedBadge />
        </h2>
        <ul className="flex flex-col divide-y divide-border text-sm">
          {competitors.map((c) => (
            <li key={c.name} className="flex justify-between gap-4 py-2">
              <span>{c.name}</span>
              <span className="text-fg-muted">{c.detail}</span>
            </li>
          ))}
          {bsp.map((b) => (
            <li key={b.tier} className="flex justify-between gap-4 py-2">
              <span>360dialog {b.tier}</span>
              <span className="text-fg-muted">
                €{b.eurPerMonth}/ay · {b.channels} kanal
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
