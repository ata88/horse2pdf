import {
  AlignLeft,
  ChevronDown,
  Code2,
  FileDown,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListOrdered,
  Paperclip,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadDocument, UnsupportedDocumentError } from "../core/load";
import type { Attachment, LoadedDocument } from "../core/model";
import { documentTitle } from "../core/present";
import { validateInvoice } from "../core/validate";
import { exportInvoicePdf } from "../export/pdf";
import { getPlatform, type OpenedFile, type Platform } from "../platform";
import { fileToOpened } from "../platform/web";
import { AttachmentsView, attachmentFileName, base64ToBytes } from "./components/Attachments";
import { Banner, ValidationBadge, type ValidationState } from "./components/common";
import { DetailsView } from "./components/Details";
import { LinesView } from "./components/Lines";
import { InvoiceSheet } from "./components/Overview";
import { PdfView } from "./components/PdfView";
import { PrintRoot } from "./components/Print";
import { ValidationView } from "./components/Validation";
import { Welcome } from "./components/Welcome";
import { XmlView } from "./components/XmlView";
import { useDropFiles } from "./useDropFiles";

type Tab = "overview" | "lines" | "details" | "validation" | "attachments" | "original" | "xml";

type DocState =
  | { status: "empty" }
  | { status: "loading"; name: string }
  | { status: "error"; name: string; message: string }
  | { status: "loaded"; doc: LoadedDocument };

export type PrintJob = { mode: "original" | "generated"; id: number };

const ICON = `${import.meta.env.BASE_URL}icon.svg`;

function safeFileName(s: string): string {
  return (
    s
      .replace(/[\\/:*?"<>|\s]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "rechnung"
  );
}

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOutside]);
}

