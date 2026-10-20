/**
 * Syntax-neutral invoice model.
 *
 * Every field maps to a business term (BT-xx) or business group (BG-xx) of the
 * European standard EN 16931-1. Both parsers (UBL and CII) produce this model,
 * so the UI, the PDF export and all other consumers never touch XML directly.
 *
 * Conventions:
 * - All fields are optional unless the standard makes them mandatory *and* we can
 *   always derive them. Parsers never invent values.
 * - Amounts/quantities are plain numbers (the standard allows max. 2 decimals for
 *   amounts; quantities/prices may have more – JS numbers are precise enough for display).
 * - Dates are ISO strings `YYYY-MM-DD`.
 * - Codes are kept as raw code values; human readable labels come from `codelists.ts`.
 */

export type Syntax = "UBL" | "CII";

export type DocumentKind = "invoice" | "creditNote";

/** Where the XML came from. */
export type Container = "xml" | "pdf";

export interface Identifier {
  value: string;
  /** Scheme identifier, e.g. ISO 6523 ICD ("0088" = GLN) or EAS code for electronic addresses. */
  scheme?: string;
}

export interface Address {
  /** BT-35/50/64/75 */
  line1?: string;
  /** BT-36/51/65/76 */
  line2?: string;
  /** BT-162/163/164/165 */
  line3?: string;
  /** BT-37/52/66/77 */
  city?: string;
  /** BT-38/53/67/78 */
  postcode?: string;
  /** BT-39/54/68/79 */
  region?: string;
  /** BT-40/55/69/80 – ISO 3166-1 alpha-2 */
  country?: string;
}

export interface Contact {
  /** BT-41/56 */
  name?: string;
  /** BT-42/57 */
  phone?: string;
  /** BT-43/58 */
  email?: string;
}

export interface Party {
  /** BT-27/44/59/62 */
  name?: string;
  /** BT-28/45 */
  tradingName?: string;
  /** BT-29/46/60 */
  identifiers: Identifier[];
  /** BT-30/47/61 */
  legalRegistration?: Identifier;
  /** BT-31/48/63 */
  vatId?: string;
  /** BT-32 – tax number ("Steuernummer") */
  taxRegistrationId?: string;
  /** BT-33 */
  additionalLegalInfo?: string;
  /** BT-34/49 */
  electronicAddress?: Identifier;
  address?: Address;
  contact?: Contact;
}

export interface Note {
  /** BT-21 – UNTDID 4451 */
  subjectCode?: string;
  /** BT-22 */
  text: string;
}

export interface DocumentReference {
  /** BT-25 */
  id: string;
  /** BT-26 */
  issueDate?: string;
}

export interface Period {
  /** BT-73/134 */
  start?: string;
  /** BT-74/135 */
  end?: string;
}

export interface Delivery {
  /** BT-70 */
  partyName?: string;
  /** BT-71 */
  locationId?: Identifier;
  /** BT-72 */
  date?: string;
  address?: Address;
}

export interface CreditTransfer {
  /** BT-84 – IBAN or other account id */
  accountId: string;
  /** BT-85 */
  accountName?: string;
  /** BT-86 – BIC */
  bic?: string;
}

export interface PaymentInstructions {
  /** BT-81 – UNTDID 4461 */
  meansCode?: string;
  /** BT-82 */
  meansText?: string;
  /** BT-83 – "Verwendungszweck" */
  remittanceInfo?: string;
  creditTransfers: CreditTransfer[];
  card?: {
    /** BT-87 – last digits of the primary account number */
    pan: string;
    /** BT-88 */
    holder?: string;
  };
  directDebit?: {
    /** BT-89 */
    mandateId?: string;
    /** BT-90 */
    creditorId?: string;
    /** BT-91 */
    debitedAccount?: string;
  };
}

