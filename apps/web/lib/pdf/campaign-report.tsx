import path from "node:path";
import type { ReactNode } from "react";
import { Document, Font, Link, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BrandCampaignReport } from "@infulancer/core/access/brand-report";
import { kpiLabels, kpiStatusLabels } from "@infulancer/core/domain/campaign-score";
import {
  campaignStatusLabels,
  contentTypeLabels,
  deliverableStatusLabels,
  metricSourceLabels,
  platformLabels,
  trustLevelLabels,
} from "@infulancer/core/domain/labels";
import { fmtKpi, num, pct, pct1 } from "@/lib/format";
import { fmtDate, fmtDateTime } from "@/lib/time";

/**
 * Marka kampanya raporu (PDF). Yalnız BrandCampaignReport DTO'sunu alır;
 * bedel/komisyon bilgisi bu bileşene ulaşamaz. Türkçe karakterler için Geist
 * (OFL, apps/web/assets/fonts) gömülür.
 */

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: "Geist",
    fonts: [
      { src: path.join(dir, "Geist-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Geist-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  // Türkçe metinde kelime ortasında tirelemeyi kapat.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

// Geist'te ₺ glifi yok; PDF'te "TL" yazılır.
const tl = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (kurus: number) => `${tl.format(kurus / 100)} TL`;
const roasFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 9, color: "#171717", padding: 40, lineHeight: 1.4 },
  cover: { fontFamily: "Geist", padding: 56, backgroundColor: "#0A0A0A", color: "#FAFAFA", justifyContent: "space-between" },
  coverKicker: { fontSize: 10, color: "#A1A1A1", letterSpacing: 1.2 },
  coverTitle: { fontSize: 30, fontWeight: 600, marginTop: 12 },
  coverMeta: { fontSize: 11, color: "#A1A1A1", marginTop: 8 },
  coverScore: { fontSize: 64, fontWeight: 600 },
  h2: { fontSize: 13, fontWeight: 600, marginBottom: 8, marginTop: 18 },
  muted: { color: "#525252" },
  small: { fontSize: 8, color: "#525252" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#D4D4D4", paddingVertical: 4 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#171717", paddingVertical: 4 },
  th: { fontWeight: 600, fontSize: 8 },
  stats: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  stat: { width: "25%", paddingVertical: 6, paddingRight: 8 },
  statLabel: { fontSize: 8, color: "#525252" },
  statValue: { fontSize: 14, fontWeight: 600 },
  link: { color: "#171717", textDecoration: "underline" },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 7, color: "#737373", flexDirection: "row", justifyContent: "space-between" },
});

type Col = { label: string; width: string; align?: "right" };

