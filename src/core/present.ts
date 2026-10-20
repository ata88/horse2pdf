/**
 * Presentation helpers shared by the on-screen viewer and the PDF export, so both
 * always show the same information with the same wording.
 */
import {
  ALLOWANCE_REASONS,
  CHARGE_REASONS,
  codeLabel,
  ID_SCHEMES,
  INVOICE_TYPES,
  label,
  NOTE_SUBJECTS,
  PAYMENT_MEANS,
  TAX_POINT_DATE_CODES,
  UNITS,
  UNITS_SHORT,
  VAT_CATEGORIES,
  VATEX,
} from "./codelists";
import { date, iban, money, percent, period, quantity } from "./format";
import type { AllowanceCharge, Identifier, Invoice, InvoiceLine, Party } from "./model";

export type Row = [label: string, value: string];

const rows = (list: Array<[string, string | undefined | false]>): Row[] =>
  list.filter((r): r is Row => typeof r[1] === "string" && r[1] !== "");

export function documentTitle(inv: Invoice): string {
  const l = label(INVOICE_TYPES, inv.typeCode);
  if (l) return l;
  return inv.kind === "creditNote" ? "Gutschrift" : "Rechnung";
}

export function identifier(id: Identifier | undefined): string | undefined {
  if (!id) return undefined;
  if (!id.scheme) return id.value;
  return `${id.value} (${label(ID_SCHEMES, id.scheme) ?? `Schema ${id.scheme}`})`;
}

export function unitLabel(code: string | undefined): string {
  if (!code) return "";
  return label(UNITS, code) ?? code;
}

/** Compact unit for table columns: "kWh", "Stk", … (full name otherwise). */
export function unitShort(code: string | undefined): string {
  if (!code) return "";
  return label(UNITS_SHORT, code) ?? unitLabel(code);
}

export function vatLabel(category: string | undefined, rate: number | undefined): string {
  if (!category) return rate !== undefined ? percent(rate) : "";
  if (category === "S" || rate) return percent(rate ?? 0);
  return label(VAT_CATEGORIES, category) ?? category;
}

export function noteSubject(code: string | undefined): string | undefined {
  return code ? codeLabel(NOTE_SUBJECTS, code) : undefined;
}

/** Header facts shown next to the recipient address. */
export function headerRows(inv: Invoice): Row[] {
  const isXr = inv.profile.family === "xrechnung";
  return rows([
    ["Rechnungsnummer", inv.number],
    ["Rechnungsdatum", date(inv.issueDate)],
    ["Fällig am", date(inv.dueDate)],
    ["Leistungsdatum", date(inv.delivery?.date)],
    ["Leistungszeitraum", period(inv.invoicePeriod?.start, inv.invoicePeriod?.end)],
    [isXr ? "Leitweg-ID / Käuferreferenz" : "Käuferreferenz", inv.buyerReference],
    ["Bestellnummer", inv.orderReference],
    ["Währung", inv.currency !== "EUR" ? inv.currency : undefined],
  ]);
}

export function referenceRows(inv: Invoice): Row[] {
  return rows([
    ["Rechnungsart", codeLabel(INVOICE_TYPES, inv.typeCode)],
    ["Profil", inv.profile.name],
    ["Rechnungswährung", inv.currency],
    ["Steuerwährung", inv.taxCurrency],
    ["Steuerdatum", date(inv.taxPointDate)],
    ["Steuerdatum bestimmt durch", codeLabel(TAX_POINT_DATE_CODES, inv.taxPointDateCode)],
    ["Projektreferenz", inv.projectReference],
    ["Vertragsreferenz", inv.contractReference],
    ["Bestellnummer", inv.orderReference],
    ["Auftragsnummer", inv.salesOrderReference],
    ["Wareneingangsmeldung", inv.receivingAdviceReference],
    ["Versandanzeige", inv.despatchAdviceReference],
    ["Ausschreibung / Los", inv.tenderReference],
    ["Objektkennung", identifier(inv.invoicedObject)],
    ["Buchungsreferenz (Käufer)", inv.buyerAccountingReference],
    ...inv.precedingInvoices.map((p): [string, string] => [
      "Vorausgegangene Rechnung",
      [p.id, p.issueDate ? `vom ${date(p.issueDate)}` : ""].filter(Boolean).join(" "),
    ]),
  ]);
}

