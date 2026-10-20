# AGENTS.md – guide for AI agents and contributors

horse2pdf is a desktop viewer for European e-invoices (EN 16931): XRechnung (UBL/CII),
ZUGFeRD 2.x / Factur-X (PDF with embedded XML) and Peppol BIS Billing 3.0. It displays,
validates (official Schematron rules, offline), prints and exports invoices to PDF.
The UI language is **German**; code, comments and commit messages are **English**.

## The one rule

**Invoice data must never be misrepresented.** No swapped fields, no rounding away digits,
no invented values, no silently dropped information. Every parser change must keep the
oracle, parity and calculation tests green (see *Testing*). If a value cannot be shown
correctly, show the raw value rather than a wrong interpretation.

## Stack

| Layer | Tech | Where |
| ----- | ---- | ----- |
| Core (parsing, model, validation, presentation) | TypeScript, framework free | `src/core/` |
| PDF export | pdfmake (Roboto) | `src/export/pdf.ts` |
| UI | React 19 + plain CSS (tokens in `src/ui/styles.css`), lucide icons | `src/ui/` |
| Platform abstraction | Tauri vs. browser | `src/platform/` |
| Desktop shell | Tauri 2 (Rust) – file IO, print, "open with" | `src-tauri/` |
| Validation rules | CEN/KoSIT/Peppol Schematron → SaxonJS SEF (build step) | `rules/`, `scripts/build-rules.mjs` |
| Tests | Vitest (unit/oracle), Playwright (E2E) | `tests/`, `e2e/` |

## Commands

```bash
pnpm install
pnpm assets          # pdf.js assets + download/verify/compile rules (needed once, cached)
pnpm dev             # UI in the browser at :1420
pnpm app:dev         # desktop app (needs Rust + Tauri prerequisites)
pnpm lint            # Biome (lint:fix to auto-fix)
pnpm typecheck
pnpm test            # all unit tests incl. KoSIT oracle (~30 s)
pnpm exec vite build && pnpm test:e2e   # E2E against the production build
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

Run `pnpm check` (lint + typecheck + unit) before every commit.

## Architecture in one paragraph

`loadDocument(bytes, name)` (`src/core/load.ts`) detects PDF vs. XML, extracts the embedded
XML from ZUGFeRD/Factur-X PDFs (pdf.js), unwraps Peppol SBDH envelopes and dispatches to
`parseUbl` / `parseCii`. Both produce the **syntax-neutral `Invoice` model** (`src/core/model.ts`,
every field documented with its BT/BG number). Everything downstream – UI, PDF export, the
"all business terms" tree (`terms.ts`) – only consumes that model. Shared wording/formatting
lives in `present.ts`, `format.ts`, `codelists.ts`, so screen and PDF always agree.
Validation (`validate.ts`) runs precompiled Schematron (SEF JSON in `public/rules/`) with
SaxonJS in the webview. See `docs/ARCHITECTURE.md` for details.

## Conventions

- **Model first**: new data → add the field to `model.ts` (with BT comment) → both parsers →
  `terms.ts` (BT tree + German label) → UI/PDF via `present.ts`. Never read XML in UI code.
- Parsers use `XPathLite` (child-axis paths with prefixes). Keep paths identical to the
  EN 16931 syntax bindings (EN 16931-3-2 UBL, -3-3 CII). The KoSIT XSLTs in
  `.cache/rules/work/kosit-*` (after `pnpm assets`) are the best reference.
- Amounts are `number` parsed from the XML text; format with `money()` which never drops
  decimals. Dates are ISO strings, formatted with `date()`.
- Codes are always shown with the raw code next to the label (`codeLabel`).
- Platform specifics only behind `Platform` (`src/platform/`); the UI must work in a plain browser
  (that is how E2E tests run).
- The webview CSP (in `src-tauri/tauri.conf.json`) is also enforced by `vite preview`, so E2E
  tests catch CSP violations. Do not add remote resources; everything is bundled.
- pdf.js: always import the **legacy** build (`pdfjs-dist/legacy/...`) – the modern build uses
  JS APIs older system webviews (WKWebView) lack.
- SaxonJS 2.7 computes `xs:integer` with JS numbers (precision loss > 2^53). Rule sources are
  patched where this matters (`patches` in `rules/sources.json`, each with a reason).
- Styling: CSS custom properties, light/dark via `prefers-color-scheme`. No CSS framework.
- Biome formats/lints TS; `cargo fmt`/`clippy` for Rust. Line width 110.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, `deps:`, `docs:` …) – release-please
  derives versions and the changelog from them.

## Testing

| Test | What it guarantees |
| ---- | ------------------ |
| `tests/oracle.test.ts` | Every BT value equals the official KoSIT visualization mapping for all fixtures. Documented deviations live in `KNOWN_ORACLE_DEVIATIONS` – each needs a reason why *we* are right. |
| `tests/consistency.test.ts` | UBL vs. CII variants of the same KoSIT case parse identically; EN 16931 calculation rules (BR-CO-10…16) hold on the model. |
| `tests/validate.test.ts` | Rule selection and results per fixture (snapshot); tampered invoices are detected; exact IBAN check. |
| `tests/pdf.test.ts` | The exported PDF contains all amounts/lines and embeds the original XML. |
| `tests/load.test.ts`, `format.test.ts`, `elster.test.ts`, `girocode.test.ts` | Loading edge cases, formatting, cross-check against the ELSTER viewer, EPC QR payload. |
| `e2e/app.spec.ts` | User flows in the real UI (open, drop, tabs, validate, export, print, errors), no console errors. |

Adding a fixture: put it under `tests/fixtures/<source>/` (keep the upstream license file),
run `pnpm test -u` once to record the validation snapshot, review the snapshot diff.
Regenerate README screenshots with `pnpm exec vite build && SCREENSHOTS=1 pnpm test:e2e screenshots`.

## Updating validation rules

Edit versions/URLs in `rules/sources.json`, run `pnpm rules:build --update-lock`, review the
hash changes in `rules/sources.lock.json`, then `pnpm test -u` and review snapshot changes.

## Releases

Fully automated via `.github/workflows/release.yml` (release-please → tag → installers for
macOS universal, Windows x64, Linux). See `docs/RELEASING.md`. Never bump versions by hand.

## Do not

- Do not commit generated/downloaded files: `public/rules/`, `public/pdfjs/`, `public/vendor/` (SaxonJS – its license forbids hosting it for download), `.cache/`, `dist/`, `src-tauri/target/`.
- Do not modify fixtures to make tests pass – they are upstream reference data.
- Do not weaken the oracle/validation tests; add a documented deviation instead, with evidence.
- Do not send invoice data anywhere. The app is offline by design.
