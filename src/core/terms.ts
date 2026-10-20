/**
 * Flattens an Invoice into the semantic tree of EN 16931 business terms
 * (BG = business group, BT = business term). Used for
 *  - the "Alle Felder" view (every value with its BT number),
 *  - the appendix of the PDF export,
 *  - the oracle tests that compare us against the official KoSIT mapping.
 */
import type {
  Address,
  AllowanceCharge,
  Contact,
  Identifier,
  Invoice,
  InvoiceLine,
  Party,
  Period,
} from "./model";

export interface TermNode {
  id: string;
  value?: string;
  /** Scheme / list identifier attribute (e.g. BT-29-1). */
  scheme?: string;
  children?: TermNode[];
}

/** German labels of the EN 16931 business terms (names follow the official German translation). */
export const TERM_LABELS: Record<string, string> = {
  "BT-1": "Rechnungsnummer",
  "BT-2": "Rechnungsdatum",
  "BT-3": "Rechnungsart",
  "BT-5": "Währung",
  "BT-6": "Steuerwährung",
  "BT-7": "Steuerdatum",
  "BT-8": "Code für das Steuerdatum",
  "BT-9": "Fälligkeitsdatum",
  "BT-10": "Käuferreferenz / Leitweg-ID",
  "BT-11": "Projektreferenz",
  "BT-12": "Vertragsreferenz",
  "BT-13": "Bestellreferenz",
  "BT-14": "Auftragsreferenz",
  "BT-15": "Wareneingangsmeldung",
  "BT-16": "Versandanzeige",
  "BT-17": "Ausschreibung / Los",
  "BT-18": "Objektkennung",
  "BT-19": "Buchungsreferenz des Käufers",
  "BT-20": "Zahlungsbedingungen",
  "BG-1": "Bemerkung zur Rechnung",
  "BT-21": "Betreff-Code",
  "BT-22": "Bemerkung",
  "BG-2": "Prozesssteuerung",
  "BT-23": "Geschäftsprozess",
  "BT-24": "Spezifikationskennung",
  "BG-3": "Vorausgegangene Rechnung",
  "BT-25": "Nummer der vorausgegangenen Rechnung",
  "BT-26": "Datum der vorausgegangenen Rechnung",
  "BG-4": "Verkäufer",
  "BT-27": "Name",
  "BT-28": "Handelsname",
  "BT-29": "Kennung",
  "BT-30": "Registernummer",
  "BT-31": "Umsatzsteuer-ID",
  "BT-32": "Steuernummer",
  "BT-33": "Weitere rechtliche Informationen",
  "BT-34": "Elektronische Adresse",
  "BG-5": "Anschrift",
  "BT-35": "Straße",
  "BT-36": "Adresszusatz",
  "BT-162": "Adresszeile 3",
  "BT-37": "Ort",
  "BT-38": "Postleitzahl",
  "BT-39": "Region",
  "BT-40": "Land",
  "BG-6": "Kontakt",
  "BT-41": "Ansprechpartner",
  "BT-42": "Telefon",
  "BT-43": "E-Mail",
  "BG-7": "Käufer",
  "BT-44": "Name",
  "BT-45": "Handelsname",
  "BT-46": "Kennung",
  "BT-47": "Registernummer",
  "BT-48": "Umsatzsteuer-ID",
  "BT-49": "Elektronische Adresse",
  "BG-8": "Anschrift",
  "BT-50": "Straße",
  "BT-51": "Adresszusatz",
  "BT-163": "Adresszeile 3",
  "BT-52": "Ort",
  "BT-53": "Postleitzahl",
  "BT-54": "Region",
  "BT-55": "Land",
  "BG-9": "Kontakt",
  "BT-56": "Ansprechpartner",
  "BT-57": "Telefon",
  "BT-58": "E-Mail",
  "BG-10": "Zahlungsempfänger",
  "BT-59": "Name",
  "BT-60": "Kennung",
  "BT-61": "Registernummer",
  "BG-11": "Steuervertreter des Verkäufers",
  "BT-62": "Name",
  "BT-63": "Umsatzsteuer-ID",
  "BG-12": "Anschrift",
  "BT-64": "Straße",
  "BT-65": "Adresszusatz",
  "BT-164": "Adresszeile 3",
  "BT-66": "Ort",
  "BT-67": "Postleitzahl",
  "BT-68": "Region",
  "BT-69": "Land",
  "BG-13": "Lieferung",
  "BT-70": "Name des Empfängers",
  "BT-71": "Kennung des Lieferorts",
  "BT-72": "Liefer-/Leistungsdatum",
  "BG-14": "Abrechnungszeitraum",
  "BT-73": "Beginn",
  "BT-74": "Ende",
  "BG-15": "Lieferanschrift",
  "BT-75": "Straße",
  "BT-76": "Adresszusatz",
  "BT-165": "Adresszeile 3",
  "BT-77": "Ort",
  "BT-78": "Postleitzahl",
  "BT-79": "Region",
  "BT-80": "Land",
  "BG-16": "Zahlungsanweisungen",
  "BT-81": "Zahlungsart",
  "BT-82": "Zahlungsart (Text)",
  "BT-83": "Verwendungszweck",
  "BG-17": "Überweisung",
  "BT-84": "IBAN / Kontokennung",
  "BT-85": "Kontoinhaber",
  "BT-86": "BIC",
  "BG-18": "Zahlungskarte",
  "BT-87": "Kartennummer",
  "BT-88": "Karteninhaber",
  "BG-19": "Lastschrift",
  "BT-89": "Mandatsreferenz",
  "BT-90": "Gläubiger-ID",
  "BT-91": "Belastetes Konto",
  "BG-20": "Nachlass",
  "BT-92": "Betrag",
  "BT-93": "Grundbetrag",
  "BT-94": "Prozentsatz",
  "BT-95": "Umsatzsteuerkategorie",
  "BT-96": "Umsatzsteuersatz",
  "BT-97": "Grund",
  "BT-98": "Grund (Code)",
  "BG-21": "Zuschlag",
  "BT-99": "Betrag",
  "BT-100": "Grundbetrag",
  "BT-101": "Prozentsatz",
  "BT-102": "Umsatzsteuerkategorie",
  "BT-103": "Umsatzsteuersatz",
  "BT-104": "Grund",
  "BT-105": "Grund (Code)",
  "BG-22": "Gesamtbeträge",
  "BT-106": "Summe Positionen netto",
  "BT-107": "Summe Nachlässe",
  "BT-108": "Summe Zuschläge",
  "BT-109": "Gesamtbetrag netto",
  "BT-110": "Umsatzsteuer gesamt",
  "BT-111": "Umsatzsteuer in Steuerwährung",
  "BT-112": "Gesamtbetrag brutto",
  "BT-113": "Bereits gezahlt",
  "BT-114": "Rundungsbetrag",
  "BT-115": "Zahlbetrag",
  "BG-23": "Umsatzsteueraufschlüsselung",
  "BT-116": "Steuerbemessungsgrundlage",
  "BT-117": "Steuerbetrag",
  "BT-118": "Umsatzsteuerkategorie",
  "BT-119": "Umsatzsteuersatz",
  "BT-120": "Befreiungsgrund",
  "BT-121": "Befreiungsgrund (Code)",
  "BG-24": "Rechnungsbegründende Unterlage",
  "BT-122": "Kennung",
  "BT-123": "Beschreibung",
  "BT-124": "Externer Ort",
  "BT-125": "Angehängtes Dokument",
  "BG-25": "Rechnungsposition",
  "BT-126": "Positionsnummer",
  "BT-127": "Bemerkung",
  "BT-128": "Objektkennung",
  "BT-129": "Menge",
  "BT-130": "Einheit",
  "BT-131": "Nettobetrag",
  "BT-132": "Referenz Bestellposition",
  "BT-133": "Buchungsreferenz des Käufers",
  "BG-26": "Leistungszeitraum",
  "BT-134": "Beginn",
  "BT-135": "Ende",
  "BG-27": "Nachlass auf Positionsebene",
  "BT-136": "Betrag",
  "BT-137": "Grundbetrag",
  "BT-138": "Prozentsatz",
  "BT-139": "Grund",
  "BT-140": "Grund (Code)",
  "BG-28": "Zuschlag auf Positionsebene",
  "BT-141": "Betrag",
  "BT-142": "Grundbetrag",
  "BT-143": "Prozentsatz",
  "BT-144": "Grund",
  "BT-145": "Grund (Code)",
  "BG-29": "Preis",
  "BT-146": "Nettopreis",
  "BT-147": "Rabatt auf den Preis",
  "BT-148": "Bruttopreis",
  "BT-149": "Basismenge",
  "BT-150": "Einheit der Basismenge",
  "BG-30": "Umsatzsteuer der Position",
  "BT-151": "Umsatzsteuerkategorie",
  "BT-152": "Umsatzsteuersatz",
  "BG-31": "Artikel",
  "BT-153": "Name",
  "BT-154": "Beschreibung",
  "BT-155": "Artikelnummer des Verkäufers",
  "BT-156": "Artikelnummer des Käufers",
  "BT-157": "Standard-Artikelkennung",
  "BT-158": "Klassifikation",
  "BT-159": "Herkunftsland",
  "BG-32": "Artikeleigenschaft",
  "BT-160": "Name",
  "BT-161": "Wert",
  "BG-DEX-01": "Unterposition",
  "BG-DEX-09": "Zahlung an Dritte",
  "BT-DEX-001": "Art",
  "BT-DEX-002": "Betrag",
  "BT-DEX-003": "Beschreibung",
};