export function partyRows(p: Party | undefined): Row[] {
  if (!p) return [];
  return rows([
    ["Handelsname", p.tradingName && p.tradingName !== p.name ? p.tradingName : undefined],
    ...p.identifiers.map((i): [string, string | undefined] => ["Kennung", identifier(i)]),
    ["Registernummer", identifier(p.legalRegistration)],
    ["USt-IdNr.", p.vatId],
    ["Steuernummer", p.taxRegistrationId],
    ["Rechtliche Informationen", p.additionalLegalInfo],
    ["Elektronische Adresse", identifier(p.electronicAddress)],
    ["Kontakt", p.contact?.name],
    ["Telefon", p.contact?.phone],
    ["E-Mail", p.contact?.email],
  ]);
}

export function deliveryRows(inv: Invoice): Row[] {
  const d = inv.delivery;
  if (!d) return [];
  return rows([
    ["Empfänger", d.partyName],
    ["Lieferort-Kennung", identifier(d.locationId)],
    ["Lieferdatum", date(d.date)],
  ]);
}

export function paymentRows(inv: Invoice): Row[] {
  const p = inv.payment;
  const out: Array<[string, string | undefined]> = [
    ["Zahlungsart", p ? (p.meansText ?? label(PAYMENT_MEANS, p.meansCode) ?? p.meansCode) : undefined],
    ["Fällig am", date(inv.dueDate)],
    ["Verwendungszweck", p?.remittanceInfo],
  ];
  for (const t of p?.creditTransfers ?? []) {
    out.push(["Kontoinhaber", t.accountName]);
    out.push(["IBAN", iban(t.accountId)]);
    out.push(["BIC", t.bic]);
  }
  if (p?.card) {
    out.push(["Karte", `•••• ${p.card.pan}`]);
    out.push(["Karteninhaber", p.card.holder]);
  }
  if (p?.directDebit) {
    out.push(["Mandatsreferenz", p.directDebit.mandateId]);
    out.push(["Gläubiger-ID", p.directDebit.creditorId]);
    out.push(["Belastetes Konto", iban(p.directDebit.debitedAccount)]);
  }
  out.push(["Zahlungsbedingungen", inv.paymentTerms]);
  return rows(out);
}

export function allowanceChargeText(
  ac: AllowanceCharge,
  currency?: string,
): { label: string; detail: string } {
  const kind = ac.isCharge ? "Zuschlag" : "Nachlass";
  const reason =
    ac.reason ??
    (ac.reasonCode ? label(ac.isCharge ? CHARGE_REASONS : ALLOWANCE_REASONS, ac.reasonCode) : undefined);
  const code = ac.reasonCode ? ` (Code ${ac.reasonCode})` : "";
  const parts = [
    ac.percent !== undefined && ac.baseAmount !== undefined
      ? `${percent(ac.percent)} von ${money(ac.baseAmount, currency)}`
      : ac.percent !== undefined
        ? percent(ac.percent)
        : undefined,
    ac.vatCategory ? `USt ${vatLabel(ac.vatCategory, ac.vatRate)}` : undefined,
  ].filter(Boolean);
  return { label: `${kind}${reason ? `: ${reason}` : ""}${code}`, detail: parts.join(" · ") };
}

