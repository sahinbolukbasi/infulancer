import { envStr } from "../env";

/**
 * Banka ödeme talimatı dosyaları. Platform para göndermez; bu dosyalar
 * ajansın internet bankacılığına yüklenir, transferi banka yapar.
 *
 * CSV: UTF-8 BOM, "," ayraç; tutar TL, 2 ondalık, nokta ayraçlı.
 * XML: sadeleştirilmiş ISO 20022 pain.001.001.03 (GrpHdr + tek PmtInf, talep başına CdtTrfTxInf).
 */

export type BankInstruction = {
  /** PayoutRequest id (uçtan uca referans). */
  id: string;
  recipient: string;
  iban: string;
  amountKurus: number;
  description: string;
};

export type Debtor = { name: string; iban: string; bic: string };

export function agencyDebtor(): Debtor {
  return {
    name: envStr("AGENCY_NAME", "Infulancer Ajans"),
    iban: envStr("AGENCY_IBAN", "TR000000000000000000000000"),
    bic: envStr("AGENCY_BIC", "NOTPROVIDED"),
  };
}

/** Kuruş → "12500.50" (nokta ayraçlı, binlik ayraçsız). */
export function kurusToDecimal(kurus: number): string {
  const sign = kurus < 0 ? "-" : "";
  const abs = Math.abs(kurus);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

function csvCell(value: string): string {
  // Formül enjeksiyonunu engelle (=, +, -, @ ile başlayan hücreler).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildPayoutCsv(rows: BankInstruction[]): string {
  const header = ["Alıcı", "IBAN", "Tutar (TL)", "Açıklama", "Referans"];
  const lines = [header, ...rows.map((r) => [r.recipient, normalizeIban(r.iban), kurusToDecimal(r.amountKurus), r.description, r.id])];
  return `\uFEFF${lines.map((l) => l.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function xmlEscape(value: string): string {
  return value
    // XML 1.0'da geçersiz kontrol karakterlerini at.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** pain.001 Max35Text alanları için kırpma. */
function max(value: string, len: number): string {
  return value.length > len ? value.slice(0, len) : value;
}

export function buildPain001Xml(
  rows: BankInstruction[],
  opts: { messageId: string; createdAt: Date; executionDate: Date; debtor?: Debtor },
): string {
  const debtor = opts.debtor ?? agencyDebtor();
  const total = rows.reduce((s, r) => s + r.amountKurus, 0);
  const e = (v: string) => xmlEscape(v);
  const created = opts.createdAt.toISOString().slice(0, 19);
  const execDate = opts.executionDate.toISOString().slice(0, 10);

  const txs = rows
    .map(
      (r) => `      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${e(max(r.id, 35))}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="TRY">${kurusToDecimal(r.amountKurus)}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${e(max(r.recipient, 70))}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${e(normalizeIban(r.iban))}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${e(max(r.description, 140))}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${e(max(opts.messageId, 35))}</MsgId>
      <CreDtTm>${created}</CreDtTm>
      <NbOfTxs>${rows.length}</NbOfTxs>
      <CtrlSum>${kurusToDecimal(total)}</CtrlSum>
      <InitgPty>
        <Nm>${e(max(debtor.name, 70))}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${e(max(`${opts.messageId}-1`, 35))}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${rows.length}</NbOfTxs>
      <CtrlSum>${kurusToDecimal(total)}</CtrlSum>
      <ReqdExctnDt>${execDate}</ReqdExctnDt>
      <Dbtr>
        <Nm>${e(max(debtor.name, 70))}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${e(normalizeIban(debtor.iban))}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${e(debtor.bic)}</BIC>
        </FinInstnId>
      </DbtrAgt>
${txs}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}
