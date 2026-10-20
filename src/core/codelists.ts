/**
 * German labels for the code lists used by EN 16931.
 *
 * Rule: the UI always shows the raw code next to the label (see `codeLabel`), so a
 * missing or imprecise translation can never hide the actual value of the invoice.
 * Unknown codes are shown as-is.
 */

/** UNTDID 1001 – document type (BT-3), subset allowed by EN 16931 / XRechnung. */
export const INVOICE_TYPES: Record<string, string> = {
  "71": "Zahlungsanforderung",
  "80": "Belastungsanzeige (Waren)",
  "82": "Rechnung für Messdienstleistungen",
  "84": "Belastungsanzeige (Finanzkorrektur)",
  "102": "Steuerbescheid",
  "218": "Schlusszahlungsanforderung",
  "219": "Zahlungsanforderung für erbrachte Leistungen",
  "261": "Selbst ausgestellte Gutschrift",
  "262": "Sammelgutschrift",
  "295": "Preisanpassungsrechnung",
  "296": "Gutschrift für Preisanpassung",
  "308": "Delkredere-Gutschrift",
  "325": "Proforma-Rechnung",
  "326": "Teilrechnung",
  "331": "Handelsrechnung mit Packliste",
  "380": "Rechnung",
  "381": "Gutschrift",
  "382": "Provisionsabrechnung",
  "383": "Belastungsanzeige",
  "384": "Rechnungskorrektur",
  "385": "Sammelrechnung",
  "386": "Vorauszahlungsrechnung",
  "387": "Mietrechnung",
  "388": "Steuerrechnung",
  "389": "Selbst ausgestellte Rechnung (Gutschriftverfahren)",
  "390": "Delkredere-Rechnung",
  "393": "Factoring-Rechnung",
  "394": "Leasingrechnung",
  "395": "Konsignationsrechnung",
  "396": "Factoring-Gutschrift",
  "420": "Gutschrift (OCR)",
  "456": "Belastungsanzeige",
  "457": "Storno einer Belastung",
  "458": "Erstattungsgutschrift",
  "527": "Selbst ausgestellte Belastungsanzeige",
  "532": "Spediteursgutschrift",
  "553": "Spediteursrechnung – Abweichungsbericht",
  "575": "Versicherungsrechnung",
  "623": "Spediteursrechnung",
  "633": "Hafengebührenrechnung",
  "751": "Rechnungsinformation für Buchhaltungszwecke",
  "780": "Frachtrechnung",
  "817": "Schadensmeldung",
  "870": "Konsulatsrechnung",
  "875": "Abschlagsrechnung (Bauleistung)",
  "876": "Teilschlussrechnung (Bauleistung)",
  "877": "Schlussrechnung (Bauleistung)",
  "935": "Zollrechnung",
};

/** UNTDID 4461 – payment means (BT-81). */
export const PAYMENT_MEANS: Record<string, string> = {
  "1": "Nicht definiert",
  "10": "Barzahlung",
  "20": "Scheck",
  "30": "Überweisung",
  "31": "Belastung (Debit Transfer)",
  "42": "Zahlung auf Bankkonto",
  "48": "Bankkarte",
  "49": "Lastschrift",
  "54": "Kreditkarte",
  "55": "Debitkarte",
  "57": "Dauerauftrag",
  "58": "SEPA-Überweisung",
  "59": "SEPA-Lastschrift",
  "68": "Online-Zahlungsdienst",
  "97": "Verrechnung",
  ZZZ: "Sonstige (vereinbart)",
};

/** UNTDID 5305 – VAT category (BT-95, BT-102, BT-118, BT-151). */
export const VAT_CATEGORIES: Record<string, string> = {
  S: "Umsatzsteuer (Regelsatz/ermäßigt)",
  Z: "Nullsatz",
  E: "Steuerbefreit",
  AE: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)",
  K: "Innergemeinschaftliche Lieferung",
  G: "Ausfuhr (steuerfrei)",
  O: "Nicht steuerbar",
  L: "Kanarische Inseln (IGIC)",
  M: "Ceuta und Melilla (IPSI)",
  B: "Übertragene Umsatzsteuer (Italien)",
};

