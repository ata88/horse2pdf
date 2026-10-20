/**
 * EPC QR code ("GiroCode", EPC069-12 v2) for SEPA credit transfers.
 * Banking apps read IBAN, recipient, amount and remittance information from it.
 */
import type { Invoice } from "./model";

const SEPA_COUNTRIES = new Set(
  "AD AT BE BG CH CY CZ DE DK EE ES FI FR GB GI GR HR HU IE IS IT LI LT LU LV MC MT NL NO PL PT RO SE SI SK SM VA".split(
    " ",
  ),
);

/** Payment means that are paid by the buyer via credit transfer. */
const TRANSFER_MEANS = new Set(["30", "31", "42", "58"]);

export interface GiroCode {
  payload: string;
  iban: string;
  name: string;
  amount: number;
  remittance?: string;
}

export function buildGiroCode(inv: Invoice): GiroCode | undefined {
  const pay = inv.payment;
  const transfer = pay?.creditTransfers.find((c) => c.accountId);
  if (!pay || !transfer) return undefined;
  if (pay.meansCode && !TRANSFER_MEANS.has(pay.meansCode)) return undefined;
  if (inv.currency !== "EUR") return undefined;
  const amount = inv.totals.payable;
  if (amount === undefined || amount <= 0 || amount > 999_999_999.99) return undefined;
  const iban = transfer.accountId.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || !SEPA_COUNTRIES.has(iban.slice(0, 2))) return undefined;

  const name = (transfer.accountName ?? inv.payee?.name ?? inv.seller.name ?? "").slice(0, 70).trim();
  if (!name) return undefined;
  const remittance = (pay.remittanceInfo ?? inv.number ?? "").replace(/\s+/g, " ").slice(0, 140).trim();
  const bic = (transfer.bic ?? "").replace(/\s/g, "").toUpperCase();

  const payload = [
    "BCD",
    "002",
    "1", // UTF-8
    "SCT",
    /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic) ? bic : "",
    name,
    iban,
    `EUR${amount.toFixed(2)}`,
    "", // purpose code
    "", // structured reference
    remittance,
  ].join("\n");
  return { payload, iban, name, amount, remittance: remittance || undefined };
}
