import { Copy, Download } from "lucide-react";
import { useMemo } from "react";

const MAX_HIGHLIGHT = 400_000;

/** Indents XML for display. Only whitespace between tags is touched – values stay verbatim. */
export function prettyXml(xml: string): string {
  if (/>\s*\n\s*</.test(xml.slice(0, 2000))) return xml; // already formatted
  let depth = 0;
  return xml
    .replace(/>\s*</g, ">\n<")
    .split("\n")
    .map((line) => {
      const closing = /^<\//.test(line);
      const selfContained =
        /^<[^!?/][^>]*>.*<\/[^>]+>$/.test(line) || /\/>$/.test(line) || /^<[!?]/.test(line);
      if (closing) depth = Math.max(0, depth - 1);
      const out = `${"  ".repeat(depth)}${line}`;
      if (!closing && !selfContained && /^<[^!?]/.test(line)) depth++;
      return out;
    })
    .join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(xml: string): string {
  // Attributes first – the later steps insert markup with attributes of their own.
  return escapeHtml(xml)
    .replace(/([\w:.-]+)="([^"]*)"/g, '<span class="a">$1</span>=<span class="v">"$2"</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="c">$1</span>')
    .replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="t">$2</span>');
}

export function XmlView({
  xml,
  title,
  onSave,
  onCopy,
}: {
  xml: string;
  title: string;
  onSave: () => void;
  onCopy: () => void;
}) {
  const pretty = useMemo(() => prettyXml(xml), [xml]);
  const html = useMemo(() => (pretty.length <= MAX_HIGHLIGHT ? highlight(pretty) : undefined), [pretty]);
  return (
    <div className="card">
      <div className="filter">
        <h3 style={{ margin: 0, flex: 1 }}>{title}</h3>
        <button type="button" className="btn" onClick={onCopy}>
          <Copy aria-hidden /> Kopieren
        </button>
        <button type="button" className="btn" onClick={onSave}>
          <Download aria-hidden /> XML speichern
        </button>
      </div>
      {html !== undefined ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: content is escaped before highlighting
        <pre className="xml-view" data-testid="xml" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="xml-view" data-testid="xml">
          {pretty}
        </pre>
      )}
    </div>
  );
}