/** Secondary information shown below the item name of a line. */
export function lineDetails(l: InvoiceLine, currency?: string): string[] {
  const d: string[] = [];
  if (l.item.description && l.item.description !== l.item.name) d.push(l.item.description);
  const ids = [
    l.item.sellerId && `Art.-Nr. ${l.item.sellerId}`,
    l.item.buyerId && `Käufer-Art.-Nr. ${l.item.buyerId}`,
    l.item.standardId &&
      `${label(ID_SCHEMES, l.item.standardId.scheme ?? "") ?? "Kennung"} ${l.item.standardId.value}`,
  ].filter(Boolean);
  if (ids.length) d.push(ids.join(" · "));
  for (const c of l.item.classifications)
    d.push(`Klassifikation ${c.scheme ? `${c.scheme} ` : ""}${c.value}`);
  for (const a of l.item.attributes) d.push(`${a.name}: ${a.value}`);
  if (l.item.originCountry) d.push(`Herkunftsland: ${l.item.originCountry}`);
  if (l.period) d.push(`Zeitraum: ${period(l.period.start, l.period.end)}`);
  if (l.orderLineReference) d.push(`Bestellposition: ${l.orderLineReference}`);
  if (l.buyerAccountingReference) d.push(`Kontierung: ${l.buyerAccountingReference}`);
  if (l.objectId) d.push(`Objekt: ${identifier(l.objectId)}`);
  const price: string[] = [];
  if (l.price.gross !== undefined) price.push(`Listenpreis ${money(l.price.gross, currency)}`);
  if (l.price.discount !== undefined) price.push(`Preisnachlass ${money(l.price.discount, currency)}`);
  if (l.price.baseQuantity !== undefined && l.price.baseQuantity !== 1) {
    price.push(`Preis je ${quantity(l.price.baseQuantity)} ${unitLabel(l.price.baseQuantityUnit ?? l.unit)}`);
  }
  if (price.length) d.push(price.join(" · "));
  for (const ac of l.allowancesCharges) {
    const t = allowanceChargeText(ac, currency);
    d.push(
      `${t.label}: ${ac.isCharge ? "+" : "−"}${money(ac.amount, currency)}${t.detail ? ` (${t.detail})` : ""}`,
    );
  }
  if (l.note) d.push(`Hinweis: ${l.note}`);
  return d;
}

export function vatBreakdownLabel(category: string, rate: number | undefined): string {
  const cat = label(VAT_CATEGORIES, category) ?? category;
  return category === "S" ? `USt ${percent(rate ?? 0)}` : `${cat}${rate ? ` ${percent(rate)}` : ""}`;
}

export function exemptionText(reason?: string, code?: string): string | undefined {
  if (!reason && !code) return undefined;
  const codeText = code ? (label(VATEX, code) ? `${label(VATEX, code)} (${code})` : code) : undefined;
  return [reason, codeText].filter(Boolean).join(" – ");
}

export interface TotalRow {
  label: string;
  value: number;
  strong?: boolean;
  /** Currency if it differs from the invoice currency (BT-111). */
  currency?: string;
  /** BT number for the "show BT ids" mode. */
  bt?: string;
}

/** Totals block in the order of EN 16931 (only lines that carry a value). */
export function totalRows(inv: Invoice): TotalRow[] {
  const t = inv.totals;
  const out: TotalRow[] = [];
  const push = (label: string, value: number | undefined, bt: string, strong = false) => {
    if (value !== undefined) out.push({ label, value, bt, strong });
  };
  const hasAc = !!(t.allowances || t.charges);
  push("Summe Positionen (netto)", t.lineNet, "BT-106");
  if (t.allowances) push("Nachlässe", -t.allowances, "BT-107");
  if (t.charges) push("Zuschläge", t.charges, "BT-108");
  if (hasAc || t.taxExclusive !== t.lineNet) push("Gesamt netto", t.taxExclusive, "BT-109");
  for (const v of inv.vatBreakdown) {
    out.push({
      label: `${vatBreakdownLabel(v.category, v.rate)} auf ${money(v.taxableAmount, inv.currency)}`,
      value: v.taxAmount,
      bt: "BT-117",
    });
  }
  if (inv.vatBreakdown.length !== 1) push("Umsatzsteuer gesamt", t.tax, "BT-110");
  if (t.taxInTaxCurrency !== undefined && inv.taxCurrency && inv.taxCurrency !== inv.currency) {
    out.push({
      label: `Umsatzsteuer in ${inv.taxCurrency}`,
      value: t.taxInTaxCurrency,
      bt: "BT-111",
      currency: inv.taxCurrency,
    });
  }
  push("Gesamt brutto", t.taxInclusive, "BT-112", true);
  if (t.prepaid) push("Bereits gezahlt", -t.prepaid, "BT-113");
  if (t.rounding) push("Rundung", t.rounding, "BT-114");
  for (const p of inv.thirdPartyPayments) {
    out.push({
      label: `Zahlung an Dritte${p.description ? `: ${p.description}` : ""}`,
      value: p.amount,
      bt: "BT-DEX-002",
    });
  }
  push(inv.kind === "creditNote" ? "Gutschriftsbetrag" : "Zahlbetrag", t.payable, "BT-115", true);
  return out;
}
