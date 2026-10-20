import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { Row } from "../../core/present";
import type { ValidationReport } from "../../core/validate";

export function KeyValue({ rows, testId }: { rows: Row[]; testId?: string }) {
  if (!rows.length) return <p className="empty-note">Keine Angaben</p>;
  return (
    <dl className="kv" data-testid={testId}>
      {rows.map(([k, v], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: labels can repeat (e.g. several IBANs)
        <div key={i} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Card({ title, children, testId }: { title?: string; children: ReactNode; testId?: string }) {
  return (
    <section className="card" data-testid={testId}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

export function Banner({ kind, children }: { kind: "error" | "warning" | "info"; children: ReactNode }) {
  const Icon = kind === "error" ? XCircle : kind === "warning" ? AlertTriangle : Info;
  return (
    <div className={`banner ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export type ValidationState =
  | { state: "idle" }
  | { state: "running" }
  | { state: "done"; report: ValidationReport }
  | { state: "error"; message: string };

export function validationTone(v: ValidationState): "ok" | "warning" | "error" | "neutral" {
  if (v.state === "error") return "error";
  if (v.state !== "done") return "neutral";
  if (!v.report.ruleSets.length) return "neutral";
  if (!v.report.valid) return "error";
  return v.report.counts.warning ? "warning" : "ok";
}

export function ValidationBadge({ v, onClick }: { v: ValidationState; onClick?: () => void }) {
  let content: ReactNode;
  let cls = "badge";
  if (v.state === "running" || v.state === "idle") {
    content = (
      <>
        <span className="spinner" style={{ width: 12, height: 12 }} /> Prüfe…
      </>
    );
  } else if (v.state === "error") {
    cls += " error";
    content = (
      <>
        <XCircle aria-hidden /> Prüfung fehlgeschlagen
      </>
    );
  } else {
    const tone = validationTone(v);
    const r = v.report;
    cls += tone === "neutral" ? "" : ` ${tone}`;
    const Icon =
      tone === "ok" ? CheckCircle2 : tone === "warning" ? AlertTriangle : tone === "error" ? XCircle : Info;
    content = (
      <>
        <Icon aria-hidden />
        {tone === "ok" && "Gültig"}
        {tone === "warning" && `Gültig · ${r.counts.warning} Warnung${r.counts.warning === 1 ? "" : "en"}`}
        {tone === "error" && `${r.counts.error} Fehler`}
        {tone === "neutral" && "Nicht geprüft"}
      </>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      data-testid="validation-badge"
      title="Zum Prüfergebnis"
    >
      {content}
    </button>
  );
}

/** Highlights all occurrences of `query` (case-insensitive). */
export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  let k = 0;
  for (let j = lower.indexOf(q); j >= 0; j = lower.indexOf(q, i)) {
    parts.push(text.slice(i, j), <mark key={k++}>{text.slice(j, j + q.length)}</mark>);
    i = j + q.length;
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}
