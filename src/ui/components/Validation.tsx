import { AlertTriangle, CheckCircle2, Info, RefreshCw, ShieldQuestion, XCircle } from "lucide-react";
import { useState } from "react";
import type { Severity, ValidationIssue } from "../../core/validate";
import { Banner, Card, type ValidationState, validationTone } from "./common";

const SEVERITY: Record<Severity, { label: string; cls: string }> = {
  error: { label: "Fehler", cls: "error" },
  warning: { label: "Warnung", cls: "warning" },
  info: { label: "Hinweis", cls: "info" },
};

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const [open, setOpen] = useState(false);
  const s = SEVERITY[issue.severity];
  return (
    <div className="issue" data-testid="issue">
      <div>
        <span className={`badge ${s.cls}`}>{s.label}</span>
      </div>
      <div>
        <div>
          <span className="rule">{issue.ruleId}</span> <span className="muted small">· {issue.ruleSet}</span>
        </div>
        <div>{issue.message}</div>
        {(issue.location || issue.test) && (
          <button
            type="button"
            className="btn ghost small"
            style={{ height: 24, padding: 0 }}
            onClick={() => setOpen(!open)}
          >
            {open ? "Technische Details ausblenden" : "Technische Details"}
          </button>
        )}
        {open && (
          <div className="where">
            {issue.location && <div>Ort: {issue.location}</div>}
            {issue.test && <div>Regel: {issue.test}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function ValidationView({ v, onRerun }: { v: ValidationState; onRerun: () => void }) {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const tone = validationTone(v);
  const Icon =
    tone === "ok"
      ? CheckCircle2
      : tone === "warning"
        ? AlertTriangle
        : tone === "error"
          ? XCircle
          : ShieldQuestion;

  if (v.state === "idle" || v.state === "running") {
    return (
      <Card>
        <div className="status-hero neutral">
          <div className="icon">
            <span className="spinner" />
          </div>
          <div>
            <h2>Prüfung läuft…</h2>
            <div className="muted">
              Die offiziellen Regelwerke werden lokal ausgeführt – es werden keine Daten übertragen.
            </div>
          </div>
        </div>
      </Card>
    );
  }
  if (v.state === "error") {
    return (
      <Banner kind="error">
        Die Prüfung konnte nicht ausgeführt werden: {v.message}
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={onRerun}>
            <RefreshCw aria-hidden /> Erneut versuchen
          </button>
        </div>
      </Banner>
    );
  }

  const r = v.report;
  const issues = filter === "all" ? r.issues : r.issues.filter((i) => i.severity === filter);
  const title =
    tone === "ok"
      ? "Die E-Rechnung ist gültig"
      : tone === "warning"
        ? "Gültig – mit Hinweisen"
        : tone === "error"
          ? "Die E-Rechnung ist nicht gültig"
          : "Keine Prüfregeln anwendbar";

  return (
    <div className="stack" data-testid="validation">
      <Card>
        <div className={`status-hero ${tone}`}>
          <div className="icon">
            <Icon aria-hidden />
          </div>
          <div style={{ flex: 1 }}>
            <h2 data-testid="validation-title">{title}</h2>
            <div className="muted">
              {r.counts.error} Fehler · {r.counts.warning} Warnungen · {r.counts.info} Hinweise ·{" "}
              {r.durationMs} ms
            </div>
          </div>
          <button type="button" className="btn" onClick={onRerun}>
            <RefreshCw aria-hidden /> Erneut prüfen
          </button>
        </div>
        <div style={{ marginTop: 14 }} className="small muted">
          Geprüft mit:{" "}
          {r.ruleSets.length ? r.ruleSets.map((s) => `${s.name} (Version ${s.version})`).join(", ") : "–"}.
          Die Prüfung erfolgt offline mit den offiziellen Schematron-Regeln.
        </div>
      </Card>

      {r.notes.map((n) => (
        <Banner key={n} kind="info">
          {n}
        </Banner>
      ))}

      {r.issues.length > 0 && (
        <Card>
          <div className="filter">
            <h3 style={{ margin: 0, flex: 1 }}>Meldungen</h3>
            {(["all", "error", "warning", "info"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`badge ${filter === f ? "accent" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? `Alle (${r.issues.length})` : `${SEVERITY[f].label} (${r.counts[f]})`}
              </button>
            ))}
          </div>
          {issues.map((i, k) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: issues can be identical except location
            <IssueRow key={k} issue={i} />
          ))}
        </Card>
      )}

      <p className="small muted">
        <Info size={13} style={{ verticalAlign: -2 }} /> Ohne Gewähr: Die Prüfung ersetzt keine steuerliche
        Beratung. XML-Schema-Prüfungen (XSD) sind nicht enthalten.
      </p>
    </div>
  );
}
