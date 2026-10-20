/**
 * Oracle test: every business term we extract must match the official KoSIT
 * mapping (xrechnung-visualization: UBL/CII → "xr" XML annotated with BT ids).
 *
 * This protects against swapped fields, wrong XPaths and lost values. Both sides
 * are reduced to multisets of "BT-x = value" per invoice and compared exactly.
 */
import { describe, expect, it } from "vitest";
import { loadDocument } from "../src/core/load";
import { flattenTerms, invoiceTerms } from "../src/core/terms";
import { diff, fixtureFiles, kositTerms, norm, readFixture, rel, SKIP } from "./helpers";

/**
 * Per-file differences that are bugs/ambiguities of the reference stylesheet, not of us.
 * Each entry must explain why our value is the correct one.
 */
const KNOWN_ORACLE_DEVIATIONS: Record<string, { missing?: string[]; unexpected?: string[]; why: string }> = {
  "en16931/ubl-ubl-tc434-example2.xml": {
    unexpected: ["BT-92 = 100", "BT-95 = S", "BT-96 = 25", "BT-97 = Promotion discount", "BT-98 = 88"],
    why: "ChargeIndicator is '0' (valid xs:boolean false). KoSIT only recognises the literal 'false' and drops the allowance.",
  },
  "zugferd/zugferd_2p0_EXTENDED_Fremdwaehrung.pdf": {
    missing: ["BT-20 = Zahlbar ohne Abschlag bis ;Zahlbar mit 2% Skonto bis", "BT-9 = 2018-11-20;2018-11-14"],
    unexpected: ["BT-20 = Zahlbar ohne Abschlag bis Zahlbar mit 2% Skonto bis", "BT-9 = 2018-11-20"],
    why: "EXTENDED allows several payment terms. EN 16931 has one BT-9 – we use the first due date and join the term texts.",
  },
  "zugferd/zugferd_2p0_EXTENDED_Warenrechnung.pdf": {
    missing: ["BT-147 = 0.02", "BT-147 = 0.03"],
    unexpected: ["BT-147 = 0.05", "BT-99 = 3", "BT-102 = S", "BT-103 = 19", "BT-104 = Transportkosten"],
    why: "EXTENDED allows several price discounts (EN 16931 has one BT-147 – we report their sum) and logistics service charges, which KoSIT ignores although they are part of BT-108.",
  },
  "en16931/cii-CII_business_example_01.xml": {
    missing: ["BT-149 = 1498", "BT-149 = 2.75"],
    unexpected: ["BT-149 = 1273", "BT-149 = 2.48"],
    why: "Gross and net price carry different BasisQuantity. EN 16931-3-3 binds BT-149 to the net price; KoSIT prefers the gross one.",
  },
  "en16931/cii-CII_example2.xml": {
    missing: ["BT-149 = 1498", "BT-149 = 2.75"],
    unexpected: ["BT-149 = 1273", "BT-149 = 2.48"],
    why: "See CII_business_example_01 (net vs. gross BasisQuantity).",
  },
  "en16931/cii-CII_example5.xml": {
    missing: ["BT-149 = 1.1"],
    unexpected: ["BT-149 = 1"],
    why: "See CII_business_example_01 (net vs. gross BasisQuantity).",
  },
};

const files = fixtureFiles();

describe("business terms match the KoSIT reference mapping", () => {
  it.each(files.map((f) => [rel(f), f]))("%s", async (_name, file) => {
    const loaded = await loadDocument(readFixture(file), file);
    const { invoice } = loaded;
    const expected = kositTerms(invoice, loaded.xml);
    const actual = flattenTerms(invoiceTerms(invoice))
      .filter((t) => /^BT-(DEX-)?\d+$/.test(t.id) && !SKIP.has(t.id) && t.value?.trim())
      .map((t) => `${t.id} = ${norm(t.id, t.value!)}`)
      .sort();

    const known = KNOWN_ORACLE_DEVIATIONS[rel(file)];
    const missing = diff(diff(expected, actual), known?.missing ?? []);
    const unexpected = diff(diff(actual, expected), known?.unexpected ?? []).filter(
      (t) =>
        // CII: KoSIT drops the buyer's ram:ID when a ram:GlobalID exists; we show both.
        !(
          invoice.syntax === "CII" &&
          t.startsWith("BT-46 = ") &&
          expected.some((e) => e.startsWith("BT-46 = "))
        ) &&
        // KoSIT only emits BG-16 when a payment means code exists; we keep a lone remittance info.
        !(t.startsWith("BT-83 = ") && !expected.some((e) => e.startsWith("BT-81 = "))),
    );
    if (process.env.ORACLE_REPORT && (missing.length || unexpected.length)) {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(
        process.env.ORACLE_REPORT,
        `${JSON.stringify({ file: rel(file), missing, unexpected })}\n`,
      );
    }
    expect({ missing, unexpected }).toEqual({ missing: [], unexpected: [] });
  });
});
