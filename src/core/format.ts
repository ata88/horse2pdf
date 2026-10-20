/**
 * Locale aware formatting (German conventions). Pure functions, shared by UI and PDF.
 *
 * Amounts are shown with at least 2 decimals but never rounded away: a unit price of
 * 1.23456 stays 1,23456 – hiding digits on an invoice would misrepresent it.
 */

import { countryName } from "./codelists";
import type { Address } from "./model";

const LOCALE = "de-DE";

function decimals(n: number): number {
  const s = String(n);
  if (s.includes("e-")) return Math.min(10, Number(s.split("e-")[1]));
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number, currency?: string): Intl.NumberFormat {
  const key = `${min}|${max}|${currency ?? ""}`;
  let f = nfCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
        ...(currency ? { style: "currency", currency } : {}),
      });
    } catch {
      // unknown currency code – format the number and append the code ourselves
      f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max });
    }
    nfCache.set(key, f);
  }
  return f;
}

/** 1234.5 → "1.234,50 €" (min. 2 decimals, more if present). */
export function money(n: number | undefined, currency?: string): string {
  if (n === undefined) return "";
  const d = Math.max(2, decimals(n));
  const f = nf(2, d, currency);
  const s = f.format(n);
  if (currency && f.resolvedOptions().style !== "currency") return `${s} ${currency}`;
  return s;
}

/** Plain decimal with at least 2 decimals: 1234.5 → "1.234,50". */
export function amount(n: number | undefined): string {
  if (n === undefined) return "";
  return nf(2, Math.max(2, decimals(n))).format(n);
}

/** Quantities: no forced decimals, 2.5 → "2,5", 3 → "3". */
export function quantity(n: number | undefined): string {
  if (n === undefined) return "";
  return nf(0, Math.max(0, decimals(n))).format(n);
}

/** VAT and other percentages: 19 → "19 %", 7.5 → "7,5 %". */
export function percent(n: number | undefined): string {
  if (n === undefined) return "";
  return `${quantity(n)} %`;
}

/** "2024-03-01" → "01.03.2024" (anything unparsable is returned unchanged). */
export function date(iso: string | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export function period(start?: string, end?: string): string {
  if (start && end) return `${date(start)} – ${date(end)}`;
  if (start) return `ab ${date(start)}`;
  if (end) return `bis ${date(end)}`;
  return "";
}

/** IBAN in groups of four for readability. */
export function iban(s: string | undefined): string {
  if (!s) return "";
  const compact = s.replace(/\s/g, "");
  return /^[A-Z]{2}\d{2}[A-Z0-9]+$/i.test(compact) ? compact.replace(/(.{4})(?=.)/g, "$1 ") : s;
}

export function fileSize(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${quantity(Math.round(bytes / 102.4) / 10)} KB`;
  return `${quantity(Math.round(bytes / (1024 * 102.4)) / 10)} MB`;
}

/** Address as lines, country spelled out unless it is Germany. */
export function addressLines(a: Address | undefined): string[] {
  if (!a) return [];
  const lines = [a.line1, a.line2, a.line3].filter((l): l is string => !!l);
  const city = [a.postcode, a.city].filter(Boolean).join(" ");
  if (city) lines.push(city);
  if (a.region) lines.push(a.region);
  if (a.country && a.country.toUpperCase() !== "DE") lines.push(countryName(a.country) ?? a.country);
  return lines;
}
