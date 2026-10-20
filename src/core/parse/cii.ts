/**
 * UN/CEFACT Cross Industry Invoice (CII D16B) → Invoice model, following the
 * EN 16931-3-3 syntax binding. Used by XRechnung (CII), ZUGFeRD 2.x and Factur-X.
 * Lines with a ParentLineID are nested as sub lines (XRechnung extension / EXTENDED).
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
  Party,
  PaymentInstructions,
} from "../model";
import { detectProfile } from "../profile";
import { base64Size, compact, isTrue, toIsoDate, XPathLite } from "../xml";

export const CII_NS = {
  rsm: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  udt: "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
  qdt: "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
};

const x = new XPathLite(CII_NS);

/** UNTDID 1001 codes that denote a credit note. */
const CREDIT_NOTE_TYPES = new Set(["81", "83", "261", "262", "296", "308", "381", "396", "420", "458", "532"]);

function date(el: Element | undefined, path: string): string | undefined {
  return toIsoDate(x.text(el, path));
}

function idOf(e: Element | undefined): Identifier | undefined {
  const value = x.text(e);
  return value ? { value, scheme: x.attr(e, undefined, "schemeID") } : undefined;
}

function address(el: Element | undefined): Address | undefined {
  if (!el) return undefined;
  return compact<Address>({
    line1: x.text(el, "ram:LineOne"),
    line2: x.text(el, "ram:LineTwo"),
    line3: x.text(el, "ram:LineThree"),
    city: x.text(el, "ram:CityName"),
    postcode: x.text(el, "ram:PostcodeCode"),
    region: x.text(el, "ram:CountrySubDivisionName"),
    country: x.text(el, "ram:CountryID"),
  });
}

function contact(el: Element | undefined): Contact | undefined {
  if (!el) return undefined;
  const name = [x.text(el, "ram:PersonName"), x.text(el, "ram:DepartmentName")].filter(Boolean).join(", ");
  return compact<Contact>({
    name: name || undefined,
    phone: x.text(el, "ram:TelephoneUniversalCommunication/ram:CompleteNumber"),
    email: x.text(el, "ram:EmailURIUniversalCommunication/ram:URIID"),
  });
}

function party(p: Element | undefined): Party {
  const regs = x.all(p, "ram:SpecifiedTaxRegistration/ram:ID");
  const legal = x.one(p, "ram:SpecifiedLegalOrganization");
  return {
    name: x.text(p, "ram:Name"),
    tradingName: x.text(legal, "ram:TradingBusinessName"),
    identifiers: [
      ...x.all(p, "ram:ID").map(idOf),
      ...x.all(p, "ram:GlobalID").map(idOf),
    ].filter((i): i is Identifier => !!i),
    legalRegistration: idOf(x.one(legal, "ram:ID")),
    vatId: x.text(regs.find((r) => x.attr(r, undefined, "schemeID")?.toUpperCase() === "VA")),
    taxRegistrationId: x.text(regs.find((r) => x.attr(r, undefined, "schemeID")?.toUpperCase() === "FC")),
    additionalLegalInfo: x.text(p, "ram:Description"),
    electronicAddress: idOf(x.one(p, "ram:URIUniversalCommunication/ram:URIID")),
    address: address(x.one(p, "ram:PostalTradeAddress")),
    contact: contact(x.one(p, "ram:DefinedTradeContact")),
  };
}

function allowanceCharge(el: Element): AllowanceCharge {
  return {
    isCharge: isTrue(x.text(el, "ram:ChargeIndicator/udt:Indicator")),
    amount: x.num(el, "ram:ActualAmount") ?? 0,
    baseAmount: x.num(el, "ram:BasisAmount"),
    percent: x.num(el, "ram:CalculationPercent"),
    vatCategory: x.text(el, "ram:CategoryTradeTax/ram:CategoryCode"),
    vatRate: x.num(el, "ram:CategoryTradeTax/ram:RateApplicablePercent"),
    reason: x.text(el, "ram:Reason"),
    reasonCode: x.text(el, "ram:ReasonCode"),
  };
}

