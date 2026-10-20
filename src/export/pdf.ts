/**
 * PDF export: a clean, print-ready rendering of the complete invoice.
 *
 * `buildPdfDefinition` is a pure function (unit tested); rendering is delegated to a
 * pdfmake instance that is created per environment (browser bundle or Node).
 * The original XML is embedded as a PDF attachment so the export stays machine readable.
 */
import type { Content, ContentTable, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { ID_SCHEMES, label } from "../core/codelists";
import { addressLines, date, fileSize, money, quantity } from "../core/format";
import { buildGiroCode } from "../core/girocode";
import type { Invoice, LoadedDocument, Party } from "../core/model";
import {
  allowanceChargeText,
  deliveryRows,
  documentTitle,
  exemptionText,
  headerRows,
  lineDetails,
  noteSubject,
  partyRows,
  paymentRows,
  type Row,
  referenceRows,
  totalRows,
  unitShort,
  vatBreakdownLabel,
  vatLabel,
} from "../core/present";
import { invoiceTerms, termLabel } from "../core/terms";
import type { ValidationReport } from "../core/validate";

export interface PdfOptions {
  report?: ValidationReport;
  /** Include the appendix with every business term (default true). */
  includeAllTerms?: boolean;
  appName?: string;
  appVersion?: string;
  now?: Date;
}

const C = {
  ink: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
  soft: "#f3f4f6",
  accent: "#0f766e",
  accentSoft: "#ecfdf5",
  error: "#b91c1c",
  warning: "#b45309",
  ok: "#047857",
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const sectionTitle = (text: string, pageBreak?: "before"): Content => ({
  text: text.toUpperCase(),
  style: "section",
  pageBreak,
});

function keyValueTable(rows: Row[], widths: [number | string, number | string] = [110, "*"]): Content {
  if (!rows.length) return { text: "" };
  return {
    table: {
      widths,
      body: rows.map(([k, v]) => [{ text: k, color: C.muted }, { text: v }]),
    },
    layout: "noBorders",
    fontSize: 8.5,
  };
}

/** Puts a block into a `columns` entry with a fixed or flexible width. */
function withWidth(width: number | string, content: Content): Content {
  return { width, ...(content as object) } as unknown as Content;
}

function partyCard(title: string, p: Party | undefined): Content | undefined {
  if (!p) return undefined;
  const rows = partyRows(p);
  return {
    unbreakable: true,
    stack: [
      { text: title, style: "cardTitle" },
      { text: p.name ?? "", bold: true, margin: [0, 0, 0, 2] },
      ...addressLines(p.address).map((l) => ({ text: l })),
      rows.length ? { ...(keyValueTable(rows, [85, "*"]) as object), margin: [0, 4, 0, 0] } : { text: "" },
    ] as Content[],
    fontSize: 8.5,
    margin: [0, 0, 0, 10],
  };
}

function linesTable(inv: Invoice): ContentTable {
  const cur = inv.currency;
  const body: TableCell[][] = [
    [
      { text: "Pos.", style: "th" },
      { text: "Bezeichnung", style: "th" },
      { text: "Menge", style: "th", alignment: "right" },
      { text: "Einheit", style: "th" },
      { text: "Einzelpreis", style: "th", alignment: "right" },
      { text: "USt", style: "th", alignment: "right" },
      { text: "Gesamt netto", style: "th", alignment: "right" },
    ],
  ];
  const addLine = (l: Invoice["lines"][number], depth: number) => {
    const details = lineDetails(l, cur);
    body.push([
      { text: l.id, color: C.muted },
      {
        stack: [
          { text: l.item.name ?? "", bold: depth === 0 },
          ...details.map((d) => ({ text: d, fontSize: 7.5, color: C.muted })),
        ],
        margin: [depth * 10, 0, 0, 0],
      },
      { text: quantity(l.quantity), alignment: "right" },
      { text: unitShort(l.unit) },
      { text: money(l.price.net, cur), alignment: "right" },
      { text: vatLabel(l.vatCategory, l.vatRate), alignment: "right" },
      { text: money(l.netAmount, cur), alignment: "right", bold: depth === 0 },
    ]);
    for (const s of l.subLines) addLine(s, depth + 1);
  };
  for (const l of inv.lines) addLine(l, 0);
  return {
    table: { headerRows: 1, dontBreakRows: true, widths: [26, "*", 40, 38, 62, 34, 66], body },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: (i: number) => (i === 1 ? C.ink : C.line),
      paddingTop: () => 4,
      paddingBottom: () => 4,
      fillColor: (row: number) => (row === 0 ? C.soft : null),
    },
    fontSize: 8.5,
  };
}

function totalsTable(inv: Invoice): Content {
  const rows = totalRows(inv);
  return {
    columns: [
      { width: "*", text: "" },
      {
        width: 270,
        table: {
          widths: ["*", "auto"],
          body: rows.map((r) => [
            { text: r.label, bold: r.strong, fontSize: r.strong ? 10 : 8.5 },
            {
              text: money(r.value, r.currency ?? inv.currency),
              alignment: "right",
              bold: r.strong,
              fontSize: r.strong ? 10 : 8.5,
            },
          ]),
        },
        layout: {
          hLineWidth: (i: number) => (i > 0 && i < rows.length && rows[i]?.strong ? 0.8 : 0),
          vLineWidth: () => 0,
          hLineColor: () => C.ink,
          fillColor: (i: number) => (i === rows.length - 1 ? C.accentSoft : null),
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
    margin: [0, 8, 0, 0],
  };
}

function vatTable(inv: Invoice): Content | undefined {
  if (!inv.vatBreakdown.length) return undefined;
  const cur = inv.currency;
  return {
    table: {
      widths: ["*", 110, 90],
      headerRows: 1,
      body: [
        [
          { text: "Umsatzsteuer", style: "th" },
          { text: "Bemessungsgrundlage", style: "th", alignment: "right" },
          { text: "Steuerbetrag", style: "th", alignment: "right" },
        ],
        ...inv.vatBreakdown.map((v): TableCell[] => {
          const exemption = exemptionText(v.exemptionReason, v.exemptionReasonCode);
          return [
            {
              stack: [
                { text: `${vatBreakdownLabel(v.category, v.rate)} (Kategorie ${v.category})` },
                ...(exemption ? [{ text: exemption, fontSize: 7.5, color: C.muted }] : []),
              ],
            },
            { text: money(v.taxableAmount, cur), alignment: "right" },
            { text: money(v.taxAmount, cur), alignment: "right" },
          ];
        }),
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 8.5,
  };
}

function allowancesTable(inv: Invoice): Content | undefined {
  if (!inv.allowancesCharges.length) return undefined;
  return {
    table: {
      widths: ["*", 90],
      body: inv.allowancesCharges.map((ac) => {
        const t = allowanceChargeText(ac, inv.currency);
        return [
          {
            stack: [
              { text: t.label },
              ...(t.detail ? [{ text: t.detail, fontSize: 7.5, color: C.muted }] : []),
            ],
          },
          { text: `${ac.isCharge ? "+" : "−"}${money(ac.amount, inv.currency)}`, alignment: "right" },
        ];
      }),
    },
    layout: "lightHorizontalLines",
    fontSize: 8.5,
  };
}

function paymentSection(inv: Invoice): Content[] {
  const rows = paymentRows(inv);
  if (!rows.length) return [];
  const giro = buildGiroCode(inv);
  return [
    sectionTitle("Zahlung"),
    {
      unbreakable: true,
      columns: [
        withWidth("*", keyValueTable(rows)),
        giro
          ? {
              width: 100,
              stack: [
                { qr: giro.payload, fit: 92, eccLevel: "M", alignment: "center" },
                {
                  text: "GiroCode – mit der Banking-App scannen",
                  fontSize: 6.5,
                  color: C.muted,
                  alignment: "center",
                  margin: [0, 3, 0, 0],
                },
              ],
            }
          : { width: 0, text: "" },
      ],
      columnGap: 12,
    } as Content,
  ];
}

function validationSection(report: ValidationReport): Content[] {
  const status = report.valid
    ? report.counts.warning
      ? { text: "Gültig – mit Hinweisen", color: C.warning }
      : { text: "Gültig", color: C.ok }
    : { text: "Nicht gültig", color: C.error };
  const sevText = { error: "Fehler", warning: "Warnung", info: "Info" } as const;
  const sevColor = { error: C.error, warning: C.warning, info: C.muted } as const;
  return [
    sectionTitle("Prüfergebnis"),
    {
      text: [
        { text: `${status.text}  `, bold: true, color: status.color },
        {
          text: `${report.counts.error} Fehler · ${report.counts.warning} Warnungen · ${report.counts.info} Hinweise – geprüft mit ${report.ruleSets.map((r) => `${r.name} ${r.version}`).join(", ") || "–"}`,
          color: C.muted,
        },
      ],
      fontSize: 8.5,
      margin: [0, 0, 0, 4],
    },
    ...report.notes.map((n) => ({ text: n, fontSize: 7.5, color: C.muted, margin: [0, 0, 0, 2] }) as Content),
    report.issues.length
      ? {
          table: {
            widths: [44, 70, "*"],
            body: report.issues.map((i) => [
              { text: sevText[i.severity], color: sevColor[i.severity], bold: true },
              { text: i.ruleId },
              { text: i.message },
            ]),
          },
          layout: "lightHorizontalLines",
          fontSize: 7.5,
        }
      : { text: "" },
  ];
}

function termsAppendix(inv: Invoice): Content[] {
  const body: TableCell[][] = [];
  const walk = (nodes: ReturnType<typeof invoiceTerms>, depth: number) => {
    for (const n of nodes) {
      if (n.children) {
        body.push([
          { text: n.id, color: C.muted, bold: true },
          { text: termLabel(n.id), bold: true, colSpan: 2, margin: [depth * 8, 0, 0, 0] },
          {},
        ]);
        walk(n.children, depth + 1);
      } else {
        const scheme = n.scheme ? ` [${label(ID_SCHEMES, n.scheme) ?? n.scheme}]` : "";
        body.push([
          { text: n.id, color: C.muted },
          { text: termLabel(n.id), margin: [depth * 8, 0, 0, 0], color: C.muted },
          { text: `${n.value ?? ""}${scheme}` },
        ]);
      }
    }
  };
  walk(invoiceTerms(inv), 0);
  return [
    sectionTitle("Alle Angaben nach EN 16931", "before"),
    {
      text: "Vollständige Liste aller in der E-Rechnung enthaltenen Geschäftsbegriffe (BT) und -gruppen (BG) mit den Originalwerten.",
      fontSize: 8,
      color: C.muted,
      margin: [0, 0, 0, 6],
    },
    {
      table: { headerRows: 0, widths: [52, 150, "*"], body },
      layout: "lightHorizontalLines",
      fontSize: 7.5,
    },
  ];
}

export function buildPdfDefinition(doc: LoadedDocument, opts: PdfOptions = {}): TDocumentDefinitions {
  const inv = doc.invoice;
  const cur = inv.currency;
  const title = documentTitle(inv);
  const now = opts.now ?? new Date();
  const appName = opts.appName ?? "horse2pdf";

  const sender = [inv.seller.name, ...addressLines(inv.seller.address)].filter(Boolean).join(" · ");

  const content: Content[] = [
    // Header
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: inv.seller.name ?? "", fontSize: 15, bold: true },
            ...addressLines(inv.seller.address).map((l) => ({ text: l, color: C.muted, fontSize: 9 })),
          ],
        },
        {
          width: "auto",
          stack: [
            { text: title, fontSize: 20, bold: true, color: C.accent, alignment: "right" },
            { text: inv.profile.name, fontSize: 8, color: C.muted, alignment: "right" },
            ...(opts.report
              ? [
                  {
                    text: opts.report.valid
                      ? opts.report.counts.warning
                        ? "Prüfung: gültig, mit Hinweisen"
                        : "Prüfung: gültig"
                      : `Prüfung: ${opts.report.counts.error} Fehler`,
                    fontSize: 8,
                    bold: true,
                    color: opts.report.valid ? (opts.report.counts.warning ? C.warning : C.ok) : C.error,
                    alignment: "right" as const,
                    margin: [0, 2, 0, 0] as [number, number, number, number],
                  },
                ]
              : []),
          ],
        },
      ],
      margin: [0, 0, 0, 22],
    },
    // Recipient + facts
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: sender, fontSize: 6.5, color: C.muted, decoration: "underline", margin: [0, 0, 0, 6] },
            { text: inv.buyer.name ?? "", bold: true, fontSize: 10 },
            ...addressLines(inv.buyer.address).map((l) => ({ text: l, fontSize: 10 })),
          ],
        },
        withWidth(230, keyValueTable(headerRows(inv), [105, "*"])),
      ],
      columnGap: 20,
      margin: [0, 0, 0, 18],
    },
  ];

  if (inv.notes.length) {
    content.push({
      stack: inv.notes.map((n) => ({
        text: [
          ...(n.subjectCode ? [{ text: `${noteSubject(n.subjectCode)}: `, color: C.muted }] : []),
          { text: n.text },
        ],
        margin: [0, 0, 0, 3],
      })),
      fontSize: 8.5,
      margin: [0, 0, 0, 12],
    });
  }

  content.push(sectionTitle(`Positionen (${countLines(inv.lines)})`), linesTable(inv), totalsTable(inv));

  const vat = vatTable(inv);
  if (vat) content.push(sectionTitle("Umsatzsteuer"), vat);
  const ac = allowancesTable(inv);
  if (ac) content.push(sectionTitle("Nachlässe und Zuschläge auf Dokumentebene"), ac);
  content.push(...paymentSection(inv));

  // Parties
  content.push(sectionTitle("Beteiligte"));
  const cards = [
    partyCard("Verkäufer", inv.seller),
    partyCard("Käufer", inv.buyer),
    partyCard("Zahlungsempfänger", inv.payee),
    partyCard("Steuervertreter des Verkäufers", inv.sellerTaxRepresentative),
  ].filter((c): c is Content => !!c);
  for (let i = 0; i < cards.length; i += 2) {
    content.push({ columns: [cards[i]!, cards[i + 1] ?? { text: "" }], columnGap: 20 });
  }
  const delivery = deliveryRows(inv);
  const deliveryAddr = addressLines(inv.delivery?.address);
  if (delivery.length || deliveryAddr.length) {
    content.push(sectionTitle("Lieferung"), {
      columns: [
        withWidth("*", keyValueTable(delivery)),
        { width: "*", stack: deliveryAddr.map((l) => ({ text: l })), fontSize: 8.5 },
      ],
      columnGap: 20,
    } as Content);
  }

  content.push(sectionTitle("Referenzen"), keyValueTable(referenceRows(inv), [140, "*"]));

  if (inv.attachments.length) {
    content.push(sectionTitle("Rechnungsbegründende Unterlagen"), {
      table: {
        widths: ["*", 140, 50],
        body: inv.attachments.map((a) => [
          {
            stack: [
              { text: a.id, bold: true },
              ...(a.description ? [{ text: a.description, color: C.muted }] : []),
            ],
          },
          { text: a.filename ?? a.externalUri ?? "" },
          { text: a.content ? fileSize(a.size) : a.externalUri ? "Link" : "", alignment: "right" },
        ]),
      },
      layout: "lightHorizontalLines",
      fontSize: 8.5,
    });
  }

  if (opts.report) content.push(...validationSection(opts.report));
  if (opts.includeAllTerms !== false) content.push(...termsAppendix(inv));

  const xmlName =
    doc.embeddedXmlName ?? (doc.fileName.replace(/^.*[\\/]/, "").replace(/\.pdf$/i, ".xml") || "invoice.xml");

  return {
    pageSize: "A4",
    pageMargins: [48, 44, 48, 56],
    info: {
      title: `${title} ${inv.number ?? ""}`.trim(),
      author: inv.seller.name ?? "",
      subject: `${title} ${inv.number ?? ""} – ${inv.buyer.name ?? ""}`,
      creator: `${appName}${opts.appVersion ? ` ${opts.appVersion}` : ""}`,
      producer: appName,
    },
    defaultStyle: { font: "Roboto", fontSize: 9, color: C.ink, lineHeight: 1.15 },
    styles: {
      section: { fontSize: 8, bold: true, color: C.accent, characterSpacing: 0.8, margin: [0, 16, 0, 6] },
      th: { bold: true, fontSize: 8, color: C.ink },
      cardTitle: { fontSize: 7.5, bold: true, color: C.muted, characterSpacing: 0.5, margin: [0, 0, 0, 3] },
    },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [48, 18, 48, 0],
      columns: [
        {
          text: `${title} ${inv.number ?? ""} · ${inv.seller.name ?? ""} · ${money(inv.totals.payable, cur)} · Darstellung der E-Rechnung, erstellt am ${date(now.toISOString().slice(0, 10))} mit ${appName}`,
          fontSize: 6.5,
          color: C.muted,
        },
        {
          text: `Seite ${currentPage} von ${pageCount}`,
          alignment: "right",
          fontSize: 7,
          color: C.muted,
          width: 70,
        },
      ],
    }),
    // Embedded original XML (pdfmake `files`, not yet part of the type definitions).
    ...({
      files: {
        [xmlName]: {
          src: `data:application/xml;base64,${bytesToBase64(new TextEncoder().encode(doc.xml))}`,
          name: xmlName,
          description: "Original E-Rechnung (XML)",
          type: "application/xml",
        },
      },
    } as object),
  };
}

