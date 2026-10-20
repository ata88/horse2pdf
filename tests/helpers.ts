import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import type { Invoice } from "../src/core/model";

export const FIXTURES = join(import.meta.dirname, "fixtures");

export function fixtureFiles(ext: RegExp = /\.(xml|pdf)$/i): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (ext.test(e.name)) out.push(p);
    }
  };
  walk(FIXTURES);
  return out.sort();
}

export const rel = (p: string) => relative(FIXTURES, p);

export function readFixture(p: string): Uint8Array {
  return new Uint8Array(readFileSync(p));
}

const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: SaxonJS has no types
export const SaxonJS: any = require("saxon-js");

const sefCache = new Map<string, unknown>();
export function transform(sefPath: string, xml: string): string {
  let sef = sefCache.get(sefPath);
  if (!sef) {
    sef = JSON.parse(readFileSync(sefPath, "utf8"));
    sefCache.set(sefPath, sef);
  }
  return SaxonJS.transform({ stylesheetInternal: sef, sourceText: xml, destination: "serialized" }, "sync")
    .principalResult as string;
}

// ---------------------------------------------------------------------------
// KoSIT reference mapping (xrechnung-visualization), see tests/oracle.test.ts

const ORACLES = join(import.meta.dirname, "../.cache/rules/oracles");
const XR_NS = "urn:ce.eu:en16931:2017:xoev-de:kosit:standard:xrechnung-1";

/** Terms we deliberately represent differently (documented in AGENTS.md). */
export const SKIP = new Set([
  "BT-125", // binary content – we compare the attachment separately
]);

export function norm(id: string, v: string): string {
  const s = v.replace(/\s+/g, " ").trim();
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return String(Number(s));
  if (id === "BT-22") return s.replace(/^#[A-Z0-9]{3}#\s*/, "");
  return s;
}

export function oracleTerms(xr: string): string[] {
  const doc = new DOMParser().parseFromString(xr, "application/xml");
  const out: string[] = [];
  const walk = (el: Element) => {
    const id = el.getAttributeNS(XR_NS, "id");
    let hasElementChild = false;
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1) {
        hasElementChild = true;
        walk(n as Element);
      }
    }
    if (id && /^BT-(DEX-)?\d+$/.test(id) && !hasElementChild && !SKIP.has(id)) {
      const v = el.textContent ?? "";
      if (!v.trim()) return;
      out.push(`${id} = ${norm(id, v)}`);
      // UBL carries the note subject code (BT-21) as "#CODE#text" prefix – KoSIT keeps it inline.
      const code = id === "BT-22" ? /^\s*#([A-Z0-9]{3})#/.exec(v)?.[1] : undefined;
      if (code) out.push(`BT-21 = ${code}`);
    }
  };
  walk(doc.documentElement as unknown as Element);
  // A reference with DocumentTypeCode 130 is the invoiced object (BT-18), not a supporting
  // document – KoSIT lists it under both, we only under BT-18 (as Peppol BIS mandates).
  const objectIds = new Set(out.filter((t) => t.startsWith("BT-18 = ")).map((t) => t.slice(8)));
  const filtered = out.filter((t) => !(t.startsWith("BT-122 = ") && objectIds.has(t.slice(9))));
  // BT-8 is a document level term; CII repeats it in every VAT breakdown.
  const bt8 = filtered.filter((t) => t.startsWith("BT-8 = "));
  return [...filtered.filter((t) => !t.startsWith("BT-8 = ")), ...new Set(bt8)].sort();
}

/** The KoSIT reference list of "BT-x = value" entries for an invoice. */
export function kositTerms(invoice: Invoice, xml: string): string[] {
  const sef =
    invoice.syntax === "CII"
      ? "kosit-cii-xr"
      : invoice.kind === "creditNote"
        ? "kosit-ubl-creditnote-xr"
        : "kosit-ubl-invoice-xr";
  return oracleTerms(transform(join(ORACLES, `${sef}.sef.json`), xml));
}

/** Multiset difference a \ b. */
export function diff(a: string[], b: string[]): string[] {
  const counts = new Map<string, number>();
  for (const x of b) counts.set(x, (counts.get(x) ?? 0) + 1);
  const out: string[] = [];
  for (const x of a) {
    const c = counts.get(x) ?? 0;
    if (c > 0) counts.set(x, c - 1);
    else out.push(x);
  }
  return out;
}

// ---------------------------------------------------------------------------
// pdfmake for Node (same fonts as the browser bundle)

import type { PdfMakeLike } from "../src/export/pdf";

let nodePdfMake: PdfMakeLike | undefined;
export function getNodePdfMake(): PdfMakeLike {
  if (!nodePdfMake) {
    const pm = require("pdfmake");
    const dir = join(require.resolve("pdfmake/package.json"), "../build/fonts/Roboto");
    for (const f of [
      "Roboto-Regular.ttf",
      "Roboto-Medium.ttf",
      "Roboto-Italic.ttf",
      "Roboto-MediumItalic.ttf",
    ]) {
      pm.virtualfs.writeFileSync(f, readFileSync(join(dir, f)));
    }
    pm.setFonts({
      Roboto: {
        normal: "Roboto-Regular.ttf",
        bold: "Roboto-Medium.ttf",
        italics: "Roboto-Italic.ttf",
        bolditalics: "Roboto-MediumItalic.ttf",
      },
    });
    pm.setUrlAccessPolicy(() => false);
    pm.setLocalAccessPolicy(() => false);
    nodePdfMake = pm;
  }
  return nodePdfMake!;
}
