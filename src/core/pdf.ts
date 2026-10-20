/**
 * Access to PDF files via pdf.js: extracting embedded files (ZUGFeRD / Factur-X XML)
 * and rendering pages for the "Original PDF" view.
 *
 * pdf.js is loaded lazily. The browser/Tauri build uses the default loader below;
 * Node (tests) registers the legacy build via `setPdfjsLoader`.
 */
import type * as PdfJs from "pdfjs-dist";

type PdfJsModule = typeof PdfJs;

let loader: () => Promise<PdfJsModule> = async () => {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
};
let cached: Promise<PdfJsModule> | undefined;

export function setPdfjsLoader(fn: () => Promise<PdfJsModule>): void {
  loader = fn;
  cached = undefined;
}

export function loadPdfjs(): Promise<PdfJsModule> {
  cached ??= loader();
  return cached;
}

export function isPdf(bytes: Uint8Array): boolean {
  // "%PDF" may be preceded by a little garbage – the spec tolerates up to 1024 bytes.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

export interface EmbeddedFile {
  name: string;
  description?: string;
  content: Uint8Array;
}

/** Opens a PDF. Call `destroy()` on the returned loading task when done. */
export async function openPdf(bytes: Uint8Array) {
  const pdfjs = await loadPdfjs();
  // pdf.js transfers (detaches) the buffer it gets – always hand it a copy.
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  return { task, doc: await task.promise };
}

export async function listEmbeddedFiles(bytes: Uint8Array): Promise<EmbeddedFile[]> {
  const { task, doc } = await openPdf(bytes);
  try {
    const attachments = await doc.getAttachments();
    if (!attachments) return [];
    const files: EmbeddedFile[] = [];
    for (const [id, att] of attachments) {
      const content = att.content ?? (await doc.getAttachmentContent(id));
      if (!content) continue;
      files.push({ name: att.filename || att.rawFilename || id, description: att.description, content });
    }
    return files;
  } finally {
    await task.destroy();
  }
}

/** File names used by the standards, in order of preference. */
const KNOWN_XML_NAMES = [
  "factur-x.xml",
  "zugferd-invoice.xml",
  "xrechnung.xml",
  "zugferd_invoice.xml",
  "zugferd-invoice.xml",
];

export function pickInvoiceXml(files: EmbeddedFile[]): EmbeddedFile | undefined {
  const xml = files.filter((f) => /\.xml$/i.test(f.name));
  for (const known of KNOWN_XML_NAMES) {
    const hit = xml.find((f) => f.name.toLowerCase() === known);
    if (hit) return hit;
  }
  const decoder = new TextDecoder();
  return xml.find((f) =>
    /CrossIndustryInvoice|CrossIndustryDocument|ubl:schema:xsd:(Invoice|CreditNote)-2/.test(
      decoder.decode(f.content.subarray(0, 4096)),
    ),
  );
}