/** Short VAT category names for tight table columns. */
export const VAT_CATEGORIES_SHORT: Record<string, string> = {
  S: "USt",
  Z: "Nullsatz",
  E: "befreit",
  AE: "Reverse Charge",
  K: "innergem. Lief.",
  G: "Ausfuhr",
  O: "nicht steuerbar",
  L: "IGIC",
  M: "IPSI",
  B: "übertragen",
};

/** UNTDID 2005 – tax point date code (BT-8). */
export const TAX_POINT_DATE_CODES: Record<string, string> = {
  "3": "Rechnungsdatum",
  "35": "Liefer-/Leistungsdatum",
  "432": "Zahlungsdatum",
};

/** UNTDID 4451 – text subject qualifier (BT-21), commonly used codes. */
export const NOTE_SUBJECTS: Record<string, string> = {
  AAB: "Zahlungsbedingungen",
  AAC: "Gefahrgut-Zusatzinformationen",
  AAI: "Allgemeine Informationen",
  AAK: "Preiskonditionen",
  ADU: "Hinweis",
  PMD: "Zahlungsinformationen",
  PMT: "Zahlungsinformationen",
  REG: "Regulatorische Informationen",
  SUR: "Anmerkungen des Lieferanten",
  TXD: "Steuerliche Angaben",
};

/** UNTDID 5189 – allowance reason codes (BT-98, BT-140). */
export const ALLOWANCE_REASONS: Record<string, string> = {
  "41": "Bonus für vorzeitige Fertigstellung",
  "42": "Sonstiger Bonus",
  "60": "Herstellerrabatt für Verbraucher",
  "62": "Rabatt wegen Militärstatus",
  "63": "Rabatt wegen Arbeitsunfall",
  "64": "Sondervereinbarung",
  "65": "Rabatt wegen Produktionsfehler",
  "66": "Rabatt für neue Verkaufsstelle",
  "67": "Musterrabatt",
  "68": "Auslaufrabatt",
  "70": "Incoterm-Rabatt",
  "71": "Rabatt bei Erreichen einer Verkaufsschwelle",
  "88": "Materialzuschlag/-abzug",
  "95": "Rabatt",
  "100": "Sonderrabatt",
  "102": "Langfristiger Festrabatt",
  "103": "Befristeter Rabatt",
  "104": "Standardrabatt",
  "105": "Jahresumsatzrabatt",
};

/** UNTDID 7161 – charge reason codes (BT-105, BT-145), common subset. */
export const CHARGE_REASONS: Record<string, string> = {
  AA: "Werbung",
  AAA: "Telekommunikation",
  ABL: "Zusätzliche Verpackung",
  ADR: "Sonstige Dienstleistungen",
  ADT: "Abholung",
  FC: "Frachtkosten",
  FI: "Finanzierung",
  LA: "Etikettierung",
  PC: "Verpackung",
  ZZZ: "Sonstiges (vereinbart)",
};

/** UN/ECE Recommendation 20/21 – units of measure (BT-130, BT-150), common subset. */
export const UNITS: Record<string, string> = {
  C62: "Stück",
  H87: "Stück",
  EA: "Stück",
  XPP: "Stück",
  NAR: "Anzahl Artikel",
  NPR: "Anzahl Paare",
  PR: "Paar",
  SET: "Satz",
  LS: "Pauschale",
  E48: "Serviceeinheit",
  P1: "Prozent",
  SEC: "Sekunde",
  MIN: "Minute",
  HUR: "Stunde",
  DAY: "Tag",
  WEE: "Woche",
  MON: "Monat",
  QAN: "Quartal",
  ANN: "Jahr",
  GRM: "Gramm",
  KGM: "Kilogramm",
  TNE: "Tonne",
  MMT: "Millimeter",
  CMT: "Zentimeter",
  MTR: "Meter",
  KMT: "Kilometer",
  MTK: "Quadratmeter",
  MTQ: "Kubikmeter",
  MLT: "Milliliter",
  LTR: "Liter",
  KWH: "Kilowattstunde",
  MWH: "Megawattstunde",
  KWT: "Kilowatt",
  TKM: "Tonnenkilometer",
  XBX: "Box",
  XCT: "Karton",
  XPK: "Packung",
  XPA: "Päckchen",
  XBO: "Flasche",
  XBG: "Beutel",
  XSA: "Sack",
  XCR: "Kiste",
  XPX: "Palette",
  XRO: "Rolle",
  XST: "Blatt",
  XTU: "Tube",
  XCA: "Dose",
};