function Menu({
  label,
  icon,
  primary,
  items,
  testId,
}: {
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  testId: string;
  items: Array<{ label: string; hint?: string; icon: React.ReactNode; onClick: () => void; testId: string }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  if (items.length === 1) {
    const only = items[0]!;
    return (
      <button
        type="button"
        className={`btn ${primary ? "primary" : ""}`}
        onClick={only.onClick}
        data-testid={testId}
      >
        {icon} {label}
      </button>
    );
  }
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className={`btn ${primary ? "primary" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={testId}
      >
        {icon} {label} <ChevronDown aria-hidden />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              data-testid={it.testId}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon}
              <span>
                {it.label}
                {it.hint && <span className="hint">{it.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function App() {
  const [platform, setPlatform] = useState<Platform>();
  const [state, setState] = useState<DocState>({ status: "empty" });
  const [validation, setValidation] = useState<ValidationState>({ state: "idle" });
  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<string>();
  const [printJob, setPrintJob] = useState<PrintJob>();
  const [pdfPreview, setPdfPreview] = useState<{ bytes: Uint8Array; name: string }>();
  const [version, setVersion] = useState("");
  const loadSeq = useRef(0);

  useEffect(() => {
    getPlatform().then((p) => {
      setPlatform(p);
      p.appVersion().then(setVersion);
    });
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? undefined : t)), 3200);
  }, []);

  const runValidation = useCallback(async (doc: LoadedDocument, seq: number) => {
    setValidation({ state: "running" });
    // let the UI paint the loaded document before the (CPU heavy) rule execution starts
    await new Promise((r) => setTimeout(r, 50));
    try {
      const report = await validateInvoice(doc.xml, doc.invoice);
      if (loadSeq.current === seq) setValidation({ state: "done", report });
    } catch (e) {
      if (loadSeq.current === seq)
        setValidation({ state: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const openFile = useCallback(
    async (file: OpenedFile) => {
      const seq = ++loadSeq.current;
      setState({ status: "loading", name: file.name });
      setValidation({ state: "idle" });
      setPdfPreview(undefined);
      try {
        const doc = await loadDocument(file.bytes, file.name);
        if (loadSeq.current !== seq) return;
        setState({ status: "loaded", doc });
        setTab("overview");
        void runValidation(doc, seq);
      } catch (e) {
        if (loadSeq.current !== seq) return;
        const message =
          e instanceof UnsupportedDocumentError
            ? e.message
            : `Die Datei konnte nicht gelesen werden: ${e instanceof Error ? e.message : String(e)}`;
        setState({ status: "error", name: file.name, message });
      }
    },
    [runValidation],
  );

  const pickAndOpen = useCallback(async () => {
    if (!platform) return;
    try {
      const f = await platform.openInvoice();
      if (f) await openFile(f);
    } catch (e) {
      notify(`Öffnen fehlgeschlagen: ${String(e)}`);
    }
  }, [platform, openFile, notify]);

  useEffect(() => platform?.onExternalFiles((files) => void openFile(files[0]!)), [platform, openFile]);

  const dragging = useDropFiles(async (files) => {
    if (files[0]) await openFile(await fileToOpened(files[0]));
  });

  const doc = state.status === "loaded" ? state.doc : undefined;
  const inv = doc?.invoice;

  useEffect(() => {
    document.title = doc ? `${doc.fileName} – horse2pdf` : "horse2pdf – E-Rechnungen anzeigen und prüfen";
  }, [doc]);

  const baseName = inv ? safeFileName(`${documentTitle(inv)}_${inv.number ?? ""}`) : "rechnung";

  const save = useCallback(
    async (name: string, bytes: Uint8Array, ext: string, what: string) => {
      if (!platform) return;
      try {
        const ok = await platform.saveFile(name, bytes, { name: what, extensions: [ext] });
        if (ok) notify(`${what} gespeichert`);
      } catch (e) {
        notify(`Speichern fehlgeschlagen: ${String(e)}`);
      }
    },
    [platform, notify],
  );

  const exportGenerated = useCallback(async () => {
    if (!doc) return;
    try {
      const report = validation.state === "done" ? validation.report : undefined;
      const bytes = await exportInvoicePdf(doc, { report, appVersion: version });
      await save(`${baseName}.pdf`, bytes, "pdf", "PDF");
    } catch (e) {
      notify(`PDF-Export fehlgeschlagen: ${String(e)}`);
    }
  }, [doc, validation, version, baseName, save, notify]);

  const exportOriginal = useCallback(async () => {
    if (!doc?.originalPdf) return;
    const name = doc.originalPdf.source === "container" ? doc.fileName : doc.originalPdf.name;
    await save(
      name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`,
      doc.originalPdf.bytes,
      "pdf",
      "PDF",
    );
  }, [doc, save]);

  const saveXml = useCallback(async () => {
    if (!doc) return;
    const name = doc.container === "xml" ? doc.fileName : (doc.embeddedXmlName ?? `${baseName}.xml`);
    await save(name, new TextEncoder().encode(doc.xml), "xml", "XML");
  }, [doc, baseName, save]);

  const saveAttachment = useCallback(
    async (a: Attachment) => {
      if (!a.content) return;
      const name = attachmentFileName(a);
      await save(name, base64ToBytes(a.content), name.split(".").pop() ?? "bin", "Anhang");
    },
    [save],
  );

  const print = useCallback((mode: PrintJob["mode"]) => setPrintJob({ mode, id: Date.now() }), []);
  const onPrintReady = useCallback(async () => {
    try {
      await platform?.print();
    } catch (e) {
      notify(`Drucken fehlgeschlagen: ${String(e)}`);
    } finally {
      // keep the print view mounted until the dialog has taken its snapshot
      window.setTimeout(() => setPrintJob(undefined), 1000);
    }
  }, [platform, notify]);

  // Keyboard shortcuts: Ctrl/Cmd+O open, Ctrl/Cmd+P print, Ctrl/Cmd+E export
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "o") {
        e.preventDefault();
        void pickAndOpen();
      } else if (k === "p" && doc) {
        e.preventDefault();
        print(doc.originalPdf?.isInvoiceImage ? "original" : "generated");
      } else if (k === "e" && doc) {
        e.preventDefault();
        void (doc.originalPdf?.isInvoiceImage ? exportOriginal() : exportGenerated());
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pickAndOpen, doc, print, exportOriginal, exportGenerated]);

  // The embedded PDF is the default only if it is the invoice image itself (ZUGFeRD carrier
  // PDF or an attachment named like an invoice) – other PDF attachments are annexes.
  const original = doc?.originalPdf;
  const preferOriginal = !!original?.isInvoiceImage;
  const originalName = preferOriginal ? "Original-PDF" : "PDF-Anhang";
  const originalHint =
    original?.source === "container"
      ? "Die ZUGFeRD-/Factur-X-PDF unverändert (inkl. eingebetteter XML)"
      : `In der E-Rechnung eingebettet: ${original?.name ?? ""}`;
  const generatedExport = {
    label: "Aufbereitetes PDF exportieren",
    hint: "Alle Daten übersichtlich, mit Prüfergebnis und eingebetteter XML",
    icon: <FileDown aria-hidden />,
    onClick: exportGenerated,
    testId: "export-generated",
  };
  const originalExport = original && {
    label: `${originalName} speichern`,
    hint: originalHint,
    icon: <FileText aria-hidden />,
    onClick: exportOriginal,
    testId: "export-original",
  };
  const exportItems = doc
    ? [
        ...(originalExport && preferOriginal ? [originalExport, generatedExport] : [generatedExport]),
        ...(originalExport && !preferOriginal ? [originalExport] : []),
        {
          label: "XML speichern",
          hint:
            doc.container === "pdf"
              ? "Die aus der PDF extrahierte E-Rechnung"
              : "Die E-Rechnung als XML-Datei",
          icon: <Code2 aria-hidden />,
          onClick: saveXml,
          testId: "export-xml",
        },
      ]
    : [];
  const generatedPrint = {
    label: "Aufbereitete Ansicht drucken",
    hint: "Übersicht, Positionen und alle Details",
    icon: <Printer aria-hidden />,
    onClick: () => print("generated"),
    testId: "print-generated",
  };
  const originalPrint = original && {
    label: `${originalName} drucken`,
    hint: originalHint,
    icon: <FileText aria-hidden />,
    onClick: () => print("original"),
    testId: "print-original",
  };
  const printItems = doc
    ? originalPrint
      ? preferOriginal
        ? [originalPrint, generatedPrint]
        : [generatedPrint, originalPrint]
      : [generatedPrint]
    : [];

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; count?: number; hidden?: boolean }> = inv
    ? [
        { id: "overview", label: "Übersicht", icon: <LayoutDashboard aria-hidden /> },
        { id: "lines", label: "Positionen", icon: <ListOrdered aria-hidden />, count: countLines(inv.lines) },
        { id: "details", label: "Details", icon: <AlignLeft aria-hidden /> },
        {
          id: "validation",
          label: "Prüfung",
          icon: <ShieldCheck aria-hidden />,
          count:
            validation.state === "done"
              ? validation.report.counts.error + validation.report.counts.warning
              : undefined,
        },
        {
          id: "attachments",
          label: "Anhänge",
          icon: <Paperclip aria-hidden />,
          count: inv.attachments.length,
        },
        { id: "original", label: originalName, icon: <FileText aria-hidden />, hidden: !original },
        { id: "xml", label: "XML", icon: <Code2 aria-hidden /> },
      ]
    : [];

  return (
    <>
      <div className="app">
        <header className="toolbar">
          <div className="brand">
            <img src={ICON} alt="" />
            horse2pdf
          </div>
          <div className="doc-title">
            {doc && (
              <>
                <span className="badge accent" data-testid="profile">
                  {doc.invoice.profile.name}
                </span>
                <ValidationBadge v={validation} onClick={() => setTab("validation")} />
                <span className="name" title={doc.fileName}>
                  {doc.fileName}
                </span>
              </>
            )}
          </div>
          <button type="button" className="btn" onClick={pickAndOpen} data-testid="open">
            <FolderOpen aria-hidden /> Öffnen
          </button>
          {doc && (
            <>
              <Menu label="Drucken" icon={<Printer aria-hidden />} items={printItems} testId="print" />
              <Menu label="PDF" icon={<FileDown aria-hidden />} items={exportItems} primary testId="export" />
            </>
          )}
        </header>

        {inv && (
          <div className="tabs" role="tablist">
            {tabs
              .filter((t) => !t.hidden)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  className="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  data-testid={`tab-${t.id}`}
                >
                  {t.icon} {t.label}
                  {t.count !== undefined && t.count > 0 && <span className="count">{t.count}</span>}
                </button>
              ))}
          </div>
        )}

        <main className="content">
          {state.status === "empty" && (
            <Welcome onOpen={pickAndOpen} onSample={openFile} dragging={dragging} />
          )}
          {state.status === "loading" && (
            <div className="welcome">
              <div className="muted" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="spinner" /> {state.name} wird geladen…
              </div>
            </div>
          )}
          {state.status === "error" && (
            <div className="container">
              <Banner kind="error">
                <strong>{state.name}</strong>
                <div data-testid="load-error">{state.message}</div>
              </Banner>
              <Welcome onOpen={pickAndOpen} onSample={openFile} dragging={dragging} compact />
            </div>
          )}
          {doc && inv && (
            <div className="container">
              {doc.warnings.map((w) => (
                <Banner key={w} kind="warning">
                  {w}
                </Banner>
              ))}
              {tab === "overview" && <InvoiceSheet inv={inv} compactLines />}
              {tab === "lines" && <LinesView inv={inv} />}
              {tab === "details" && <DetailsView inv={inv} />}
              {tab === "validation" && (
                <ValidationView v={validation} onRerun={() => void runValidation(doc, loadSeq.current)} />
              )}
              {tab === "attachments" && (
                <AttachmentsView
                  attachments={inv.attachments}
                  onSave={saveAttachment}
                  onOpenUrl={(u) => void platform?.openUrl(u)}
                  onShowPdf={(a) => {
                    if (!a.content) return;
                    setPdfPreview({ bytes: base64ToBytes(a.content), name: attachmentFileName(a) });
                    setTab("original");
                  }}
                />
              )}
              {tab === "original" && (pdfPreview ?? doc.originalPdf) && (
                <PdfView
                  bytes={(pdfPreview ?? doc.originalPdf)!.bytes}
                  title={(pdfPreview ?? doc.originalPdf)!.name}
                />
              )}
              {tab === "xml" && (
                <XmlView
                  xml={doc.xml}
                  title={
                    doc.container === "pdf" ? `Eingebettete XML (${doc.embeddedXmlName})` : "XML-Quelltext"
                  }
                  onSave={saveXml}
                  onCopy={() =>
                    navigator.clipboard
                      .writeText(doc.xml)
                      .then(() => notify("XML in die Zwischenablage kopiert"))
                      .catch(() => notify("Kopieren nicht möglich"))
                  }
                />
              )}
            </div>
          )}
        </main>
      </div>

      {dragging && doc && <div className="drag-overlay">Datei loslassen, um sie zu öffnen</div>}
      {toast && (
        <div className="toast" role="status" data-testid="toast">
          {toast}
        </div>
      )}
      {printJob && doc && (
        <PrintRoot
          key={printJob.id}
          doc={doc}
          mode={printJob.mode}
          validation={validation.state === "done" ? validation.report : undefined}
          onReady={onPrintReady}
        />
      )}
    </>
  );
}

function countLines(lines: LoadedDocument["invoice"]["lines"]): number {
  return lines.reduce((n, l) => n + 1 + countLines(l.subLines), 0);
}