export function termLabel(id: string): string {
  return TERM_LABELS[id] ?? id;
}

const str = (v: string | number | undefined): string | undefined =>
  v === undefined || v === "" ? undefined : String(v);

function t(id: string, value: string | number | undefined, scheme?: string): TermNode | undefined {
  const s = str(value);
  return s === undefined ? undefined : { id, value: s, scheme };
}

function tid(id: string, ident: Identifier | undefined): TermNode | undefined {
  return ident ? t(id, ident.value, ident.scheme) : undefined;
}

function g(id: string, children: Array<TermNode | undefined>): TermNode | undefined {
  const c = children.filter((n): n is TermNode => !!n);
  return c.length ? { id, children: c } : undefined;
}

function addr(id: string, ids: string[], a: Address | undefined) {
  if (!a) return undefined;
  const [l1, l2, l3, city, pc, region, country] = ids;
  return g(id, [
    t(l1!, a.line1),
    t(l2!, a.line2),
    t(l3!, a.line3),
    t(city!, a.city),
    t(pc!, a.postcode),
    t(region!, a.region),
    t(country!, a.country),
  ]);
}

function contact(id: string, ids: string[], c: Contact | undefined) {
  if (!c) return undefined;
  return g(id, [t(ids[0]!, c.name), t(ids[1]!, c.phone), t(ids[2]!, c.email)]);
}

