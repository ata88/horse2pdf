import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGiroCode } from "../src/core/girocode";
import { loadDocument } from "../src/core/load";
import { FIXTURES, readFixture } from "./helpers";

describe("GiroCode (EPC QR)", async () => {
  const f = join(FIXTURES, "custom/orgaMAX_Beispielrechnung_XRechnung.xml");
  const { invoice } = await loadDocument(readFixture(f), f);

  it("encodes IBAN, name, amount and reference exactly", () => {
    expect(buildGiroCode(invoice)?.payload).toBe(
      [
        "BCD",
        "002",
        "1",
        "SCT",
        "",
        "Max Mustermann",
        "DE02120300000000202051",
        "EUR600.00",
        "",
        "",
        "000073",
      ].join("\n"),
    );
  });

  it("is not offered for direct debit, foreign currency or nothing to pay", () => {
    const base = structuredClone(invoice);
    expect(buildGiroCode({ ...base, payment: { ...base.payment!, meansCode: "59" } })).toBeUndefined();
    expect(buildGiroCode({ ...base, currency: "USD" })).toBeUndefined();
    expect(buildGiroCode({ ...base, totals: { ...base.totals, payable: 0 } })).toBeUndefined();
  });
});
