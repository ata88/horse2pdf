/**
 * Entry point: turns arbitrary file bytes (XML or PDF) into a LoadedDocument.
 */
import type { Container, Invoice, LoadedDocument } from "./model";
import { CII_NS, parseCii } from "./parse/cii";
import { parseUbl, UBL_NS } from "./parse/ubl";
import { isPdf, listEmbeddedFiles, pickInvoiceXml } from "./pdf";
import { parseXml, XmlError } from "./xml";

export class UnsupportedDocumentError extends Error {}

/** Words that mark a PDF attachment as the visual representation of the invoice itself. */
const INVOICE_WORDS = /rechnung|invoice|faktura|facture|fattura|gutschrift|credit.?note|beleg/i;

const ZUGFERD1_NS = "urn:ferd:CrossIndustryDocument:invoice:1p0";
const SBDH_NS = "http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader";

/** Decodes XML bytes honouring a BOM or the encoding declaration (UTF-8 default). */
export function decodeXml(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const enc = /encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(head)?.[1]?.toLowerCase();
  try {
    return new TextDecoder(enc && enc !== "utf8" ? enc : "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Finds the invoice root element, unwrapping a Peppol SBDH envelope if present. */
function invoiceRoot(root: Element): Element {
  if (root.namespaceURI === SBDH_NS) {
    for (let n = root.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1 && (n as Element).namespaceURI !== SBDH_NS) return n as Element;
    }
  }
  return root;
}

export function parseInvoiceXml(xml: string, container: Container = "xml"): Invoice {
  let root: Element;
  try {
    root = invoiceRoot(parseXml(xml));
  } catch (err) {
    throw new UnsupportedDocumentError(
      `Die Datei ist kein gültiges XML: ${err instanceof XmlError ? err.message : String(err)}`,
    );
  }
  const ns = root.namespaceURI;
  if (ns === UBL_NS.inv || ns === UBL_NS.cn) return parseUbl(root, container);
  if (ns === CII_NS.rsm && root.localName === "CrossIndustryInvoice") return parseCii(root, container);
  if (ns === ZUGFERD1_NS) {
    throw new UnsupportedDocumentError(
      "ZUGFeRD 1.0 wird nicht unterstützt. Bitte eine Rechnung nach ZUGFeRD 2.x, Factur-X oder XRechnung verwenden.",
    );
  }
  throw new UnsupportedDocumentError(
    `Unbekanntes Rechnungsformat (Wurzelelement „${root.localName}“${ns ? `, Namespace ${ns}` : ""}). ` +
      "Unterstützt werden UBL 2.1 und UN/CEFACT CII (XRechnung, ZUGFeRD 2.x, Factur-X, Peppol BIS 3.0).",
  );
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function loadDocument(bytes: Uint8Array, fileName: string): Promise<LoadedDocument> {
  const warnings: string[] = [];

  if (isPdf(bytes)) {
    let files: Awaited<ReturnType<typeof listEmbeddedFiles>>;
    try {
      files = await listEmbeddedFiles(bytes);
    } catch (err) {
      throw new UnsupportedDocumentError(`Die PDF-Datei konnte nicht gelesen werden: ${String(err)}`);
    }
    const embedded = pickInvoiceXml(files);
    if (!embedded) {
      throw new UnsupportedDocumentError(
        "Diese PDF enthält keine eingebettete E-Rechnung (ZUGFeRD / Factur-X). Es handelt sich um eine reine Bild-/Text-PDF.",
      );
    }
    if (files.filter((f) => /\.xml$/i.test(f.name)).length > 1) {
      warnings.push(`Die PDF enthält mehrere XML-Dateien – verwendet wird „${embedded.name}“.`);
    }
    const xml = decodeXml(embedded.content);
    return {
      fileName,
      container: "pdf",
      xml,
      invoice: parseInvoiceXml(xml, "pdf"),
      originalPdf: { bytes, source: "container", name: fileName, isInvoiceImage: true },
      embeddedXmlName: embedded.name,
      warnings,
    };
  }

  const xml = decodeXml(bytes);
  const invoice = parseInvoiceXml(xml, "xml");
  const pdfAttachments = invoice.attachments.filter(
    (a) => a.content && (a.mimeType === "application/pdf" || /\.pdf$/i.test(a.filename ?? "")),
  );
  const looksLikeInvoice = (a: (typeof pdfAttachments)[number]) =>
    INVOICE_WORDS.test([a.id, a.description, a.filename].filter(Boolean).join(" "));
  const pdfAttachment = pdfAttachments.find(looksLikeInvoice) ?? pdfAttachments[0];
  let originalPdf: LoadedDocument["originalPdf"];
  if (pdfAttachment?.content) {
    try {
      const pdfBytes = base64ToBytes(pdfAttachment.content);
      if (isPdf(pdfBytes)) {
        originalPdf = {
          bytes: pdfBytes,
          source: "attachment",
          name: pdfAttachment.filename ?? `${pdfAttachment.id}.pdf`,
          isInvoiceImage: looksLikeInvoice(pdfAttachment),
        };
      }
    } catch {
      warnings.push(`Der PDF-Anhang „${pdfAttachment.filename ?? pdfAttachment.id}“ ist beschädigt.`);
    }
  }
  return { fileName, container: "xml", xml, invoice, originalPdf, warnings };
}
