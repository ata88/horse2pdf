# Architektur

```
                ┌───────────────────────────── Tauri (Rust, src-tauri) ─────────────────────────────┐
 Datei / Drop → │ read_file · write_file · print_window · "Öffnen mit"/Dateizuordnung/2. Instanz      │
                └───────────────▲───────────────────────────────────────────────────────────────────┘
                                │ Platform-Interface (src/platform) – im Browser: Web-Implementierung
┌───────────────────────────────┴──────────────────── Webview (React, src/ui) ──────────────────────┐
│  App ─ Tabs: Übersicht · Positionen · Details/Alle Angaben · Prüfung · Anhänge · Original-PDF · XML │
└──────▲───────────────────────▲──────────────────────────▲────────────────────────▲───────────────┘
       │ Invoice-Modell         │ present/format/codes      │ ValidationReport        │ PDF-Bytes
┌──────┴───────────┐   ┌────────┴─────────┐       ┌─────────┴──────────┐   ┌──────────┴──────────┐
│ core/load.ts     │   │ core/present.ts  │       │ core/validate.ts   │   │ export/pdf.ts       │
│  ├ pdf.ts (pdfjs)│   │ core/format.ts   │       │  SaxonJS + SEF     │   │  pdfmake            │
│  ├ parse/ubl.ts  │   │ core/codelists.ts│       │  (public/rules)    │   │                     │
│  └ parse/cii.ts  │   │ core/terms.ts    │       └────────────────────┘   └─────────────────────┘
└──────────────────┘   └──────────────────┘
```

## Datenfluss

1. **Laden** (`core/load.ts`): Bytes → PDF? → eingebettete Dateien per pdf.js lesen, die
   Rechnungs-XML wählen (`factur-x.xml`, `zugferd-invoice.xml`, `xrechnung.xml`, sonst per Inhalt).
   XML wird encoding-korrekt dekodiert (BOM, UTF-16, `encoding="…"`), ein Peppol-SBDH entpackt.
2. **Parsen** (`core/parse/*`): UBL und CII werden auf das syntaxneutrale `Invoice`-Modell
   abgebildet. Jedes Feld trägt die BT/BG-Nummer aus EN 16931. XRechnung-Extension
   (Unterpositionen, Zahlungen an Dritte) und ZUGFeRD-EXTENDED-Logistikkosten sind abgedeckt.
3. **Profil** (`core/profile.ts`): Aus BT-24 wird das Profil (XRechnung, Peppol, ZUGFeRD-Level)
   abgeleitet – es steuert, welche Regelwerke gelten.
4. **Darstellung**: UI und PDF nutzen gemeinsame Helfer (`present.ts`) – gleiche Texte,
   gleiche Reihenfolge, gleiche Formatierung.
5. **Prüfung** (`core/validate.ts`): Je nach Profil EN 16931 + XRechnung bzw. Peppol. Die
   Schematron-Regeln werden beim Build mit SchXslt/xslt3 zu SaxonJS-SEF kompiliert und zur
   Laufzeit offline ausgeführt. Ergebnis: SVRL → `ValidationReport`.
6. **Export/Druck**: `export/pdf.ts` erzeugt das PDF (inkl. eingebetteter Original-XML);
   gedruckt wird eine eigene Druckansicht (`ui/components/Print.tsx`, `@media print`) über den
   nativen Druckdialog. Ein eingebettetes Rechnungs-PDF (ZUGFeRD-Träger-PDF oder ein als
   Rechnung benannter PDF-Anhang) ist Standard für Speichern/Drucken.

## Designentscheidungen

| Entscheidung | Begründung |
| ------------ | ---------- |
| Tauri statt Electron | Native Installer < 15 MB, System-Webview, Rust-Kern für Datei-IO. |
| Logik komplett in TypeScript | Eine Codebasis für UI, Tests (Node) und Browser-E2E; keine IPC für Fachlogik. |
| Eigenes Modell statt KoSIT-XSLT-Visualisierung | Volle Kontrolle über Layout, Druck, PDF; KoSIT-XSLT dient als **Test-Orakel**. |
| SaxonJS + vorkompilierte Schematron | Offizielle Regeln ohne Java; deterministisch versioniert und per Hash verifiziert. |
| pdfmake für den Export | Deterministische, testbare PDFs auf allen Plattformen (statt webview-spezifischem Print-to-PDF). |
| pdf.js *legacy* Build | Polyfills für ältere WKWebView/WebView2-Versionen. |
| `dragDropEnabled: false` | HTML5-Drag & Drop funktioniert damit identisch in Browser und App. |

## Grenzen / Roadmap

- XSD-Schemaprüfung ist nicht enthalten (Schematron deckt die Geschäftsregeln ab).
- ZUGFeRD 1.0 wird erkannt, aber nicht angezeigt (veraltet).
- Factur-X-spezifische Schematron (MINIMUM/BASIC WL/EXTENDED) ist nicht enthalten; EXTENDED
  wird gegen EN 16931 geprüft (Verstöße als Warnung).
- Englische Oberfläche, Auto-Update (Tauri Updater) und Code-Signing sind vorbereitet bzw.
  geplant (siehe RELEASING.md).
