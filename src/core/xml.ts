/**
 * Tiny, namespace-aware helpers for walking invoice XML.
 *
 * Paths use prefixes from a namespace map, e.g. `q(el, "cac:Party/cbc:Name")`.
 * Only the child axis is supported – that is all the EN 16931 bindings need and it
 * keeps the parsers fast and predictable. We use @xmldom/xmldom everywhere (browser,
 * Tauri webview and Node tests) so the behaviour is identical in all environments.
 */
import { DOMParser } from "@xmldom/xmldom";

export type Ns = Record<string, string>;

export class XmlError extends Error {}

export function parseXml(text: string): Element {
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level !== "warning") errors.push(msg);
    },
  }).parseFromString(text.replace(/^﻿/, ""), "application/xml");
  const root = doc.documentElement as unknown as Element | null;
  if (!root || errors.length) {
    throw new XmlError(errors[0] ?? "Kein XML-Wurzelelement gefunden");
  }
  return root;
}

export class XPathLite {
  constructor(private readonly ns: Ns) {}

  private split(path: string): Array<[string | undefined, string]> {
    return path.split("/").map((step) => {
      const i = step.indexOf(":");
      if (i < 0) return [undefined, step];
      const uri = this.ns[step.slice(0, i)];
      if (!uri) throw new Error(`Unknown prefix in ${path}`);
      return [uri, step.slice(i + 1)];
    });
  }

  /** All elements matching the (child axis) path. */
  all(el: Element | undefined, path: string): Element[] {
    if (!el) return [];
    let current: Element[] = [el];
    for (const [uri, local] of this.split(path)) {
      const next: Element[] = [];
      for (const c of current) {
        for (let n = c.firstChild; n; n = n.nextSibling) {
          if (n.nodeType !== 1) continue;
          const e = n as Element;
          if (e.localName === local && (uri === undefined || e.namespaceURI === uri)) next.push(e);
        }
      }
      current = next;
      if (!current.length) break;
    }
    return current;
  }

  one(el: Element | undefined, path: string): Element | undefined {
    return this.all(el, path)[0];
  }

  /** Trimmed text content or undefined if missing/empty. */
  text(el: Element | undefined, path?: string): string | undefined {
    const target = path ? this.one(el, path) : el;
    const t = target?.textContent?.trim();
    return t ? t : undefined;
  }

  texts(el: Element | undefined, path: string): string[] {
    return this.all(el, path)
      .map((e) => e.textContent?.trim() ?? "")
      .filter(Boolean);
  }

  num(el: Element | undefined, path?: string): number | undefined {
    return toNumber(this.text(el, path));
  }

  attr(el: Element | undefined, path: string | undefined, name: string): string | undefined {
    const target = path ? this.one(el, path) : el;
    const v = target?.getAttribute(name)?.trim();
    return v ? v : undefined;
  }
}

/** xs:boolean – "true"/"1" are true, everything else false. */
export function isTrue(s: string | undefined): boolean {
  const v = s?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export function toNumber(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const n = Number(s.replace(/\s/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/** Normalises `YYYYMMDD` (CII format 102), `YYYY-MM-DD` and dateTime values to `YYYY-MM-DD`. */
export function toIsoDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const v = s.trim();
  let m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return v;
}

/** Drops keys whose value is undefined, and returns undefined for "empty" objects. */
export function compact<T extends object>(obj: T): T | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length));
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}

export function base64Size(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}