export interface AllowanceCharge {
  /** true = charge (BG-21/BG-28), false = allowance (BG-20/BG-27) */
  isCharge: boolean;
  /** BT-92/99/136/141 */
  amount: number;
  /** BT-93/100/137/142 */
  baseAmount?: number;
  /** BT-94/101/138/143 */
  percent?: number;
  /** BT-95/102 */
  vatCategory?: string;
  /** BT-96/103 */
  vatRate?: number;
  /** BT-97/104/139/144 */
  reason?: string;
  /** BT-98/105/140/145 – UNTDID 5189 (allowances) / 7161 (charges) */
  reasonCode?: string;
}

export interface Totals {
  /** BT-106 */
  lineNet?: number;
  /** BT-107 */
  allowances?: number;
  /** BT-108 */
  charges?: number;
  /** BT-109 */
  taxExclusive?: number;
  /** BT-110 */
  tax?: number;
  /** BT-111 – VAT total in accounting currency (BT-6) */
  taxInTaxCurrency?: number;
  /** BT-112 */
  taxInclusive?: number;
  /** BT-113 */
  prepaid?: number;
  /** BT-114 */
  rounding?: number;
  /** BT-115 */
  payable?: number;
}

/** XRechnung extension BG-DEX-09 "Third party payment" (e.g. fees collected for third parties). */
export interface ThirdPartyPayment {
  /** BT-DEX-001 */
  type?: string;
  /** BT-DEX-002 */
  amount: number;
  /** BT-DEX-003 */
  description?: string;
}

export interface VatBreakdown {
  /** BT-116 */
  taxableAmount: number;
  /** BT-117 */
  taxAmount: number;
  /** BT-118 – UNTDID 5305 */
  category: string;
  /** BT-119 */
  rate?: number;
  /** BT-120 */
  exemptionReason?: string;
  /** BT-121 – VATEX code list */
  exemptionReasonCode?: string;
}

export interface Attachment {
  /** BT-122 */
  id: string;
  /** BT-123 */
  description?: string;
  /** BT-124 */
  externalUri?: string;
  /** BT-125 – base64 encoded content */
  content?: string;
  /** BT-125-1 */
  mimeType?: string;
  /** BT-125-2 */
  filename?: string;
  /** Size in bytes of the decoded content. */
  size?: number;
}

export interface ItemAttribute {
  /** BT-160 */
  name: string;
  /** BT-161 */
  value: string;
}

export interface Item {
  /** BT-153 */
  name?: string;
  /** BT-154 */
  description?: string;
  /** BT-155 */
  sellerId?: string;
  /** BT-156 */
  buyerId?: string;
  /** BT-157 */
  standardId?: Identifier;
  /** BT-158 – classification code with list id (BT-158-1) */
  classifications: Identifier[];
  /** BT-159 */
  originCountry?: string;
  /** BG-32 */
  attributes: ItemAttribute[];
}

export interface Price {
  /** BT-146 */
  net?: number;
  /** BT-147 */
  discount?: number;
  /** BT-148 */
  gross?: number;
  /** BT-149 */
  baseQuantity?: number;
  /** BT-150 */
  baseQuantityUnit?: string;
}

export interface InvoiceLine {
  /** BT-126 */
  id: string;
  /** BT-127 */
  note?: string;
  /** BT-128 */
  objectId?: Identifier;
  /** BT-129 */
  quantity?: number;
  /** BT-130 – UN/ECE Rec 20/21 */
  unit?: string;
  /** BT-131 */
  netAmount?: number;
  /** BT-132 */
  orderLineReference?: string;
  /** BT-133 */
  buyerAccountingReference?: string;
  /** BG-26 */
  period?: Period;
  allowancesCharges: AllowanceCharge[];
  price: Price;
  /** BT-151 */
  vatCategory?: string;
  /** BT-152 */
  vatRate?: number;
  item: Item;
  /** XRechnung extension: sub invoice lines (BG-DEX-01) / CII ParentLineID hierarchy. */
  subLines: InvoiceLine[];
  /** CII line status (e.g. "GROUP", "INFORMATION") or UBL sub-line marker. */
  lineStatus?: string;
}