function countLines(lines: Invoice["lines"]): number {
  return lines.reduce((n, l) => n + 1 + countLines(l.subLines), 0);
}

/** Minimal surface of a pdfmake instance (browser bundle or Node module). */
export interface PdfMakeLike {
  createPdf(def: TDocumentDefinitions): { getBuffer(): Promise<Uint8Array | ArrayBuffer> };
}

export async function renderPdf(pdfmake: PdfMakeLike, def: TDocumentDefinitions): Promise<Uint8Array> {
  const buf = await pdfmake.createPdf(def).getBuffer();
  // Always a plain Uint8Array (Node returns a Buffer subclass, which pdf.js rejects).
  return new Uint8Array(buf);
}

/** Browser/Tauri: lazily loads the pdfmake bundle with the Roboto fonts. */
let browserPdfMake: Promise<PdfMakeLike> | undefined;
export function loadBrowserPdfMake(): Promise<PdfMakeLike> {
  browserPdfMake ??= (async () => {
    const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
      import("pdfmake/build/pdfmake"),
      import("pdfmake/build/vfs_fonts"),
    ]);
    const pm = pdfMake as unknown as PdfMakeLike & { addVirtualFileSystem(v: unknown): void };
    pm.addVirtualFileSystem(vfs);
    return pm;
  })();
  return browserPdfMake;
}

export async function exportInvoicePdf(doc: LoadedDocument, opts: PdfOptions = {}): Promise<Uint8Array> {
  return renderPdf(await loadBrowserPdfMake(), buildPdfDefinition(doc, opts));
}
