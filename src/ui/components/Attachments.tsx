import { Download, ExternalLink, FileText, Paperclip } from "lucide-react";
import { fileSize } from "../../core/format";
import type { Attachment } from "../../core/model";
import { Card } from "./common";

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function attachmentFileName(a: Attachment): string {
  if (a.filename) return a.filename;
  const ext = a.mimeType
    ?.split("/")[1]
    ?.replace("vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
  return `${a.id || "anhang"}${ext ? `.${ext}` : ""}`;
}

export function AttachmentsView({
  attachments,
  onSave,
  onOpenUrl,
  onShowPdf,
}: {
  attachments: Attachment[];
  onSave: (a: Attachment) => void;
  onOpenUrl: (url: string) => void;
  onShowPdf?: (a: Attachment) => void;
}) {
  if (!attachments.length) {
    return (
      <Card>
        <p className="empty-note">Diese Rechnung enthält keine rechnungsbegründenden Unterlagen.</p>
      </Card>
    );
  }
  return (
    <Card title={`Rechnungsbegründende Unterlagen (${attachments.length})`} testId="attachments">
      <table className="table">
        <thead>
          <tr>
            <th>Kennung / Beschreibung</th>
            <th>Datei</th>
            <th className="num">Größe</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {attachments.map((a, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: ids are not guaranteed to be unique
            <tr key={i} data-testid="attachment">
              <td>
                <div style={{ fontWeight: 550 }}>
                  <Paperclip size={14} style={{ verticalAlign: -2 }} /> {a.id}
                </div>
                {a.description && <div className="muted small">{a.description}</div>}
              </td>
              <td>
                {a.content ? attachmentFileName(a) : a.externalUri}
                {a.mimeType && <div className="muted small">{a.mimeType}</div>}
              </td>
              <td className="num">{a.content ? fileSize(a.size) : ""}</td>
              <td className="num">
                {a.content && a.mimeType === "application/pdf" && onShowPdf && (
                  <button type="button" className="btn ghost" onClick={() => onShowPdf(a)}>
                    <FileText aria-hidden /> Anzeigen
                  </button>
                )}
                {a.content && (
                  <button type="button" className="btn ghost" onClick={() => onSave(a)}>
                    <Download aria-hidden /> Speichern
                  </button>
                )}
                {!a.content && a.externalUri && (
                  <button type="button" className="btn ghost" onClick={() => onOpenUrl(a.externalUri!)}>
                    <ExternalLink aria-hidden /> Öffnen
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