function period(id: string, start: string, end: string, p: Period | undefined) {
  return p ? g(id, [t(start, p.start), t(end, p.end)]) : undefined;
}

function sellerNode(p: Party) {
  return g("BG-4", [
    t("BT-27", p.name),
    t("BT-28", p.tradingName),
    ...p.identifiers.map((i) => tid("BT-29", i)),
    tid("BT-30", p.legalRegistration),
    t("BT-31", p.vatId),
    t("BT-32", p.taxRegistrationId),
    t("BT-33", p.additionalLegalInfo),
    tid("BT-34", p.electronicAddress),
    addr("BG-5", ["BT-35", "BT-36", "BT-162", "BT-37", "BT-38", "BT-39", "BT-40"], p.address),
    contact("BG-6", ["BT-41", "BT-42", "BT-43"], p.contact),
  ]);
}

function buyerNode(p: Party) {
  return g("BG-7", [
    t("BT-44", p.name),
    t("BT-45", p.tradingName),
    ...p.identifiers.map((i) => tid("BT-46", i)),
    tid("BT-47", p.legalRegistration),
    t("BT-48", p.vatId),
    tid("BT-49", p.electronicAddress),
    addr("BG-8", ["BT-50", "BT-51", "BT-163", "BT-52", "BT-53", "BT-54", "BT-55"], p.address),
    contact("BG-9", ["BT-56", "BT-57", "BT-58"], p.contact),
  ]);
}

