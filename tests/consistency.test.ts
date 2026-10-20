/**
 * Semantic consistency checks that catch swapped or mis-assigned amounts:
 *  - UBL and CII renderings of the same KoSIT business case yield identical terms.
 *  - The EN 16931 calculation rules (BR-CO-10 … BR-CO-16) hold on the parsed model.
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadDocument } from "../src/core/load";
import type { Invoice } from "../src/core/model";
import { flattenTerms, invoiceTerms } from "../src/core/terms";
import { diff, fixtureFiles, kositTerms, norm, readFixture, rel } from "./helpers";

const loadFull = (f: string) => loadDocument(readFixture(f), f);
const load = async (f: string) => (await loadFull(f)).invoice;

/** Terms whose syntax representation legitimately differs between UBL and CII. */
const SYNTAX_SPECIFIC = new Set(["BT-24"]);
/** Optional totals that some test files state explicitly as 0 in one syntax only. */
const ZERO_OPTIONAL = new Set(["BT-107", "BT-108", "BT-113", "BT-114"]);

/** Path-qualified term list, minus entries whose flat "BT = value" is in `ignore`. */
function termList(inv: Invoice, ignore: Set<string>): string[] {
  return flattenTerms(invoiceTerms(inv))
    .filter((t) => !SYNTAX_SPECIFIC.has(t.id))
    .filter((t) => !(ZERO_OPTIONAL.has(t.id) && Number(t.value) === 0))
    .filter((t) => !ignore.has(`${t.id} = ${norm(t.id, t.value ?? "")}`))
    .map((t) => `${[...t.path, t.id].join("/")} = ${norm(t.id, t.value ?? "")}`)
    .sort();
}

const pairs = fixtureFiles(/a-INVOICE_ubl\.xml$/)
  .map((ubl) => [ubl, ubl.replace(/_ubl\.xml$/, "_uncefact.xml")] as const)
  .filter(([, cii]) => existsSync(cii));

describe("UBL and CII variants of the same business case are parsed identically", () => {
  it("has pairs to compare", () => expect(pairs.length).toBeGreaterThan(25));

  it.each(pairs.map(([u, c]) => [rel(u), u, c]))("%s", async (_n, ubl, cii) => {
    const [a, b] = await Promise.all([loadFull(ubl), loadFull(cii)]);
    // The two KoSIT test files are not always 100% identical in content. Whatever the
    // official reference mapping also sees as different is a data difference, not ours.
    const ka = kositTerms(a.invoice, a.xml);
    const kb = kositTerms(b.invoice, b.xml);
    const dataDiff = new Set([...diff(ka, kb), ...diff(kb, ka)]);
    expect(termList(b.invoice, dataDiff)).toEqual(termList(a.invoice, dataDiff));
  });
});

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));

describe("EN 16931 calculation rules hold on the parsed model", () => {
  const files = fixtureFiles();
  it.each(files.map((f) => [rel(f), f]))("%s", async (_n, f) => {
    const inv = await load(f);
    if (!inv.profile.isEn16931Compliant) return; // MINIMUM / BASIC WL carry no lines
    const t = inv.totals;
    const docAllowances = sum(inv.allowancesCharges.filter((a) => !a.isCharge).map((a) => a.amount));
    const docCharges = sum(inv.allowancesCharges.filter((a) => a.isCharge).map((a) => a.amount));

    // BR-CO-10: Sum of invoice line net amounts
    const topLevel = inv.lines.filter((l) => l.lineStatus !== "INFORMATION");
    expect(sum(topLevel.map((l) => l.netAmount ?? 0)), "BT-106").toBeCloseTo(t.lineNet ?? 0, 2);
    // BR-CO-11 / BR-CO-12
    expect(docAllowances, "BT-107").toBeCloseTo(t.allowances ?? 0, 2);
    expect(docCharges, "BT-108").toBeCloseTo(t.charges ?? 0, 2);
    // BR-CO-13
    expect(round2((t.lineNet ?? 0) - docAllowances + docCharges), "BT-109").toBeCloseTo(t.taxExclusive ?? 0, 2);
    // BR-CO-14: VAT total = sum of VAT breakdown
    expect(sum(inv.vatBreakdown.map((v) => v.taxAmount)), "BT-110").toBeCloseTo(t.tax ?? 0, 2);
    // BR-CO-15
    expect(round2((t.taxExclusive ?? 0) + (t.tax ?? 0)), "BT-112").toBeCloseTo(t.taxInclusive ?? 0, 2);
    // BR-CO-16
    // BR-CO-16 (+ BR-DEX-09: third party payments are added to the amount due)
    const thirdParty = sum(inv.thirdPartyPayments.map((p) => p.amount));
    expect(round2((t.taxInclusive ?? 0) - (t.prepaid ?? 0) + (t.rounding ?? 0) + thirdParty), "BT-115").toBeCloseTo(
      t.payable ?? 0,
      2,
    );
  });
});
