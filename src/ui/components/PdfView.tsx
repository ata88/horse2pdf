import { useEffect, useRef, useState } from "react";
import { openPdf } from "../../core/pdf";
import { Banner } from "./common";

/** Renders all pages of a PDF to PNG data URLs (used for viewing and printing). */
export async function renderPdfPages(bytes: Uint8Array, scale: number): Promise<string[]> {
  const { task, doc } = await openPdf(bytes);
  try {
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas nicht verfügbar");
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      pages.push(canvas.toDataURL("image/png"));
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

export function PdfView({ bytes, title }: { bytes: Uint8Array; title: string }) {
  const [pages, setPages] = useState<string[]>();
  const [error, setError] = useState<string>();
  const current = useRef(bytes);
  useEffect(() => {
    current.current = bytes;
    setPages(undefined);
    setError(undefined);
    renderPdfPages(bytes, Math.min(2, (window.devicePixelRatio || 1) * 1.4))
      .then((p) => current.current === bytes && setPages(p))
      .catch((e) => current.current === bytes && setError(String(e)));
  }, [bytes]);

  if (error) return <Banner kind="error">Die PDF konnte nicht angezeigt werden: {error}</Banner>;
  if (!pages)
    return (
      <div className="muted" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span className="spinner" /> PDF wird geladen…
      </div>
    );
  return (
    <div className="pdf-pages" data-testid="pdf-pages">
      {pages.map((src, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pages are positional
        <img key={src.length + i} src={src} alt={`${title} – Seite ${i + 1}`} style={{ width: 820 }} />
      ))}
    </div>
  );
}
