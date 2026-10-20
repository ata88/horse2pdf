import { FileCode2, FolderOpen, ShieldCheck } from "lucide-react";
import type { OpenedFile } from "../../platform";

const SAMPLES = [
  { file: "demo-xrechnung.xml", label: "Demo-Rechnung (XRechnung)" },
  { file: "xrechnung-extension-beispiel.xml", label: "XRechnung mit Unterpositionen" },
  { file: "zugferd-beispiel.pdf", label: "ZUGFeRD-PDF" },
];

async function fetchSample(file: string): Promise<OpenedFile> {
  const res = await fetch(`${import.meta.env.BASE_URL}samples/${file}`);
  return { name: file, bytes: new Uint8Array(await res.arrayBuffer()) };
}

export function Welcome({
  onOpen,
  onSample,
  dragging,
  compact,
}: {
  onOpen: () => void;
  onSample: (f: OpenedFile) => void;
  dragging: boolean;
  compact?: boolean;
}) {
  return (
    <div className="welcome" style={compact ? { minHeight: 0 } : undefined}>
      <div className={`dropzone ${dragging ? "active" : ""}`} data-testid="dropzone">
        {!compact && <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />}
        <h1>{dragging ? "Loslassen zum Öffnen" : "E-Rechnung hierher ziehen"}</h1>
        <p className="muted" style={{ margin: 0 }}>
          XRechnung (UBL &amp; CII), ZUGFeRD / Factur-X (PDF oder XML) und Peppol BIS Billing 3.0 – anzeigen,
          prüfen, drucken und als PDF exportieren. Alles lokal, keine Daten verlassen den Rechner.
        </p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={onOpen}>
            <FolderOpen aria-hidden /> Datei öffnen…
          </button>
        </div>
        <div className="chips">
          <span className="badge">
            <FileCode2 aria-hidden /> XML
          </span>
          <span className="badge">
            <FileCode2 aria-hidden /> PDF mit XML
          </span>
          <span className="badge ok">
            <ShieldCheck aria-hidden /> Offizielle Prüfregeln
          </span>
        </div>
        {!compact && (
          <p className="small muted" style={{ marginTop: 22, marginBottom: 0 }}>
            Beispiel ansehen:{" "}
            {SAMPLES.map((s, i) => (
              <span key={s.file}>
                {i > 0 && " · "}
                <a
                  href={`#${s.file}`}
                  data-testid={`sample-${s.file}`}
                  onClick={(e) => {
                    e.preventDefault();
                    void fetchSample(s.file).then(onSample);
                  }}
                >
                  {s.label}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
