/**
 * Validation with the official Schematron rules (EN 16931, XRechnung, Peppol BIS),
 * compiled to SaxonJS SEF files by `scripts/build-rules.mjs`.
 *
 * Runs completely offline. The SaxonJS runtime and the SEF loader are injectable so
 * the same code works in the webview (SaxonJS2.rt.js + fetch) and in Node tests.
 */
import type { Invoice } from "./model";
import { parseXml, XPathLite } from "./xml";

export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  /** Rule id, e.g. "BR-CO-10" or "BR-DE-15". */
  ruleId: string;
  severity: Severity;
  message: string;
  /** XPath of the offending node as reported by the rule. */
  location?: string;
  /** XPath test of the assertion. */
  test?: string;
  ruleSet: string;
}

export interface RuleSetInfo {
  id: string;
  name: string;
  version: string;
  syntax: "UBL" | "CII";
  license?: string;
  homepage?: string;
  file: string;
}

export interface ValidationReport {
  ruleSets: RuleSetInfo[];
  issues: ValidationIssue[];
  /** Rule sets that should apply but could not be executed. */
  notes: string[];
  durationMs: number;
  counts: Record<Severity, number>;
  /** valid = no errors (warnings/infos allowed). */
  valid: boolean;
}

interface Manifest {
  ruleSets: RuleSetInfo[];
}

// biome-ignore lint/suspicious/noExplicitAny: SaxonJS ships no types
type SaxonJS = any;

export interface ValidationEnvironment {
  loadSaxon(): Promise<SaxonJS>;
  loadManifest(): Promise<Manifest>;
  loadSef(file: string): Promise<unknown>;
}

const baseUrl = (): string => {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
};

/** Browser / Tauri: SaxonJS runtime and rules are static assets of the app. */
const browserEnvironment: ValidationEnvironment = {
  loadSaxon: () =>
    new Promise((resolve, reject) => {
      const w = window as unknown as { SaxonJS?: SaxonJS };
      if (w.SaxonJS) return resolve(w.SaxonJS);
      const script = document.createElement("script");
      script.src = `${baseUrl()}vendor/saxon-js/SaxonJS2.rt.js`;
      script.onload = () => (w.SaxonJS ? resolve(w.SaxonJS) : reject(new Error("SaxonJS not available")));
      script.onerror = () => reject(new Error("SaxonJS konnte nicht geladen werden"));
      document.head.appendChild(script);
    }),
  loadManifest: async () => {
    const res = await fetch(`${baseUrl()}rules/manifest.json`);
    if (!res.ok) throw new Error("Prüfregeln nicht gefunden (rules/manifest.json)");
    return res.json();
  },
  loadSef: async (file) => {
    const res = await fetch(`${baseUrl()}rules/${file}`);
    if (!res.ok) throw new Error(`Prüfregel ${file} nicht gefunden`);
    return res.json();
  },
};

let env: ValidationEnvironment = browserEnvironment;
let saxonPromise: Promise<SaxonJS> | undefined;
let manifestPromise: Promise<Manifest> | undefined;
const sefCache = new Map<string, Promise<unknown>>();

export function setValidationEnvironment(e: ValidationEnvironment): void {
  env = e;
  saxonPromise = undefined;
  manifestPromise = undefined;
  sefCache.clear();
}

export function getManifest(): Promise<Manifest> {
  manifestPromise ??= env.loadManifest();
  manifestPromise.catch(() => {
    manifestPromise = undefined;
  });
  return manifestPromise;
}

function getSef(file: string): Promise<unknown> {
  let p = sefCache.get(file);
  if (!p) {
    p = env.loadSef(file);
    p.catch(() => sefCache.delete(file));
    sefCache.set(file, p);
  }
  return p;
}

/**
 * Which rule sets apply to an invoice:
 * - EN 16931 for every invoice that claims EN 16931 compliance (not MINIMUM / BASIC WL)
 * - XRechnung rules if the specification identifier names XRechnung
 * - Peppol BIS rules if it names Peppol BIS Billing
 */
export function selectRuleSetIds(invoice: Invoice): string[] {
  const s = invoice.syntax.toLowerCase();
  const ids: string[] = [];
  if (invoice.profile.isEn16931Compliant) ids.push(`en16931-${s}`);
  if (invoice.profile.family === "xrechnung") ids.push(`xrechnung-${s}`);
  if (invoice.profile.family === "peppol") ids.push(`peppol-${s}`);
  return ids;
}

