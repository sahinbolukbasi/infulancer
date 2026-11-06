import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND_NAME } from "@infulancer/core/brand";
import { registerPdfFonts } from "./fonts";

const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 11, color: "#171717", padding: 48, lineHeight: 1.4 },
  kicker: { fontSize: 10, color: "#737373", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: 600, marginTop: 6 },
  org: { fontSize: 12, color: "#525252", marginTop: 4 },
  card: { marginTop: 28, borderWidth: 1, borderColor: "#E5E5E5", borderRadius: 12, padding: 24, flexDirection: "row", justifyContent: "space-between" },
  fields: { flexDirection: "column", gap: 12, flex: 1, paddingRight: 20 },
  label: { fontSize: 8, color: "#737373", letterSpacing: 0.5, textTransform: "uppercase" },
  value: { fontSize: 13, fontWeight: 600, marginTop: 2 },
  qrWrap: { alignItems: "center", justifyContent: "center" },
  qr: { width: 150, height: 150 },
  code: { marginTop: 8, fontSize: 14, fontWeight: 600, letterSpacing: 2, textAlign: "center" },
  codeHint: { marginTop: 2, fontSize: 8, color: "#737373", textAlign: "center", maxWidth: 160 },
  sectionTitle: { fontSize: 11, fontWeight: 600, marginTop: 24, marginBottom: 6 },
  para: { fontSize: 10, color: "#404040" },
  statusBar: { marginTop: 20, flexDirection: "row", gap: 6, alignItems: "center" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 10, color: "#404040" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#A3A3A3", flexDirection: "row", justifyContent: "space-between" },
});

export type PassField = { label: string; value: string };
type PassDocProps = {
  kicker: string;
  title: string;
  org: string;
  fields: PassField[];
  code: string;
  codeHint: string;
  qrDataUrl: string;
  statusLabel: string;
  statusColor: string;
  sections?: { title: string; body: string }[];
};

function PassDocument(p: PassDocProps) {
  registerPdfFonts();
  return (
    <Document title={`${p.title} – ${p.kicker}`} author={BRAND_NAME} language="tr">
      <Page size="A5" style={s.page}>
        <Text style={s.kicker}>{p.kicker}</Text>
        <Text style={s.title}>{p.title}</Text>
        <Text style={s.org}>{p.org}</Text>
        <View style={s.statusBar}>
          <View style={[s.statusDot, { backgroundColor: p.statusColor }]} />
          <Text style={s.statusText}>{p.statusLabel}</Text>
        </View>
        <View style={s.card}>
          <View style={s.fields}>
            {p.fields.map((f) => (
              <View key={f.label}>
                <Text style={s.label}>{f.label}</Text>
                <Text style={s.value}>{f.value}</Text>
              </View>
            ))}
          </View>
          <View style={s.qrWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image alt prop'u desteklemez */}
            <Image src={p.qrDataUrl} style={s.qr} />
            <Text style={s.code}>{p.code}</Text>
            <Text style={s.codeHint}>{p.codeHint}</Text>
          </View>
        </View>
        {(p.sections ?? []).map((sec) => (
          <View key={sec.title} wrap={false}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.para}>{sec.body}</Text>
          </View>
        ))}
        <View style={s.footer} fixed>
          <Text>{BRAND_NAME}</Text>
          <Text>{p.code}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderPassPdf(props: PassDocProps): Promise<Buffer> {
  return renderToBuffer(<PassDocument {...props} />);
}
