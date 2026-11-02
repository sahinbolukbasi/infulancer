// Sayı/yüzde biçimleyicileri (tr-TR).
export const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
export const num = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
export const pct1 = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });

/** KPI değerini biçimler (ER oran, diğerleri sayı). */
export function fmtKpi(kpi: string, v: number): string {
  return kpi === "er" ? pct1.format(v) : num.format(v);
}
