/**
 * Elle yazılmış SVG grafikler (sunucuda render edilir, bağımlılık yok).
 * Renk yok: çizgi ve çubuklar metin rengi tonlarıyla çizilir.
 */

export type ChartPoint = { label: string; value: number };

const W = 480;
const H = 160;
const PAD = { top: 12, right: 12, bottom: 24, left: 48 };

function bounds(values: number[]) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  return { min, max: max === min ? min + 1 : max };
}

/** Çizgi grafik: x ekseninde etiketler, y'de min/max kılavuzu. */
export function LineChart({ points, format, label }: { points: ChartPoint[]; format: (v: number) => string; label: string }) {
  if (points.length < 2) return <p className="text-[13px] text-fg-passive">Grafik için en az iki ölçüm gerekir.</p>;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  const min = lo - span * 0.1;
  const max = hi + span * 0.1;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * iw;
  const y = (v: number) => PAD.top + ih - ((v - min) / (max - min)) * ih;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-fg" role="img" aria-label={`${label}: ${points.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}>
        {[hi, lo].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray="2 4" />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--color-fg-passive)">
              {format(v)}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <circle cx={x(i)} cy={y(p.value)} r={2.5} fill="currentColor" />
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--color-fg-passive)">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

/** Dikey çubuk grafik. */
export function BarChart({ bars, format, label }: { bars: ChartPoint[]; format: (v: number) => string; label: string }) {
  if (bars.length === 0) return <p className="text-[13px] text-fg-passive">Henüz ölçüm yok.</p>;
  const { min, max } = bounds(bars.map((b) => b.value));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / bars.length;
  const bw = Math.min(32, slot * 0.6);
  const y = (v: number) => PAD.top + ih - ((v - min) / (max - min)) * ih;
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${format(b.value)}`).join(", ")}`}>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--color-border)" />
        <text x={PAD.left - 8} y={y(max) + 4} textAnchor="end" fontSize={10} fill="var(--color-fg-passive)">
          {format(max)}
        </text>
        {bars.map((b, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const top = y(Math.max(b.value, 0));
          return (
            <g key={`${b.label}-${i}`}>
              <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(y(0) - top, 1)} rx={2} fill="var(--color-fg-muted)">
                <title>{`${b.label}: ${format(b.value)}`}</title>
              </rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--color-fg-passive)">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