/** Short unit symbols for narrow table columns (falls back to UNITS / the code). */
export const UNITS_SHORT: Record<string, string> = {
  C62: "Stk",
  H87: "Stk",
  EA: "Stk",
  XPP: "Stk",
  HUR: "Std",
  MIN: "Min",
  SEC: "s",
  DAY: "Tag",
  WEE: "Woche",
  MON: "Monat",
  ANN: "Jahr",
  KWH: "kWh",
  MWH: "MWh",
  KWT: "kW",
  MTQ: "m³",
  MTK: "m²",
  MTR: "m",
  KMT: "km",
  CMT: "cm",
  MMT: "mm",
  KGM: "kg",
  GRM: "g",
  TNE: "t",
  LTR: "l",
  MLT: "ml",
  LS: "pauschal",
  P1: "%",
  SET: "Satz",
  PR: "Paar",
};

/** Electronic address scheme (EAS, BT-34-1/BT-49-1) and ICD identifiers, common subset. */
export const ID_SCHEMES: Record<string, string> = {
  EM: "E-Mail",
  "0002": "SIRENE",
  "0007": "Organisationsnummer (SE)",
  "0009": "SIRET",
  "0060": "DUNS",
  "0088": "GLN",
  "0096": "DANISH CVR",
  "0106": "KvK (NL)",
  "0130": "EU-Verzeichnis",
  "0184": "CVR (DK)",
  "0192": "Organisasjonsnummer (NO)",
  "0198": "ERSTORG (DK)",
  "0204": "Leitweg-ID",
  "0208": "Unternehmensnummer (BE)",
  "0209": "GS1",
  "9930": "USt-IdNr. (DE)",
  SEPA: "SEPA-Gläubiger-ID",
};

/** VATEX – VAT exemption reason codes (BT-121), common subset. */
export const VATEX: Record<string, string> = {
  "VATEX-EU-AE": "Steuerschuldnerschaft des Leistungsempfängers",
  "VATEX-EU-IC": "Innergemeinschaftliche Lieferung",
  "VATEX-EU-G": "Ausfuhr aus der EU",
  "VATEX-EU-O": "Nicht steuerbar",
  "VATEX-EU-D": "Differenzbesteuerung – Reisebüros",
  "VATEX-EU-F": "Differenzbesteuerung – Gebrauchtgegenstände",
  "VATEX-EU-I": "Differenzbesteuerung – Kunstgegenstände",
  "VATEX-EU-J": "Differenzbesteuerung – Sammlungsstücke und Antiquitäten",
  "VATEX-EU-79-C": "Befreit nach Art. 79 Buchst. c MwStSystRL",
  "VATEX-EU-132": "Befreit nach Art. 132 MwStSystRL",
  "VATEX-EU-143": "Befreit nach Art. 143 MwStSystRL",
  "VATEX-EU-148": "Befreit nach Art. 148 MwStSystRL",
  "VATEX-EU-151": "Befreit nach Art. 151 MwStSystRL",
  "VATEX-EU-309": "Befreit nach Art. 309 MwStSystRL",
  "VATEX-FR-FRANCHISE": "Franchise en base (FR)",
  "VATEX-FR-CNWVAT": "Nicht der USt unterliegend (FR)",
};

export function label(list: Record<string, string>, code: string | undefined): string | undefined {
  if (!code) return undefined;
  return list[code] ?? list[code.toUpperCase()];
}

/** "Label (Code)" or just the code if unknown. */
export function codeLabel(list: Record<string, string>, code: string | undefined): string | undefined {
  if (!code) return undefined;
  const l = label(list, code);
  return l ? `${l} (${code})` : code;
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["de"], { type: "region" });
  } catch {
    return undefined;
  }
})();

export function countryName(code: string | undefined): string | undefined {
  if (!code) return undefined;
  try {
    const name = regionNames?.of(code.toUpperCase());
    return name && name !== code.toUpperCase() ? name : code;
  } catch {
    return code;
  }
}