const AC_IDS = {
  docAllowance: ["BG-20", "BT-92", "BT-93", "BT-94", "BT-95", "BT-96", "BT-97", "BT-98"],
  docCharge: ["BG-21", "BT-99", "BT-100", "BT-101", "BT-102", "BT-103", "BT-104", "BT-105"],
  lineAllowance: ["BG-27", "BT-136", "BT-137", "BT-138", "", "", "BT-139", "BT-140"],
  lineCharge: ["BG-28", "BT-141", "BT-142", "BT-143", "", "", "BT-144", "BT-145"],
} as const;

function acNode(ac: AllowanceCharge, level: "doc" | "line") {
  const ids =
    level === "doc"
      ? ac.isCharge
        ? AC_IDS.docCharge
        : AC_IDS.docAllowance
      : ac.isCharge
        ? AC_IDS.lineCharge
        : AC_IDS.lineAllowance;
  return g(ids[0], [
    t(ids[1], ac.amount),
    t(ids[2], ac.baseAmount),
    t(ids[3], ac.percent),
    ids[4] ? t(ids[4], ac.vatCategory) : undefined,
    ids[5] ? t(ids[5], ac.vatRate) : undefined,
    t(ids[6], ac.reason),
    t(ids[7], ac.reasonCode),
  ]);
}

function lineNode(l: InvoiceLine, groupId = "BG-25"): TermNode | undefined {
  return g(groupId, [
    t("BT-126", l.id),
    t("BT-127", l.note),
    tid("BT-128", l.objectId),
    t("BT-129", l.quantity),
    t("BT-130", l.unit),
    t("BT-131", l.netAmount),
    t("BT-132", l.orderLineReference),
    t("BT-133", l.buyerAccountingReference),
    period("BG-26", "BT-134", "BT-135", l.period),
    ...l.allowancesCharges.map((ac) => acNode(ac, "line")),
    g("BG-29", [
      t("BT-146", l.price.net),
      t("BT-147", l.price.discount),
      t("BT-148", l.price.gross),
      t("BT-149", l.price.baseQuantity),
      t("BT-150", l.price.baseQuantityUnit),
    ]),
    g("BG-30", [t("BT-151", l.vatCategory), t("BT-152", l.vatRate)]),
    g("BG-31", [
      t("BT-153", l.item.name),
      t("BT-154", l.item.description),
      t("BT-155", l.item.sellerId),
      t("BT-156", l.item.buyerId),
      tid("BT-157", l.item.standardId),
      ...l.item.classifications.map((c) => tid("BT-158", c)),
      t("BT-159", l.item.originCountry),
      ...l.item.attributes.map((a) => g("BG-32", [t("BT-160", a.name), t("BT-161", a.value)])),
    ]),
    ...l.subLines.map((s) => lineNode(s, "BG-DEX-01")),
  ]);
}