function Table({ cols, rows }: { cols: Col[]; rows: (string | ReactNode)[][] }) {
  return (
    <View>
      <View style={s.head} fixed>
        {cols.map((c) => (
          <Text key={c.label} style={[s.th, { width: c.width, textAlign: c.align ?? "left" }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {r.map((cell, j) => (
            <View key={j} style={{ width: cols[j]!.width }}>
              {typeof cell === "string" ? <Text style={{ textAlign: cols[j]!.align ?? "left" }}>{cell}</Text> : cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Footer({ name }: { name: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{name} · Kampanya raporu</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function CampaignReportDocument({ report, generatedAt }: { report: BrandCampaignReport; generatedAt: Date }) {
  const { campaign, score, totals } = report;
  const stat = (label: string, value: string) => (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );

  return (
    <Document title={`${campaign.name} – Kampanya raporu`} author="Infulancer" language="tr">
      <Page size="A4" style={s.cover}>
        <View>
          <Text style={s.coverKicker}>KAMPANYA RAPORU</Text>
          <Text style={s.coverTitle}>{campaign.name}</Text>
          <Text style={s.coverMeta}>{campaign.brandName}</Text>
          <Text style={s.coverMeta}>
            {fmtDate(campaign.startsAt)} – {fmtDate(campaign.endsAt)} · {campaignStatusLabels[campaign.status]}
          </Text>
        </View>
        <View>
          <Text style={s.coverKicker}>KAMPANYA SKORU</Text>
          <Text style={s.coverScore}>{score.score == null ? "—" : pct.format(score.score)}</Text>
          <Text style={s.coverMeta}>Oluşturulma: {fmtDateTime(generatedAt)}</Text>
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={[s.h2, { marginTop: 0 }]}>Özet</Text>
        <View style={s.stats}>
          {stat("Toplam ödenen", money(campaign.brandTotalFeeKurus))}
          {stat("Erişim", num.format(totals.reach))}
          {stat("Gösterim", num.format(totals.impressions))}
          {stat("Tıklama", num.format(totals.clicks))}
          {stat("Satış", num.format(totals.sales))}
          {report.roas != null ? stat("Ciro", money(totals.revenueKurus)) : null}
          {report.roas != null ? stat("ROAS", `${roasFmt.format(report.roas)}x`) : null}
          {stat("İçerik", num.format(report.deliverables.length))}
        </View>

        {campaign.reportSummary ? (
          <>
            <Text style={s.h2}>Ajans değerlendirmesi</Text>
            <Text>{campaign.reportSummary}</Text>
          </>
        ) : null}

        <Text style={s.h2}>Skor ve KPI kırılımı</Text>
        {score.kpis.length === 0 ? (
          <Text style={s.muted}>Bu kampanyada hedef tanımlı değil.</Text>
        ) : (
          <Table
            cols={[
              { label: "KPI", width: "20%" },
              { label: "Ağırlık", width: "10%", align: "right" },
              { label: "Hedef", width: "15%", align: "right" },
              { label: "Gerçekleşen", width: "15%", align: "right" },
              { label: "Oran", width: "10%", align: "right" },
              { label: "Durum", width: "30%", align: "right" },
            ]}
            rows={score.kpis.map((k) => [
              kpiLabels[k.kpi],
              String(k.weight),
              fmtKpi(k.kpi, k.target),
              fmtKpi(k.kpi, k.actual),
              pct.format(k.ratio),
              k.status === "OLCULUYOR" && k.projection != null
                ? `${kpiStatusLabels[k.status]} · projeksiyon ${fmtKpi(k.kpi, k.projection)}`
                : kpiStatusLabels[k.status],
            ])}
          />
        )}

        <Text style={s.h2}>Influencer performansı</Text>
        <Table
          cols={[
            { label: "Influencer", width: "24%" },
            { label: "Platform", width: "16%" },
            { label: "İçerik", width: "8%", align: "right" },
            { label: "Erişim", width: "12%", align: "right" },
            { label: "ER", width: "10%", align: "right" },
            { label: "Tıklama", width: "10%", align: "right" },
            { label: "Satış", width: "8%", align: "right" },
            { label: "Zamanında", width: "12%", align: "right" },
          ]}
          rows={report.influencers.map((r) => [
            `${r.name}${r.accounts.length ? `\n${r.accounts.map((a) => a.handle).join(" · ")}` : ""}`,
            r.platforms.map((p) => platformLabels[p]).join(", ") || "—",
            String(r.deliverableCount),
            num.format(r.reach),
            r.er == null ? "—" : pct1.format(r.er),
            num.format(r.clicks),
            num.format(r.sales),
            r.onTimeRate == null ? "—" : pct.format(r.onTimeRate),
          ])}
        />

        <Text style={s.h2}>İçerikler</Text>
        <Table
          cols={[
            { label: "Influencer", width: "20%" },
            { label: "İçerik", width: "18%" },
            { label: "Paylaşım", width: "17%" },
            { label: "Durum", width: "15%" },
            { label: "Bağlantı", width: "30%" },
          ]}
          rows={report.deliverables.map((d) => [
            d.influencer.name,
            `${platformLabels[d.platform]} ${contentTypeLabels[d.contentType]}`,
            fmtDateTime(d.publishedAt ?? d.plannedAt),
            deliverableStatusLabels[d.status],
            d.postUrl ? (
              <Link src={d.postUrl} style={s.link}>
                {d.postUrl}
              </Link>
            ) : (
              <Text style={s.muted}>—</Text>
            ),
          ])}
        />

        <Text style={s.h2}>Metrik kaynakları ve güven düzeyi</Text>
        {report.trust.map((t) => (
          <Text key={t.source}>
            {metricSourceLabels[t.source]}: {trustLevelLabels[t.level]} · {num.format(t.count)} ölçüm
          </Text>
        ))}
        <Text style={[s.small, { marginTop: 6 }]}>
          Metrik snapshot&apos;ları birikir, üzerine yazılmaz. Platform API ve marka verisi yüksek, agent tarafından doğrulanan ekran görüntüsü orta,
          manuel giriş düşük güvenlidir. Saatler İstanbul saatine göredir.
        </Text>
        <Footer name={campaign.name} />
      </Page>
    </Document>
  );
}

export async function renderCampaignReportPdf(report: BrandCampaignReport, generatedAt: Date = new Date()): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<CampaignReportDocument report={report} generatedAt={generatedAt} />);
}
