/**
 * Runs the official rule sets over all fixtures. Expected results are pinned in a
 * snapshot (error/warning rule ids per file) so any change in parsing, rule selection
 * or rule versions shows up in review.
 */
import { describe, expect, it } from "vitest";
import { loadDocument } from "../src/core/load";
import { parseSvrl, selectRuleSetIds, validateInvoice } from "../src/core/validate";
import { fixtureFiles, readFixture, rel } from "./helpers";

/** Sample files that are known to contain real defects (verified manually). */
const KNOWN_INVALID: Record<string, string> = {
  "xml-rechnung/EN16931_Einfach.ubl.xml": "Peppol customization but violates German Peppol rules (DE-R-*)",
  "xml-rechnung/EN16931_Rabatte.ubl.xml": "Peppol customization but violates German Peppol rules (DE-R-*)",
  "xrechnung/04.05a-INVOICE_uncefact.xml":
    "identifier scheme not in the current ISO 6523 ICD list (BR-CL-10)",
  "zugferd/Avoir_FR_type381_BASIC.pdf": "currencyID on amounts that must not carry it (CII-DT-031)",
};

describe("validation with the official rule sets", () => {
  it.each(fixtureFiles().map((f) => [rel(f), f]))("%s", async (name, f) => {
    const doc = await loadDocument(readFixture(f), f);
    const r = await validateInvoice(doc.xml, doc.invoice);
    expect(r.ruleSets.map((s) => s.id)).toEqual(selectRuleSetIds(doc.invoice));
    expect(r.valid || !doc.invoice.profile.isEn16931Compliant).toBe(!(name in KNOWN_INVALID));
    const summary = (sev: string) =>
      [...new Set(r.issues.filter((i) => i.severity === sev).map((i) => i.ruleId))].sort();
    expect({
      errors: summary("error"),
      warnings: summary("warning"),
      infos: summary("info"),
    }).toMatchSnapshot();
  });
});

describe("SVRL parsing", () => {
  it("maps flags to severities and extracts ids and messages", () => {
    const svrl = `<svrl:schematron-output xmlns:svrl="http://purl.oclc.org/dsdl/svrl">
      <svrl:failed-assert id="BR-01" flag="fatal" location="/Invoice" test="cbc:ID">
        <svrl:text>[BR-01]-An Invoice shall have a Specification identifier (BT-24).</svrl:text>
      </svrl:failed-assert>
      <svrl:failed-assert flag="warning" location="/x"><svrl:text>[BR-DE-TMP-32] Hinweis</svrl:text></svrl:failed-assert>
      <svrl:successful-report id="R1" flag="information"><svrl:text>info</svrl:text></svrl:successful-report>
    </svrl:schematron-output>`;
    expect(parseSvrl(svrl, "Test")).toEqual([
      {
        ruleId: "BR-01",
        severity: "error",
        message: "An Invoice shall have a Specification identifier (BT-24).",
        location: "/Invoice",
        test: "cbc:ID",
        ruleSet: "Test",
      },
      {
        ruleId: "BR-DE-TMP-32",
        severity: "warning",
        message: "Hinweis",
        location: "/x",
        test: undefined,
        ruleSet: "Test",
      },
      {
        ruleId: "R1",
        severity: "info",
        message: "info",
        location: undefined,
        test: undefined,
        ruleSet: "Test",
      },
    ]);
  });
});

describe("validation detects manipulated invoices", () => {
  it("reports BR-CO-16 when the amount due is tampered with", async () => {
    const f = fixtureFiles().find((x) => x.endsWith("orgaMAX_Beispielrechnung_XRechnung.xml"))!;
    const xml = new TextDecoder()
      .decode(readFixture(f))
      .replace(
        '<cbc:PayableAmount currencyID="EUR">600</cbc:PayableAmount>',
        '<cbc:PayableAmount currencyID="EUR">660</cbc:PayableAmount>',
      );
    const doc = await loadDocument(new TextEncoder().encode(xml), "tampered.xml");
    expect(doc.invoice.totals.payable).toBe(660);
    const r = await validateInvoice(doc.xml, doc.invoice);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.ruleId === "BR-CO-16" && i.severity === "error")).toBe(true);
  });

  it("reports a missing Leitweg-ID (BR-DE-15) for XRechnung", async () => {
    const f = fixtureFiles().find((x) => x.endsWith("orgaMAX_Beispielrechnung_XRechnung.xml"))!;
    const xml = new TextDecoder()
      .decode(readFixture(f))
      .replace(/<cbc:BuyerReference>[^<]*<\/cbc:BuyerReference>/, "");
    const doc = await loadDocument(new TextEncoder().encode(xml), "no-leitweg.xml");
    const r = await validateInvoice(doc.xml, doc.invoice);
    expect(r.issues.some((i) => i.ruleId === "BR-DE-15" && i.severity === "error")).toBe(true);
  });
});

describe("IBAN check (BR-DE-19) is exact", () => {
  const demo = () => fixtureFiles().find((x) => x.endsWith("demo-xrechnung.xml"))!;
  const run = async (iban: string) => {
    const xml = new TextDecoder().decode(readFixture(demo())).replace("DE89370400440532013000", iban);
    const doc = await loadDocument(new TextEncoder().encode(xml), "iban.xml");
    return (await validateInvoice(doc.xml, doc.invoice)).issues.map((i) => i.ruleId);
  };
  it("accepts a valid IBAN (needs exact 24 digit arithmetic)", async () => {
    expect(await run("DE89370400440532013000")).not.toContain("BR-DE-19");
    expect(await run("DE02120300000000202051")).not.toContain("BR-DE-19");
  });
  it("warns about an IBAN with a wrong check digit", async () => {
    expect(await run("DE89370400440532013001")).toContain("BR-DE-19");
  });
});
