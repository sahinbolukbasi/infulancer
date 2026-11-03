// Sayı/yüzde biçimleyicileri (tr-TR).
export const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
export const num = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
/** 12,5 B / 1,2 Mn gibi kısa sayı. */
export const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
export const pct1 = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });

/** "TR12 •••• •••• 3456": baştaki 4 ve sondaki 4 karakter görünür. */
export function maskIban(iban: string): string {
  const v = iban.replace(/\s+/g, "").toUpperCase();
  if (v.length <= 8) return v;
  return `${v.slice(0, 4)} •••• •••• ${v.slice(-4)}`;
}
/** KPI değerini biçimler (ER oran, diğerleri sayı). */
export function fmtKpi(kpi: string, v: number): string {
  return kpi === "er" ? pct1.format(v) : num.format(v);
}
