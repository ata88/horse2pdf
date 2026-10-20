/**
 * UBL 2.1 (OASIS) → Invoice model, following the EN 16931-3-2 syntax binding.
 * Handles Invoice and CreditNote documents including the XRechnung sub-line extension.
 */
import type {
  Address,
  AllowanceCharge,
  Attachment,
  Container,
  Contact,
  Identifier,
  Invoice,
  InvoiceLine,
  Note,
  Party,
  PaymentInstructions,
  VatBreakdown,
} from "../model";
import { detectProfile } from "../profile";
import { base64Size, compact, isTrue, toIsoDate, XPathLite } from "../xml";

export const UBL_NS = {
  inv: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cn: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
};

const x = new XPathLite(UBL_NS);

function id(el: Element | undefined, path: string): Identifier | undefined {
  const e = x.one(el, path);
  const value = x.text(e);
  if (!value) return undefined;
  return { value, scheme: x.attr(e, undefined, "schemeID") };
}

function ids(el: Element | undefined, path: string): Identifier[] {
  return x
    .all(el, path)
    .map((e) => ({ value: x.text(e) ?? "", scheme: x.attr(e, undefined, "schemeID") }))
    .filter((i) => i.value);
}

export function splitNote(raw: string): Note {
  const m = /^#([A-Z0-9]{3})#([\s\S]*)$/.exec(raw);
  return m ? { subjectCode: m[1], text: m[2]!.trim() } : { text: raw };
}

function address(el: Element | undefined): Address | undefined {
  if (!el) return undefined;
  return compact<Address>({
    line1: x.text(el, "cbc:StreetName"),
    line2: x.text(el, "cbc:AdditionalStreetName"),
    line3: x.text(el, "cac:AddressLine/cbc:Line"),
    city: x.text(el, "cbc:CityName"),
    postcode: x.text(el, "cbc:PostalZone"),
    region: x.text(el, "cbc:CountrySubentity"),
    country: x.text(el, "cac:Country/cbc:IdentificationCode"),
  });
}

function contact(el: Element | undefined): Contact | undefined {
  if (!el) return undefined;
  return compact<Contact>({
    name: x.text(el, "cbc:Name"),
    phone: x.text(el, "cbc:Telephone"),
    email: x.text(el, "cbc:ElectronicMail"),
  });
}

function party(p: Element | undefined): Party {
  const taxSchemes = x.all(p, "cac:PartyTaxScheme");
  const vat = taxSchemes.find((t) => x.text(t, "cac:TaxScheme/cbc:ID")?.toUpperCase() === "VAT");
  const other = taxSchemes.find((t) => x.text(t, "cac:TaxScheme/cbc:ID")?.toUpperCase() !== "VAT");
  return {
    name: x.text(p, "cac:PartyLegalEntity/cbc:RegistrationName") ?? x.text(p, "cac:PartyName/cbc:Name"),
    tradingName: x.text(p, "cac:PartyLegalEntity/cbc:RegistrationName")
      ? x.text(p, "cac:PartyName/cbc:Name")
      : undefined,
    identifiers: ids(p, "cac:PartyIdentification/cbc:ID").filter((i) => i.scheme?.toUpperCase() !== "SEPA"),
    legalRegistration: id(p, "cac:PartyLegalEntity/cbc:CompanyID"),
    vatId: x.text(vat, "cbc:CompanyID"),
    taxRegistrationId: x.text(other, "cbc:CompanyID"),
    additionalLegalInfo: x.text(p, "cac:PartyLegalEntity/cbc:CompanyLegalForm"),
    electronicAddress: id(p, "cbc:EndpointID"),
    address: address(x.one(p, "cac:PostalAddress")),
    contact: contact(x.one(p, "cac:Contact")),
  };
}

function allowanceCharge(el: Element): AllowanceCharge {
  return {
    isCharge: isTrue(x.text(el, "cbc:ChargeIndicator")),
    amount: x.num(el, "cbc:Amount") ?? 0,
    baseAmount: x.num(el, "cbc:BaseAmount"),
    percent: x.num(el, "cbc:MultiplierFactorNumeric"),
    vatCategory: x.text(el, "cac:TaxCategory/cbc:ID"),
    vatRate: x.num(el, "cac:TaxCategory/cbc:Percent"),
    reason: x.text(el, "cbc:AllowanceChargeReason"),
    reasonCode: x.text(el, "cbc:AllowanceChargeReasonCode"),
  };
}

