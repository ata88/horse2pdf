import { describe, expect, it } from "vitest";
import { codeLabel, countryName, INVOICE_TYPES, UNITS } from "../src/core/codelists";
import { addressLines, amount, date, iban, money, percent, period, quantity } from "../src/core/format";
import { detectProfile } from "../src/core/profile";

describe("format", () => {
  it("formats money without losing decimals", () => {
    expect(money(1234.5, "EUR")).toBe("1.234,50 €");
    expect(money(0.123456, "EUR")).toBe("0,123456 €");
    expect(money(-12, "EUR")).toBe("-12,00 €");
    expect(money(10, "XYZ")).toMatch(/10,00.XYZ/);
    expect(amount(3)).toBe("3,00");
    expect(money(undefined)).toBe("");
  });
  it("formats quantities, percentages and dates", () => {
    expect(quantity(2.5)).toBe("2,5");
    expect(quantity(1000)).toBe("1.000");
    expect(percent(19)).toBe("19 %");
    expect(percent(7.5)).toBe("7,5 %");
    expect(date("2025-01-07")).toBe("07.01.2025");
    expect(date("garbage")).toBe("garbage");
    expect(period("2025-01-01", "2025-01-31")).toBe("01.01.2025 – 31.01.2025");
  });
  it("groups IBANs", () => {
    expect(iban("DE02120300000000202051")).toBe("DE02 1203 0000 0000 2020 51");
    expect(iban("123-abc")).toBe("123-abc");
  });
  it("renders addresses", () => {
    expect(addressLines({ line1: "Musterstr. 1", postcode: "12345", city: "Berlin", country: "DE" })).toEqual(
      ["Musterstr. 1", "12345 Berlin"],
    );
    expect(addressLines({ city: "Paris", country: "FR" })).toEqual(["Paris", "Frankreich"]);
  });
});

describe("codelists", () => {
  it("always keeps the raw code visible", () => {
    expect(codeLabel(INVOICE_TYPES, "380")).toBe("Rechnung (380)");
    expect(codeLabel(UNITS, "HUR")).toBe("Stunde (HUR)");
    expect(codeLabel(UNITS, "ABC")).toBe("ABC");
    expect(countryName("AT")).toBe("Österreich");
  });
});

describe("profile detection", () => {
  const p = (id: string, container: "xml" | "pdf" = "xml", syntax: "UBL" | "CII" = "CII") =>
    detectProfile(id, undefined, syntax, container);
  it.each([
    ["urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0", "XRechnung 3.0", true],
    [
      "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0#conformant#urn:xeinkauf.de:kosit:extension:xrechnung_3.0",
      "XRechnung 3.0 (Extension)",
      true,
    ],
    [
      "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0",
      "Peppol BIS Billing 3.0",
      true,
    ],
    ["urn:factur-x.eu:1p0:minimum", "ZUGFeRD / Factur-X MINIMUM", false],
    ["urn:factur-x.eu:1p0:basicwl", "ZUGFeRD / Factur-X BASIC WL", false],
    ["urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic", "ZUGFeRD / Factur-X BASIC", true],
    ["urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended", "ZUGFeRD / Factur-X EXTENDED", true],
    ["urn:cen.eu:en16931:2017#conformant#urn:zugferd.de:2p0:extended", "ZUGFeRD EXTENDED", true],
  ])("%s → %s", (id, name, compliant) => {
    const r = p(id);
    expect(r.name).toBe(name);
    expect(r.isEn16931Compliant).toBe(compliant);
  });
  it("names plain EN 16931 by container", () => {
    expect(p("urn:cen.eu:en16931:2017", "pdf").name).toBe("ZUGFeRD / Factur-X EN 16931");
    expect(p("urn:cen.eu:en16931:2017", "xml", "UBL").name).toBe("EN 16931");
  });
});
