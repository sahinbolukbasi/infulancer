import type { Balances } from "@infulancer/core/domain/ledger";
import { MetricCard } from "@/components/ui/metric-card";

/** Üç ayrı bakiye: Hakedilen / Çekilebilir / İşlemde (ledger'dan türetilir, saklanmaz). */
export function BalanceCards({ balances, holdDays }: { balances: Balances; holdDays: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard
        label="Hakedilen"
        value={balances.hakedilen}
        format="currency-kurus"
        hint="Tamamlanan işler; kampanya kapanıp marka ödemesi gelene kadar bekler."
      />
      <MetricCard
        label="Çekilebilir"
        value={Math.max(balances.cekilebilir, 0)}
        format="currency-kurus"
        hint={`Kapanış ve marka ödemesinden ${holdDays} gün sonra talep edilebilir.`}
      />
      <MetricCard
        label="İşlemde"
        value={balances.islemde}
        format="currency-kurus"
        hint="Açık çekim talepleri: onay, ödeme listesi veya banka transferi bekliyor."
      />
    </div>
  );
}