function line(el: Element): InvoiceLine & { parentId?: string } {
  const doc = x.one(el, "ram:AssociatedDocumentLineDocument");
  const product = x.one(el, "ram:SpecifiedTradeProduct");
  const agreement = x.one(el, "ram:SpecifiedLineTradeAgreement");
  const settlement = x.one(el, "ram:SpecifiedLineTradeSettlement");
  const qty = x.one(el, "ram:SpecifiedLineTradeDelivery/ram:BilledQuantity");
  const gross = x.one(agreement, "ram:GrossPriceProductTradePrice");
  const net = x.one(agreement, "ram:NetPriceProductTradePrice");
  const basis = x.one(net, "ram:BasisQuantity") ?? x.one(gross, "ram:BasisQuantity");
  const objectRef = x
    .all(settlement, "ram:AdditionalReferencedDocument")
    .find((d) => x.text(d, "ram:TypeCode") === "130");
  const discounts = x
    .all(gross, "ram:AppliedTradeAllowanceCharge")
    .filter((ac) => !isTrue(x.text(ac, "ram:ChargeIndicator/udt:Indicator")));

  return {
    id: x.text(doc, "ram:LineID") ?? "",
    parentId: x.text(doc, "ram:ParentLineID"),
    lineStatus: x.text(doc, "ram:LineStatusReasonCode"),
    note: x.texts(doc, "ram:IncludedNote/ram:Content").join("\n") || undefined,
    objectId: objectRef
      ? {
          value: x.text(objectRef, "ram:IssuerAssignedID") ?? "",
          scheme: x.text(objectRef, "ram:ReferenceTypeCode"),
        }
      : undefined,
    quantity: x.num(qty),
    unit: x.attr(qty, undefined, "unitCode"),
    netAmount: x.num(settlement, "ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount"),
    orderLineReference: x.text(agreement, "ram:BuyerOrderReferencedDocument/ram:LineID"),
    buyerAccountingReference: x.text(settlement, "ram:ReceivableSpecifiedTradeAccountingAccount/ram:ID"),
    period: compact({
      start: date(settlement, "ram:BillingSpecifiedPeriod/ram:StartDateTime/udt:DateTimeString"),
      end: date(settlement, "ram:BillingSpecifiedPeriod/ram:EndDateTime/udt:DateTimeString"),
    }),
    allowancesCharges: x.all(settlement, "ram:SpecifiedTradeAllowanceCharge").map(allowanceCharge),
    price: {
      net: x.num(net, "ram:ChargeAmount"),
      gross: x.num(gross, "ram:ChargeAmount"),
      discount: discounts.length
        ? discounts.reduce((sum, d) => sum + (x.num(d, "ram:ActualAmount") ?? 0), 0)
        : undefined,
      baseQuantity: x.num(basis),
      baseQuantityUnit: x.attr(basis, undefined, "unitCode"),
    },
    vatCategory: x.text(settlement, "ram:ApplicableTradeTax/ram:CategoryCode"),
    vatRate: x.num(settlement, "ram:ApplicableTradeTax/ram:RateApplicablePercent"),
    item: {
      name: x.text(product, "ram:Name"),
      description: x.text(product, "ram:Description"),
      sellerId: x.text(product, "ram:SellerAssignedID"),
      buyerId: x.text(product, "ram:BuyerAssignedID"),
      standardId: idOf(x.one(product, "ram:GlobalID")),
      classifications: x
        .all(product, "ram:DesignatedProductClassification/ram:ClassCode")
        .map((c) => ({ value: x.text(c) ?? "", scheme: x.attr(c, undefined, "listID") }))
        .filter((c) => c.value),
      originCountry: x.text(product, "ram:OriginTradeCountry/ram:ID"),
      attributes: x.all(product, "ram:ApplicableProductCharacteristic").map((a) => ({
        name: x.text(a, "ram:Description") ?? "",
        value: x.text(a, "ram:Value") ?? "",
      })),
    },
    subLines: [],
  };
}

/** Builds the line hierarchy from ParentLineID references (unknown parents stay top level). */
function nestLines(flat: Array<InvoiceLine & { parentId?: string }>): InvoiceLine[] {
  const byId = new Map(flat.map((l) => [l.id, l]));
  const roots: InvoiceLine[] = [];
  for (const l of flat) {
    const parentId = l.parentId;
    delete l.parentId;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent && parent !== l) parent.subLines.push(l);
    else roots.push(l);
  }
  return roots;
}

function payment(settlement: Element | undefined, terms: Element[]): PaymentInstructions | undefined {
  const means = x.all(settlement, "ram:SpecifiedTradeSettlementPaymentMeans");
  const creditorId = x.text(settlement, "ram:CreditorReferenceID");
  const remittanceInfo = x.text(settlement, "ram:PaymentReference");
  const mandateId = terms.map((t) => x.text(t, "ram:DirectDebitMandateID")).find(Boolean);
  if (!means.length && !creditorId && !remittanceInfo) return undefined;
  const first = means[0];
  const card = x.one(first, "ram:ApplicableTradeSettlementFinancialCard");
  const debited = means.map((m) => x.text(m, "ram:PayerPartyDebtorFinancialAccount/ram:IBANID")).find(Boolean);
  return {
    meansCode: x.text(first, "ram:TypeCode"),
    meansText: x.text(first, "ram:Information"),
    remittanceInfo,
    creditTransfers: means.flatMap((m) =>
      x.all(m, "ram:PayeePartyCreditorFinancialAccount").map((a) => ({
        accountId: x.text(a, "ram:IBANID") ?? x.text(a, "ram:ProprietaryID") ?? "",
        accountName: x.text(a, "ram:AccountName"),
        bic: x.text(m, "ram:PayeeSpecifiedCreditorFinancialInstitution/ram:BICID"),
      })),
    ),
    card: card ? { pan: x.text(card, "ram:ID") ?? "", holder: x.text(card, "ram:CardholderName") } : undefined,
    directDebit:
      mandateId || creditorId || debited
        ? compact({ mandateId, creditorId, debitedAccount: debited })
        : undefined,
  };
}

