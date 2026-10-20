import { useEffect, useState } from "react";
import type { LoadedDocument } from "../../core/model";
import type { ValidationReport } from "../../core/validate";
import { Banner } from "./common";
import { DetailsView } from "./Details";
import { InvoiceSheet } from "./Overview";
import { renderPdfPages } from "./PdfView";

/**
 * Content that only exists for printing (see `@media print` in styles.css).
 * "original" prints the embedded/carrier PDF page by page, "generated" the full
 * invoice view including all details.
 */
export function PrintRoot({
  doc,
  mode,
  validation,
  onReady,
}: {
  doc: LoadedDocument;
  mode: "original" | "generated";
  validation?: ValidationReport;
  onReady: () => void;
}) {
  const [pages, setPages] = useState<string[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    if (mode === "original" && doc.originalPdf) {
      // ~150 dpi – sharp on paper, still reasonable in memory
      renderPdfPages(doc.originalPdf.bytes, 2.1)
        .then((p) => alive && setPages(p))
        .catch((e) => alive && setError(String(e)));
    } else {
      setPages([]);
    }
    return () => {
      alive = false;
    };
  }, [doc, mode]);

  useEffect(() => {
    if (!pages && !error) return;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".print-root img"));
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => undefined))))
      .then(() => new Promise((r) => setTimeout(r, 150)))
      .then(onReady);
  }, [pages, error, onReady]);

  return (
    <div className="print-root" aria-hidden>
      {mode === "original" && pages && (
        <div className="print-original">
          {pages.map((src, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: pages are positional
            <img key={src.length + i} src={src} alt="" />
          ))}
        </div>
      )}
      {(mode === "generated" || error) && (
        <>
          {error && (
            <Banner kind="error">
              Original-PDF nicht druckbar – es wird die aufbereitete Ansicht gedruckt.
            </Banner>
          )}
          <InvoiceSheet inv={doc.invoice} />
          <div style={{ breakBefore: "page" }} />
          <DetailsView inv={doc.invoice} />
          {validation && (
            <p className="small muted">
              Prüfung: {validation.valid ? "gültig" : "nicht gültig"} – {validation.counts.error} Fehler,{" "}
              {validation.counts.warning} Warnungen (
              {validation.ruleSets.map((r) => `${r.name} ${r.version}`).join(", ")})
            </p>
          )}
        </>
      )}
    </div>
  );
}
