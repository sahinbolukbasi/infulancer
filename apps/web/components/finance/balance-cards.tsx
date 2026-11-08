import { getTT } from "@/lib/i18n/tt-server";
import type { Balances } from "@infulancer/core/domain/ledger";
import { MetricCard } from "@/components/ui/metric-card";

/** Üç ayrı bakiye: Hakedilen / Çekilebilir / İşlemde (ledger'dan türetilir, saklanmaz). */
export async function BalanceCards({ balances, holdDays, currency = "TRY" }: { balances: Balances; holdDays: number; currency?: string }) {
  const tt = await getTT();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard
        label={tt("Hakedilen")}
        value={balances.hakedilen}
        format="currency-kurus"
        currency={currency}
        hint={tt("Tamamlanan işler; kampanya bitene kadar burada bekler.")}
      />
      <MetricCard
        label={tt("Çekilebilir")}
        value={Math.max(balances.cekilebilir, 0)}
        format="currency-kurus"
        currency={currency}
        hint={holdDays > 0 ? `Kampanya bittikten ${holdDays} gün sonra otomatik geçer; hemen çekim talebi oluşturabilirsiniz.` : tt("Kampanya bitince otomatik geçer; hemen çekim talebi oluşturabilirsiniz.")}
      />
      <MetricCard
        label={tt("İşlemde")}
        value={balances.islemde}
        format="currency-kurus"
        currency={currency}
        hint={tt("Açık çekim talepleri: onay, ödeme listesi veya banka transferi bekliyor.")}
      />
    </div>
  );
}
