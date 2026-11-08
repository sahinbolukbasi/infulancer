import type { Balances } from "@infulancer/core/domain/ledger";
import { MetricCard } from "@/components/ui/metric-card";

/** Üç ayrı bakiye: Hakedilen / Çekilebilir / İşlemde (ledger'dan türetilir, saklanmaz). */
export function BalanceCards({ balances, holdDays, currency = "TRY" }: { balances: Balances; holdDays: number; currency?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard
        label="Hakedilen"
        value={balances.hakedilen}
        format="currency-kurus"
        currency={currency}
        hint="Tamamlanan işler; kampanya bitene kadar burada bekler."
      />
      <MetricCard
        label="Çekilebilir"
        value={Math.max(balances.cekilebilir, 0)}
        format="currency-kurus"
        currency={currency}
        hint={holdDays > 0 ? `Kampanya bittikten ${holdDays} gün sonra otomatik geçer; hemen çekim talebi oluşturabilirsiniz.` : "Kampanya bitince otomatik geçer; hemen çekim talebi oluşturabilirsiniz."}
      />
      <MetricCard
        label="İşlemde"
        value={balances.islemde}
        format="currency-kurus"
        currency={currency}
        hint="Açık çekim talepleri: onay, ödeme listesi veya banka transferi bekliyor."
      />
    </div>
  );
}
