import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeXml, loadDocument, UnsupportedDocumentError } from "../src/core/load";
import { FIXTURES, fixtureFiles, readFixture, rel } from "./helpers";

const enc = (s: string) => new TextEncoder().encode(s);
const orgaMax = () => readFixture(join(FIXTURES, "custom/orgaMAX_Beispielrechnung_XRechnung.xml"));

/** A tiny valid PDF without attachments. */
const PLAIN_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF`;

describe("loadDocument", () => {
  it("loads every fixture and finds number, date and totals", async () => {
    for (const f of fixtureFiles()) {
      const d = await loadDocument(readFixture(f), f);
      expect(d.invoice.number, rel(f)).toBeTruthy();
      expect(d.invoice.issueDate, rel(f)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.invoice.totals.payable, rel(f)).toBeTypeOf("number");
      expect(d.invoice.seller.name, rel(f)).toBeTruthy();
    }
  });

  it("extracts the XML from ZUGFeRD / Factur-X PDFs and keeps the PDF", async () => {
    const f = join(FIXTURES, "zugferd/zugferd_2p0_EN16931_Einfach.pdf");
    const d = await loadDocument(readFixture(f), "x.pdf");
    expect(d.container).toBe("pdf");
    expect(d.embeddedXmlName).toBe("zugferd-invoice.xml");
    expect(d.originalPdf?.source).toBe("container");
    expect(d.invoice.syntax).toBe("CII");
    expect(d.invoice.profile.name).toBe("ZUGFeRD / Factur-X EN 16931");
  });

  it("uses an embedded PDF attachment of an XRechnung as original", async () => {
    const f = fixtureFiles().find((x) => x.endsWith("01.15a-INVOICE_ubl.xml"))!;
    const d = await loadDocument(readFixture(f), "x.xml");
    expect(d.invoice.attachments.some((a) => a.mimeType === "application/pdf")).toBe(true);
    expect(d.originalPdf?.source).toBe("attachment");
    expect(new TextDecoder().decode(d.originalPdf!.bytes.subarray(0, 5))).toBe("%PDF-");
  });

  it("unwraps a Peppol SBDH envelope", async () => {
    const inner = new TextDecoder().decode(orgaMax()).replace(/^<\?xml[^>]*>/, "");
    const sbdh = `<?xml version="1.0"?><StandardBusinessDocument xmlns="http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader"><StandardBusinessDocumentHeader><HeaderVersion>1.0</HeaderVersion></StandardBusinessDocumentHeader>${inner}</StandardBusinessDocument>`;
    const d = await loadDocument(enc(sbdh), "sbdh.xml");
    expect(d.invoice.number).toBe("000073");
  });

  it("handles a UTF-8 BOM and UTF-16 files", async () => {
    const text = new TextDecoder().decode(orgaMax());
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...orgaMax()]);
    expect((await loadDocument(bom, "bom.xml")).invoice.seller.address?.line1).toBe("Test");
    const utf16 = new Uint8Array(2 + text.length * 2);
    utf16[0] = 0xff;
    utf16[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      utf16[2 + i * 2] = text.charCodeAt(i) & 0xff;
      utf16[3 + i * 2] = text.charCodeAt(i) >> 8;
    }
    const d = await loadDocument(utf16, "utf16.xml");
    expect(d.invoice.buyer.address?.line1).toBe("Musterstraße 1");
  });

  it("decodes ISO-8859-1 declared files", () => {
    const bytes = new Uint8Array([
      ...enc('<?xml version="1.0" encoding="ISO-8859-1"?><a>'),
      0xdf,
      ...enc("</a>"),
    ]);
    expect(decodeXml(bytes)).toContain("<a>ß</a>");
  });

  it.each([
    ["not xml", enc("hello world"), /kein gültiges XML/],
    ["other xml", enc("<order xmlns='urn:x'/>"), /Unbekanntes Rechnungsformat/],
    [
      "zugferd 1",
      enc("<rsm:CrossIndustryDocument xmlns:rsm='urn:ferd:CrossIndustryDocument:invoice:1p0'/>"),
      /ZUGFeRD 1\.0/,
    ],
    ["plain pdf", enc(PLAIN_PDF), /keine eingebettete E-Rechnung/],
  ])("rejects %s with a helpful message", async (_n, bytes, msg) => {
    await expect(loadDocument(bytes, "x")).rejects.toThrow(UnsupportedDocumentError);
    await expect(loadDocument(bytes, "x")).rejects.toThrow(msg);
  });
});