export function invoiceTerms(inv: Invoice): TermNode[] {
  const pay = inv.payment;
  const nodes: Array<TermNode | undefined> = [
    t("BT-1", inv.number),
    t("BT-2", inv.issueDate),
    t("BT-3", inv.typeCode),
    t("BT-5", inv.currency),
    t("BT-6", inv.taxCurrency),
    t("BT-7", inv.taxPointDate),
    t("BT-8", inv.taxPointDateCode),
    t("BT-9", inv.dueDate),
    t("BT-10", inv.buyerReference),
    t("BT-11", inv.projectReference),
    t("BT-12", inv.contractReference),
    t("BT-13", inv.orderReference),
    t("BT-14", inv.salesOrderReference),
    t("BT-15", inv.receivingAdviceReference),
    t("BT-16", inv.despatchAdviceReference),
    t("BT-17", inv.tenderReference),
    tid("BT-18", inv.invoicedObject),
    t("BT-19", inv.buyerAccountingReference),
    t("BT-20", inv.paymentTerms),
    ...inv.notes.map((n) => g("BG-1", [t("BT-21", n.subjectCode), t("BT-22", n.text)])),
    g("BG-2", [t("BT-23", inv.profile.businessProcess), t("BT-24", inv.profile.customizationId)]),
    ...inv.precedingInvoices.map((p) => g("BG-3", [t("BT-25", p.id), t("BT-26", p.issueDate)])),
    sellerNode(inv.seller),
    buyerNode(inv.buyer),
    inv.payee
      ? g("BG-10", [
          t("BT-59", inv.payee.name),
          ...inv.payee.identifiers.map((i) => tid("BT-60", i)),
          tid("BT-61", inv.payee.legalRegistration),
        ])
      : undefined,
    inv.sellerTaxRepresentative
      ? g("BG-11", [
          t("BT-62", inv.sellerTaxRepresentative.name),
          t("BT-63", inv.sellerTaxRepresentative.vatId),
          addr(
            "BG-12",
            ["BT-64", "BT-65", "BT-164", "BT-66", "BT-67", "BT-68", "BT-69"],
            inv.sellerTaxRepresentative.address,
          ),
        ])
      : undefined,
    inv.delivery
      ? g("BG-13", [
          t("BT-70", inv.delivery.partyName),
          tid("BT-71", inv.delivery.locationId),
          t("BT-72", inv.delivery.date),
          addr(
            "BG-15",
            ["BT-75", "BT-76", "BT-165", "BT-77", "BT-78", "BT-79", "BT-80"],
            inv.delivery.address,
          ),
        ])
      : undefined,
    period("BG-14", "BT-73", "BT-74", inv.invoicePeriod),
    pay
      ? g("BG-16", [
          t("BT-81", pay.meansCode),
          t("BT-82", pay.meansText),
          t("BT-83", pay.remittanceInfo),
          ...pay.creditTransfers.map((c) =>
            g("BG-17", [t("BT-84", c.accountId), t("BT-85", c.accountName), t("BT-86", c.bic)]),
          ),
          pay.card ? g("BG-18", [t("BT-87", pay.card.pan), t("BT-88", pay.card.holder)]) : undefined,
          pay.directDebit
            ? g("BG-19", [
                t("BT-89", pay.directDebit.mandateId),
                t("BT-90", pay.directDebit.creditorId),
                t("BT-91", pay.directDebit.debitedAccount),
              ])
            : undefined,
        ])
      : undefined,
    ...inv.allowancesCharges.filter((a) => !a.isCharge).map((ac) => acNode(ac, "doc")),
    ...inv.allowancesCharges.filter((a) => a.isCharge).map((ac) => acNode(ac, "doc")),
    g("BG-22", [
      t("BT-106", inv.totals.lineNet),
      t("BT-107", inv.totals.allowances),
      t("BT-108", inv.totals.charges),
      t("BT-109", inv.totals.taxExclusive),
      t("BT-110", inv.totals.tax),
      t("BT-111", inv.totals.taxInTaxCurrency),
      t("BT-112", inv.totals.taxInclusive),
      t("BT-113", inv.totals.prepaid),
      t("BT-114", inv.totals.rounding),
      t("BT-115", inv.totals.payable),
    ]),
    ...inv.thirdPartyPayments.map((p) =>
      g("BG-DEX-09", [t("BT-DEX-001", p.type), t("BT-DEX-002", p.amount), t("BT-DEX-003", p.description)]),
    ),
    ...inv.vatBreakdown.map((v) =>
      g("BG-23", [
        t("BT-116", v.taxableAmount),
        t("BT-117", v.taxAmount),
        t("BT-118", v.category),
        t("BT-119", v.rate),
        t("BT-120", v.exemptionReason),
        t("BT-121", v.exemptionReasonCode),
      ]),
    ),
    ...inv.attachments.map((a) =>
      g("BG-24", [
        t("BT-122", a.id),
        t("BT-123", a.description),
        t("BT-124", a.externalUri),
        a.content ? t("BT-125", a.filename ?? "(eingebettet)", a.mimeType) : undefined,
      ]),
    ),
    ...inv.lines.map((l) => lineNode(l)),
  ];
  return nodes.filter((n): n is TermNode => !!n);
}

/** Depth-first list of all leaf terms – handy for tests and search. */
export function flattenTerms(nodes: TermNode[], path: string[] = []): Array<TermNode & { path: string[] }> {
  return nodes.flatMap((n) => (n.children ? flattenTerms(n.children, [...path, n.id]) : [{ ...n, path }]));
}