const SVRL = { svrl: "http://purl.oclc.org/dsdl/svrl" };
const sx = new XPathLite(SVRL);

function severityOf(flag: string | null | undefined, role: string | null | undefined): Severity {
  const f = (flag || role || "").toLowerCase();
  if (f === "warning" || f === "warn") return "warning";
  if (f === "information" || f === "info") return "info";
  return "error";
}

export function parseSvrl(svrl: string, ruleSet: string): ValidationIssue[] {
  const root = parseXml(svrl);
  const issues: ValidationIssue[] = [];
  const visit = (el: Element) => {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      const e = n as Element;
      if (
        e.namespaceURI === SVRL.svrl &&
        (e.localName === "failed-assert" || e.localName === "successful-report")
      ) {
        const text = sx.text(e, "svrl:text") ?? "";
        const idMatch = /^\s*\[([A-Za-z0-9-]+)\]/.exec(text);
        issues.push({
          ruleId: e.getAttribute("id") || idMatch?.[1] || "unbekannt",
          severity: severityOf(e.getAttribute("flag"), e.getAttribute("role")),
          message: text
            .replace(/^\s*\[[A-Za-z0-9-]+\]\s*[-–:]?\s*/, "")
            .replace(/\s+/g, " ")
            .trim(),
          location: e.getAttribute("location") ?? undefined,
          test: e.getAttribute("test")?.replace(/\s+/g, " ").trim() ?? undefined,
          ruleSet,
        });
      } else {
        visit(e);
      }
    }
  };
  visit(root);
  return issues;
}

export async function validateInvoice(xml: string, invoice: Invoice): Promise<ValidationReport> {
  const started = performance.now();
  const notes: string[] = [];
  saxonPromise ??= env.loadSaxon();
  const [saxon, manifest] = await Promise.all([saxonPromise, getManifest()]);
  const wanted = selectRuleSetIds(invoice);
  if (!invoice.profile.isEn16931Compliant) {
    notes.push(
      `Das Profil „${invoice.profile.name}“ ist keine vollständige Rechnung nach EN 16931 – die EN-16931-Geschäftsregeln werden nicht angewendet.`,
    );
  }
  const ruleSets = wanted
    .map((id) => manifest.ruleSets.find((r) => r.id === id))
    .filter((r): r is RuleSetInfo => !!r);
  for (const id of wanted) {
    if (!ruleSets.some((r) => r.id === id)) notes.push(`Regelwerk ${id} ist nicht verfügbar.`);
  }

  const isFxExtended = invoice.profile.family === "zugferd" && invoice.profile.level === "EXTENDED";
  if (isFxExtended) {
    notes.push(
      "ZUGFeRD/Factur-X EXTENDED erweitert EN 16931 (z. B. zusätzliche Codes und Logistikkosten). Verstöße gegen die EN-16931-Regeln werden deshalb nur als Warnung gemeldet.",
    );
  }
  const hasThirdParty = invoice.profile.isExtension && invoice.thirdPartyPayments.length > 0;
  if (hasThirdParty) {
    notes.push(
      "XRechnung-Extension mit Zahlungen an Dritte: BR-CO-16 (EN 16931) wird durch BR-DEX-09 ersetzt und daher nicht ausgewertet.",
    );
  }

  const issues: ValidationIssue[] = [];
  for (const rs of ruleSets) {
    const sef = await getSef(rs.file);
    const result = await saxon.transform(
      { stylesheetInternal: sef, sourceText: xml, destination: "serialized" },
      "async",
    );
    const isEn = rs.id.startsWith("en16931-");
    for (const issue of parseSvrl(result.principalResult as string, rs.name)) {
      if (isEn && hasThirdParty && issue.ruleId === "BR-CO-16") continue;
      if (isEn && isFxExtended && issue.severity === "error") issue.severity = "warning";
      issues.push(issue);
    }
  }

  // The same rule can fire for several nodes – keep them, but drop exact duplicates.
  const seen = new Set<string>();
  const unique = issues.filter((i) => {
    const key = `${i.ruleSet}|${i.ruleId}|${i.location}|${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  unique.sort((a, b) => order[a.severity] - order[b.severity] || a.ruleId.localeCompare(b.ruleId));
  const counts = { error: 0, warning: 0, info: 0 };
  for (const i of unique) counts[i.severity]++;

  return {
    ruleSets,
    issues: unique,
    notes,
    durationMs: Math.round(performance.now() - started),
    counts,
    valid: counts.error === 0 && ruleSets.length > 0,
  };
}