export function parseCii(root: Element, container: Container = "xml"): Invoice {
  const ctx = x.one(root, "rsm:ExchangedDocumentContext");
  const doc = x.one(root, "rsm:ExchangedDocument");
  const tx = x.one(root, "rsm:SupplyChainTradeTransaction");
  const agreement = x.one(tx, "ram:ApplicableHeaderTradeAgreement");
  const deliveryEl = x.one(tx, "ram:ApplicableHeaderTradeDelivery");
  const settlement = x.one(tx, "ram:ApplicableHeaderTradeSettlement");
  const sums = x.one(settlement, "ram:SpecifiedTradeSettlementHeaderMonetarySummation");
  const terms = x.all(settlement, "ram:SpecifiedTradePaymentTerms");

  const typeCode = x.text(doc, "ram:TypeCode");
  const currency = x.text(settlement, "ram:InvoiceCurrencyCode");
  const taxCurrency = x.text(settlement, "ram:TaxCurrencyCode");
  const taxTotals = x.all(sums, "ram:TaxTotalAmount");
  const docTax =
    taxTotals.find((t) => (x.attr(t, undefined, "currencyID") ?? currency) === currency) ?? taxTotals[0];
  const taxCurTax = taxCurrency
    ? taxCurrency === currency
      ? docTax
      : taxTotals.find((t) => t !== docTax && x.attr(t, undefined, "currencyID") === taxCurrency)
    : undefined;

  const refDocs = x.all(agreement, "ram:AdditionalReferencedDocument");
  const attachments: Attachment[] = refDocs
    .filter((d) => x.text(d, "ram:TypeCode") === "916")
    .map((d) => {
      const bin = x.one(d, "ram:AttachmentBinaryObject");
      const content = bin?.textContent?.replace(/\s/g, "") || undefined;
      return {
        id: x.text(d, "ram:IssuerAssignedID") ?? "",
        description: x.text(d, "ram:Name"),
        externalUri: x.text(d, "ram:URIID"),
        content,
        mimeType: x.attr(bin, undefined, "mimeCode"),
        filename: x.attr(bin, undefined, "filename"),
        size: content ? base64Size(content) : undefined,
      };
    });
  const objectRef = refDocs.find((d) => x.text(d, "ram:TypeCode") === "130");
  const shipTo = x.one(deliveryEl, "ram:ShipToTradeParty");
  const payeeEl = x.one(settlement, "ram:PayeeTradeParty");
  const taxRepEl = x.one(agreement, "ram:SellerTaxRepresentativeTradeParty");

  const customizationId = x.text(ctx, "ram:GuidelineSpecifiedDocumentContextParameter/ram:ID");
  const businessProcess = x.text(ctx, "ram:BusinessProcessSpecifiedDocumentContextParameter/ram:ID");
  const headerTaxes = x.all(settlement, "ram:ApplicableTradeTax");

  return {
    syntax: "CII",
    kind: CREDIT_NOTE_TYPES.has(typeCode ?? "") ? "creditNote" : "invoice",
    profile: detectProfile(customizationId, businessProcess, "CII", container),
    number: x.text(doc, "ram:ID"),
    issueDate: date(doc, "ram:IssueDateTime/udt:DateTimeString"),
    typeCode,
    currency,
    taxCurrency,
    taxPointDate: headerTaxes.map((t) => date(t, "ram:TaxPointDate/udt:DateString")).find(Boolean),
    taxPointDateCode: headerTaxes.map((t) => x.text(t, "ram:DueDateTypeCode")).find(Boolean),
    dueDate: terms.map((t) => date(t, "ram:DueDateDateTime/udt:DateTimeString")).find(Boolean),
    buyerReference: x.text(agreement, "ram:BuyerReference"),
    projectReference: x.text(agreement, "ram:SpecifiedProcuringProject/ram:ID"),
    contractReference: x.text(agreement, "ram:ContractReferencedDocument/ram:IssuerAssignedID"),
    orderReference: x.text(agreement, "ram:BuyerOrderReferencedDocument/ram:IssuerAssignedID"),
    salesOrderReference: x.text(agreement, "ram:SellerOrderReferencedDocument/ram:IssuerAssignedID"),
    receivingAdviceReference: x.text(deliveryEl, "ram:ReceivingAdviceReferencedDocument/ram:IssuerAssignedID"),
    despatchAdviceReference: x.text(deliveryEl, "ram:DespatchAdviceReferencedDocument/ram:IssuerAssignedID"),
    tenderReference: refDocs
      .filter((d) => x.text(d, "ram:TypeCode") === "50")
      .map((d) => x.text(d, "ram:IssuerAssignedID"))[0],
    invoicedObject: objectRef
      ? {
          value: x.text(objectRef, "ram:IssuerAssignedID") ?? "",
          scheme: x.text(objectRef, "ram:ReferenceTypeCode"),
        }
      : undefined,
    buyerAccountingReference: x.text(settlement, "ram:ReceivableSpecifiedTradeAccountingAccount/ram:ID"),
    paymentTerms: terms.flatMap((t) => x.texts(t, "ram:Description")).join("\n") || undefined,
    notes: x
      .all(doc, "ram:IncludedNote")
      .map((n) => ({ subjectCode: x.text(n, "ram:SubjectCode"), text: x.text(n, "ram:Content") ?? "" }))
      .filter((n) => n.text),
    precedingInvoices: x.all(settlement, "ram:InvoiceReferencedDocument").map((r) => ({
      id: x.text(r, "ram:IssuerAssignedID") ?? "",
      issueDate: date(r, "ram:FormattedIssueDateTime/qdt:DateTimeString"),
    })),
    seller: party(x.one(agreement, "ram:SellerTradeParty")),
    buyer: party(x.one(agreement, "ram:BuyerTradeParty")),
    payee: payeeEl ? party(payeeEl) : undefined,
    sellerTaxRepresentative: taxRepEl ? party(taxRepEl) : undefined,
    delivery: compact({
      partyName: x.text(shipTo, "ram:Name"),
      locationId: idOf(x.one(shipTo, "ram:GlobalID")) ?? idOf(x.one(shipTo, "ram:ID")),
      date: date(deliveryEl, "ram:ActualDeliverySupplyChainEvent/ram:OccurrenceDateTime/udt:DateTimeString"),
      address: address(x.one(shipTo, "ram:PostalTradeAddress")),
    }),
    invoicePeriod: compact({
      start: date(settlement, "ram:BillingSpecifiedPeriod/ram:StartDateTime/udt:DateTimeString"),
      end: date(settlement, "ram:BillingSpecifiedPeriod/ram:EndDateTime/udt:DateTimeString"),
    }),
    payment: payment(settlement, terms),
    allowancesCharges: [
      ...x.all(settlement, "ram:SpecifiedTradeAllowanceCharge").map(allowanceCharge),
      // ZUGFeRD EXTENDED: logistics service charges are document level charges.
      ...x.all(settlement, "ram:SpecifiedLogisticsServiceCharge").map(
        (el): AllowanceCharge => ({
          isCharge: true,
          amount: x.num(el, "ram:AppliedAmount") ?? 0,
          vatCategory: x.text(el, "ram:AppliedTradeTax/ram:CategoryCode"),
          vatRate: x.num(el, "ram:AppliedTradeTax/ram:RateApplicablePercent"),
          reason: x.text(el, "ram:Description"),
        }),
      ),
    ],
    totals: {
      lineNet: x.num(sums, "ram:LineTotalAmount"),
      allowances: x.num(sums, "ram:AllowanceTotalAmount"),
      charges: x.num(sums, "ram:ChargeTotalAmount"),
      taxExclusive: x.num(sums, "ram:TaxBasisTotalAmount"),
      tax: x.num(docTax),
      taxInTaxCurrency: x.num(taxCurTax),
      taxInclusive: x.num(sums, "ram:GrandTotalAmount"),
      prepaid: x.num(sums, "ram:TotalPrepaidAmount"),
      rounding: x.num(sums, "ram:RoundingAmount"),
      payable: x.num(sums, "ram:DuePayableAmount"),
    },
    thirdPartyPayments: [],
    vatBreakdown: headerTaxes.map((t) => ({
      taxableAmount: x.num(t, "ram:BasisAmount") ?? 0,
      taxAmount: x.num(t, "ram:CalculatedAmount") ?? 0,
      category: x.text(t, "ram:CategoryCode") ?? "",
      rate: x.num(t, "ram:RateApplicablePercent"),
      exemptionReason: x.text(t, "ram:ExemptionReason"),
      exemptionReasonCode: x.text(t, "ram:ExemptionReasonCode"),
    })),
    attachments,
    lines: nestLines(x.all(tx, "ram:IncludedSupplyChainTradeLineItem").map(line)),
  };
}