function docRefType(el: Element): string | undefined {
  return x.text(el, "cbc:DocumentTypeCode");
}

function line(el: Element, isCredit: boolean): InvoiceLine {
  const qty = x.one(el, isCredit ? "cbc:CreditedQuantity" : "cbc:InvoicedQuantity");
  const priceEl = x.one(el, "cac:Price");
  const priceAc = x.one(priceEl, "cac:AllowanceCharge");
  const baseQty = x.one(priceEl, "cbc:BaseQuantity");
  const item = x.one(el, "cac:Item");
  const subLines = [
    ...x.all(el, "cac:SubInvoiceLine").map((s) => line(s, false)),
    ...x.all(el, "cac:SubCreditNoteLine").map((s) => line(s, true)),
  ];
  return {
    id: x.text(el, "cbc:ID") ?? "",
    note: x.texts(el, "cbc:Note").join("\n") || undefined,
    objectId: x
      .all(el, "cac:DocumentReference")
      .filter((d) => docRefType(d) === "130")
      .map((d) => id(d, "cbc:ID"))[0],
    quantity: x.num(qty),
    unit: x.attr(qty, undefined, "unitCode"),
    netAmount: x.num(el, "cbc:LineExtensionAmount"),
    orderLineReference: x.text(el, "cac:OrderLineReference/cbc:LineID"),
    buyerAccountingReference: x.text(el, "cbc:AccountingCost"),
    period: compact({
      start: toIsoDate(x.text(el, "cac:InvoicePeriod/cbc:StartDate")),
      end: toIsoDate(x.text(el, "cac:InvoicePeriod/cbc:EndDate")),
    }),
    allowancesCharges: x.all(el, "cac:AllowanceCharge").map(allowanceCharge),
    price: {
      net: x.num(priceEl, "cbc:PriceAmount"),
      discount: x.num(priceAc, "cbc:Amount"),
      gross: x.num(priceAc, "cbc:BaseAmount"),
      baseQuantity: x.num(baseQty),
      baseQuantityUnit: x.attr(baseQty, undefined, "unitCode"),
    },
    vatCategory: x.text(item, "cac:ClassifiedTaxCategory/cbc:ID"),
    vatRate: x.num(item, "cac:ClassifiedTaxCategory/cbc:Percent"),
    item: {
      name: x.text(item, "cbc:Name"),
      description: x.text(item, "cbc:Description"),
      sellerId: x.text(item, "cac:SellersItemIdentification/cbc:ID"),
      buyerId: x.text(item, "cac:BuyersItemIdentification/cbc:ID"),
      standardId: id(item, "cac:StandardItemIdentification/cbc:ID"),
      classifications: x
        .all(item, "cac:CommodityClassification/cbc:ItemClassificationCode")
        .map((c) => ({ value: x.text(c) ?? "", scheme: x.attr(c, undefined, "listID") }))
        .filter((c) => c.value),
      originCountry: x.text(item, "cac:OriginCountry/cbc:IdentificationCode"),
      attributes: x.all(item, "cac:AdditionalItemProperty").map((a) => ({
        name: x.text(a, "cbc:Name") ?? "",
        value: x.text(a, "cbc:Value") ?? "",
      })),
    },
    subLines,
  };
}

function payment(root: Element, seller: Element | undefined, payee: Element | undefined) {
  const means = x.all(root, "cac:PaymentMeans");
  if (!means.length) return undefined;
  const first = means[0]!;
  const code = x.one(first, "cbc:PaymentMeansCode");
  const card = x.one(first, "cac:CardAccount");
  const mandate = means.map((m) => x.one(m, "cac:PaymentMandate")).find(Boolean);
  const creditorId =
    ids(payee, "cac:PartyIdentification/cbc:ID").find((i) => i.scheme?.toUpperCase() === "SEPA")?.value ??
    ids(seller, "cac:PartyIdentification/cbc:ID").find((i) => i.scheme?.toUpperCase() === "SEPA")?.value;
  const result: PaymentInstructions = {
    meansCode: x.text(code),
    meansText: x.attr(code, undefined, "name"),
    remittanceInfo: x.text(first, "cbc:PaymentID"),
    creditTransfers: means.flatMap((m) =>
      x.all(m, "cac:PayeeFinancialAccount").map((a) => ({
        accountId: x.text(a, "cbc:ID") ?? "",
        accountName: x.text(a, "cbc:Name"),
        bic: x.text(a, "cac:FinancialInstitutionBranch/cbc:ID"),
      })),
    ),
    card: card
      ? { pan: x.text(card, "cbc:PrimaryAccountNumberID") ?? "", holder: x.text(card, "cbc:HolderName") }
      : undefined,
    directDebit:
      mandate || creditorId
        ? compact({
            mandateId: x.text(mandate, "cbc:ID"),
            creditorId,
            debitedAccount: x.text(mandate, "cac:PayerFinancialAccount/cbc:ID"),
          })
        : undefined,
  };
  return result;
}