export interface ProfileInfo {
  /** BT-24 */
  customizationId?: string;
  /** BT-23 */
  businessProcess?: string;
  /** Human-friendly name like "XRechnung 3.0" or "ZUGFeRD EN 16931". */
  name: string;
  family: "xrechnung" | "peppol" | "zugferd" | "en16931" | "unknown";
  /** Factur-X/ZUGFeRD conformance level (MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED, XRECHNUNG). */
  level?: string;
  /** XRechnung extension profile ("#conformant#…extension"). */
  isExtension?: boolean;
  /** MINIMUM / BASIC WL are not full invoices under EN 16931. */
  isEn16931Compliant: boolean;
}

export interface Invoice {
  syntax: Syntax;
  kind: DocumentKind;
  profile: ProfileInfo;

  /** BT-1 */
  number?: string;
  /** BT-2 */
  issueDate?: string;
  /** BT-3 – UNTDID 1001 */
  typeCode?: string;
  /** BT-5 */
  currency?: string;
  /** BT-6 */
  taxCurrency?: string;
  /** BT-7 */
  taxPointDate?: string;
  /** BT-8 – UNTDID 2005 */
  taxPointDateCode?: string;
  /** BT-9 */
  dueDate?: string;
  /** BT-10 – for XRechnung the Leitweg-ID */
  buyerReference?: string;
  /** BT-11 */
  projectReference?: string;
  /** BT-12 */
  contractReference?: string;
  /** BT-13 */
  orderReference?: string;
  /** BT-14 */
  salesOrderReference?: string;
  /** BT-15 */
  receivingAdviceReference?: string;
  /** BT-16 */
  despatchAdviceReference?: string;
  /** BT-17 */
  tenderReference?: string;
  /** BT-18 */
  invoicedObject?: Identifier;
  /** BT-19 */
  buyerAccountingReference?: string;
  /** BT-20 */
  paymentTerms?: string;
  /** BG-1 */
  notes: Note[];
  /** BG-3 */
  precedingInvoices: DocumentReference[];

  /** BG-4 */
  seller: Party;
  /** BG-7 */
  buyer: Party;
  /** BG-10 */
  payee?: Party;
  /** BG-11 */
  sellerTaxRepresentative?: Party;
  /** BG-13 */
  delivery?: Delivery;
  /** BG-14 */
  invoicePeriod?: Period;
  /** BG-16 */
  payment?: PaymentInstructions;
  /** BG-20 + BG-21 */
  allowancesCharges: AllowanceCharge[];
  /** BG-22 */
  totals: Totals;
  /** BG-DEX-09 (XRechnung extension) – included in the amount due (BT-115). */
  thirdPartyPayments: ThirdPartyPayment[];
  /** BG-23 */
  vatBreakdown: VatBreakdown[];
  /** BG-24 */
  attachments: Attachment[];
  /** BG-25 */
  lines: InvoiceLine[];
}

/** A loaded document: the parsed invoice plus everything we know about its origin. */
export interface LoadedDocument {
  fileName: string;
  container: Container;
  /** The raw invoice XML (extracted from the PDF for ZUGFeRD / Factur-X). */
  xml: string;
  invoice: Invoice;
  /**
   * A human readable PDF that belongs to the invoice: the ZUGFeRD/Factur-X carrier PDF
   * itself or a PDF attached to an XRechnung (BG-24). Used for the "Original" view and
   * preferred for printing/exporting when present.
   */
  originalPdf?: {
    bytes: Uint8Array;
    source: "container" | "attachment";
    name: string;
    /**
     * True for the ZUGFeRD carrier PDF and for attachments that look like the invoice
     * itself (name/description mention "Rechnung", "invoice", …). Only then the PDF is
     * the default for printing and exporting – other attachments are often just annexes.
     */
    isInvoiceImage: boolean;
  };
  /** Name of the embedded XML file inside the PDF (factur-x.xml, zugferd-invoice.xml, xrechnung.xml …). */
  embeddedXmlName?: string;
  /** Non-fatal problems found while loading (e.g. several XML attachments). */
  warnings: string[];
}
