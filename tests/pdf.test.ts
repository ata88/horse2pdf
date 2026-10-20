/**
 * PDF export: renders every fixture and checks that the essential values really end
 * up in the PDF text (and that the original XML is embedded unchanged).
 */
import { describe, expect, it } from "vitest";
import { money, quantity } from "../src/core/format";
import { loadDocument } from "../src/core/load";
import { listEmbeddedFiles, loadPdfjs } from "../src/core/pdf";
import { buildPdfDefinition, renderPdf } from "../src/export/pdf";
import { fixtureFiles, getNodePdfMake, readFixture, rel } from "./helpers";

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const c = await page.getTextContent();
    text += `${c.items.map((i) => ("str" in i ? i.str : "")).join(" ")}\n`;
  }
  await task.destroy();
  return text.replace(/\s+/g, " ");
}

const squash = (s: string) => s.replace(/\s+/g, "");

describe("PDF export", () => {
  it.each(fixtureFiles().map((f) => [rel(f), f]))("%s", async (_n, f) => {
    const doc = await loadDocument(readFixture(f), f);
    const inv = doc.invoice;
    const bytes = await renderPdf(getNodePdfMake(), buildPdfDefinition(doc, { now: new Date("2026-01-01") }));
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");

    const text = squash(await pdfText(bytes));
    const must = [
      inv.number,
      inv.seller.name,
      inv.buyer.name,
      money(inv.totals.payable, inv.currency),
      money(inv.totals.taxInclusive, inv.currency),
      ...inv.vatBreakdown.map((v) => money(v.taxAmount, inv.currency)),
    ];
    const walk = (lines: typeof inv.lines) => {
      for (const l of lines) {
        must.push(l.item.name, money(l.netAmount, inv.currency), quantity(l.quantity));
        walk(l.subLines);
      }
    };
    walk(inv.lines);
    for (const m of must.filter((x): x is string => !!x)) {
      expect(text, `missing "${m}"`).toContain(squash(m));
    }

    const embedded = await listEmbeddedFiles(bytes);
    expect(embedded).toHaveLength(1);
    expect(new TextDecoder().decode(embedded[0]!.content)).toBe(doc.xml);
  });
});
