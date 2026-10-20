/**
 * Cross-check against the official ELSTER e-invoice viewer
 * (https://www.elster.de/eportal/e-rechnung). The expected values below were read
 * from ELSTER's rendering of the orgaMAX sample invoice (tests/fixtures/custom).
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDocument } from "../src/core/load";
import { FIXTURES, readFixture } from "./helpers";

describe("orgaMAX XRechnung sample matches the ELSTER viewer", async () => {
  const file = join(FIXTURES, "custom/orgaMAX_Beispielrechnung_XRechnung.xml");
  const { invoice: inv } = await loadDocument(readFixture(file), file);

  it("invoice data (Rechnungsdaten)", () => {
    expect(inv.profile.name).toBe("XRechnung 3.0");
    expect(inv.number).toBe("000073");
    expect(inv.issueDate).toBe("2025-01-07");
    expect(inv.typeCode).toBe("380");
    expect(inv.currency).toBe("EUR");
    expect(inv.buyerReference).toBe("K2624326-04716");
    expect(inv.dueDate).toBe("2025-01-21");
    expect(inv.delivery?.date).toBe("2025-01-07");
  });

  it("seller (Verkäufer)", () => {
    expect(inv.seller.name).toBe("achtmacher KOMMUNIKATION");
    expect(inv.seller.address).toEqual({ line1: "Test", postcode: "33181", city: "Musterstadt", country: "DE" });
    expect(inv.seller.contact).toEqual({
      name: "Max Mustermann",
      phone: "0123456789",
      email: "max.mustermann@klavierklang.de",
    });
    expect(inv.seller.electronicAddress).toEqual({ value: "ekaup@orgamax.de", scheme: "EM" });
    expect(inv.seller.vatId).toBe("DE264995557");
    expect(inv.seller.taxRegistrationId).toBe("313/5766/0931");
  });

  it("buyer (Käufer)", () => {
    expect(inv.buyer.name).toBe("Klavierklang GmbH");
    expect(inv.buyer.address).toEqual({
      line1: "Musterstraße 1",
      postcode: "32758",
      city: "Musterstadt",
      country: "DE",
    });
    // <cbc:EndpointID schemeID="EM"/> is empty – there is no electronic address.
    expect(inv.buyer.electronicAddress).toBeUndefined();
    expect(inv.buyer.vatId).toBeUndefined();
  });

  it("totals (Gesamtbeträge)", () => {
    expect(inv.totals).toEqual({
      lineNet: 504.2,
      taxExclusive: 504.2,
      tax: 95.8,
      taxInclusive: 600,
      prepaid: 0,
      payable: 600,
      allowances: undefined,
      charges: undefined,
      rounding: undefined,
      taxInTaxCurrency: undefined,
    });
    expect(inv.vatBreakdown).toEqual([
      {
        category: "S",
        rate: 19,
        taxableAmount: 504.2,
        taxAmount: 95.8,
        exemptionReason: undefined,
        exemptionReasonCode: undefined,
      },
    ]);
  });

  it("payment (Zahlungsdaten)", () => {
    expect(inv.payment?.meansCode).toBe("58");
    expect(inv.payment?.creditTransfers).toEqual([
      { accountId: "DE02120300000000202051", accountName: "Max Mustermann", bic: undefined },
    ]);
  });

  it("lines (Positionen)", () => {
    expect(
      inv.lines.map((l) => [l.id, l.item.name, l.item.sellerId, l.quantity, l.unit, l.price.net, l.netAmount]),
    ).toEqual([
      ["1", "Grafik/Design/Layout", "5", 1, "C62", 420.17, 420.17],
      ["2", "Texterstellung", "7", 1, "C62", 84.03, 84.03],
    ]);
    expect(inv.lines.every((l) => l.vatCategory === "S" && l.vatRate === 19 && l.price.baseQuantity === 1)).toBe(
      true,
    );
  });
});