export function parseUbl(root: Element, container: Container = "xml"): Invoice {
  const isCredit = root.namespaceURI === UBL_NS.cn;
  const currency = x.text(root, "cbc:DocumentCurrencyCode");
  const taxCurrency = x.text(root, "cbc:TaxCurrencyCode");
  const supplier = x.one(root, "cac:AccountingSupplierParty/cac:Party");
  const customer = x.one(root, "cac:AccountingCustomerParty/cac:Party");
  const payeeEl = x.one(root, "cac:PayeeParty");
  const taxRepEl = x.one(root, "cac:TaxRepresentativeParty");
  const deliveryEl = x.one(root, "cac:Delivery");
  const totalsEl = x.one(root, "cac:LegalMonetaryTotal");
  const additionalDocs = x.all(root, "cac:AdditionalDocumentReference");

  const taxTotals = x.all(root, "cac:TaxTotal");
  const docTaxTotal =
    taxTotals.find((t) => x.attr(t, "cbc:TaxAmount", "currencyID") === currency) ?? taxTotals[0];
  const taxCurrencyTotal = taxCurrency
    ? taxCurrency === currency
      ? docTaxTotal
      : taxTotals.find((t) => t !== docTaxTotal && x.attr(t, "cbc:TaxAmount", "currencyID") === taxCurrency)
    : undefined;

  const vatBreakdown: VatBreakdown[] = taxTotals
    .flatMap((t) => x.all(t, "cac:TaxSubtotal"))
    .filter((s) => !currency || (x.attr(s, "cbc:TaxableAmount", "currencyID") ?? currency) === currency)
    .map((s) => ({
      taxableAmount: x.num(s, "cbc:TaxableAmount") ?? 0,
      taxAmount: x.num(s, "cbc:TaxAmount") ?? 0,
      category: x.text(s, "cac:TaxCategory/cbc:ID") ?? "",
      rate: x.num(s, "cac:TaxCategory/cbc:Percent"),
      exemptionReason: x.text(s, "cac:TaxCategory/cbc:TaxExemptionReason"),
      exemptionReasonCode: x.text(s, "cac:TaxCategory/cbc:TaxExemptionReasonCode"),
    }));

  const attachments: Attachment[] = additionalDocs
    .filter((d) => !["130", "50"].includes(docRefType(d) ?? ""))
    .map((d) => {
      const bin = x.one(d, "cac:Attachment/cbc:EmbeddedDocumentBinaryObject");
      const content = bin?.textContent?.replace(/\s/g, "") || undefined;
      return {
        id: x.text(d, "cbc:ID") ?? "",
        description: x.text(d, "cbc:DocumentDescription"),
        externalUri: x.text(d, "cac:Attachment/cac:ExternalReference/cbc:URI"),
        content,
        mimeType: x.attr(bin, undefined, "mimeCode"),
        filename: x.attr(bin, undefined, "filename"),
        size: content ? base64Size(content) : undefined,
      };
    });

  const lines = x
    .all(root, isCredit ? "cac:CreditNoteLine" : "cac:InvoiceLine")
    .map((l) => line(l, isCredit));

  const customizationId = x.text(root, "cbc:CustomizationID");
  const businessProcess = x.text(root, "cbc:ProfileID");

  const delivery = deliveryEl
    ? compact({
        partyName: x.text(deliveryEl, "cac:DeliveryParty/cac:PartyName/cbc:Name"),
        locationId: id(deliveryEl, "cac:DeliveryLocation/cbc:ID"),
        date: toIsoDate(x.text(deliveryEl, "cbc:ActualDeliveryDate")),
        address: address(x.one(deliveryEl, "cac:DeliveryLocation/cac:Address")),
      })
    : undefined;

  return {
    syntax: "UBL",
    kind: isCredit ? "creditNote" : "invoice",
    profile: detectProfile(customizationId, businessProcess, "UBL", container),
    number: x.text(root, "cbc:ID"),
    issueDate: toIsoDate(x.text(root, "cbc:IssueDate")),
    typeCode: x.text(root, isCredit ? "cbc:CreditNoteTypeCode" : "cbc:InvoiceTypeCode"),
    currency,
    taxCurrency,
    taxPointDate: toIsoDate(x.text(root, "cbc:TaxPointDate")),
    taxPointDateCode: x.text(root, "cac:InvoicePeriod/cbc:DescriptionCode"),
    dueDate: toIsoDate(x.text(root, "cbc:DueDate") ?? x.text(root, "cac:PaymentMeans/cbc:PaymentDueDate")),
    buyerReference: x.text(root, "cbc:BuyerReference"),
    projectReference:
      x.text(root, "cac:ProjectReference/cbc:ID") ??
      additionalDocs.filter((d) => docRefType(d) === "50").map((d) => x.text(d, "cbc:ID"))[0],
    contractReference: x.text(root, "cac:ContractDocumentReference/cbc:ID"),
    orderReference: x.text(root, "cac:OrderReference/cbc:ID"),
    salesOrderReference: x.text(root, "cac:OrderReference/cbc:SalesOrderID"),
    receivingAdviceReference: x.text(root, "cac:ReceiptDocumentReference/cbc:ID"),
    despatchAdviceReference: x.text(root, "cac:DespatchDocumentReference/cbc:ID"),
    tenderReference: x.text(root, "cac:OriginatorDocumentReference/cbc:ID"),
    invoicedObject: additionalDocs.filter((d) => docRefType(d) === "130").map((d) => id(d, "cbc:ID"))[0],
    buyerAccountingReference: x.text(root, "cbc:AccountingCost"),
    paymentTerms: x.texts(root, "cac:PaymentTerms/cbc:Note").join("\n") || undefined,
    notes: x.texts(root, "cbc:Note").map(splitNote),
    precedingInvoices: x.all(root, "cac:BillingReference/cac:InvoiceDocumentReference").map((r) => ({
      id: x.text(r, "cbc:ID") ?? "",
      issueDate: toIsoDate(x.text(r, "cbc:IssueDate")),
    })),
    seller: party(supplier),
    buyer: party(customer),
    payee: payeeEl ? party(payeeEl) : undefined,
    sellerTaxRepresentative: taxRepEl ? party(taxRepEl) : undefined,
    delivery,
    invoicePeriod: compact({
      start: toIsoDate(x.text(root, "cac:InvoicePeriod/cbc:StartDate")),
      end: toIsoDate(x.text(root, "cac:InvoicePeriod/cbc:EndDate")),
    }),
    payment: payment(root, supplier, payeeEl),
    allowancesCharges: x.all(root, "cac:AllowanceCharge").map(allowanceCharge),
    totals: {
      lineNet: x.num(totalsEl, "cbc:LineExtensionAmount"),
      allowances: x.num(totalsEl, "cbc:AllowanceTotalAmount"),
      charges: x.num(totalsEl, "cbc:ChargeTotalAmount"),
      taxExclusive: x.num(totalsEl, "cbc:TaxExclusiveAmount"),
      tax: x.num(docTaxTotal, "cbc:TaxAmount"),
      taxInTaxCurrency: x.num(taxCurrencyTotal, "cbc:TaxAmount"),
      taxInclusive: x.num(totalsEl, "cbc:TaxInclusiveAmount"),
      prepaid: x.num(totalsEl, "cbc:PrepaidAmount"),
      rounding: x.num(totalsEl, "cbc:PayableRoundingAmount"),
      payable: x.num(totalsEl, "cbc:PayableAmount"),
    },
    thirdPartyPayments: x.all(root, "cac:PrepaidPayment").map((p) => ({
      type: x.text(p, "cbc:ID"),
      amount: x.num(p, "cbc:PaidAmount") ?? 0,
      description: x.text(p, "cbc:InstructionID"),
    })),
    vatBreakdown,
    attachments,
    lines,
  };
}
