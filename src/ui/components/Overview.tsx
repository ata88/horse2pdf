import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { addressLines, money } from "../../core/format";
import { buildGiroCode } from "../../core/girocode";
import type { Invoice } from "../../core/model";
import { documentTitle, headerRows, noteSubject, paymentRows, totalRows } from "../../core/present";
import { KeyValue } from "./common";
import { LinesTable } from "./Lines";

function GiroCodeImage({ payload }: { payload: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 0, width: 264 }).then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [payload]);
  return src ? <img src={src} alt="GiroCode für die Überweisung" /> : null;
}

export function Totals({ inv }: { inv: Invoice }) {
  const rows = totalRows(inv);
  return (
    <table className="totals" data-testid="totals">
      <tbody>
        {rows.map((r, i) => (
          <tr
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            key={i}
            className={[r.strong ? "strong" : "", i === rows.length - 1 ? "payable" : ""].join(" ")}
            title={r.bt}
          >
            <td>{r.label}</td>
            <td className="num">{money(r.value, r.currency ?? inv.currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PaymentBox({ inv }: { inv: Invoice }) {
  const rows = paymentRows(inv);
  const giro = buildGiroCode(inv);
  if (!rows.length) return null;
  return (
    <div className="pay-box" data-testid="payment">
      <KeyValue rows={rows} />
      {giro && (
        <div className="qr" data-testid="girocode">
          <GiroCodeImage payload={giro.payload} />
          GiroCode – mit der Banking-App scannen
        </div>
      )}
    </div>
  );
}

/** "Everything at a glance": the invoice rendered like a paper document. */
export function InvoiceSheet({ inv, compactLines }: { inv: Invoice; compactLines?: boolean }) {
  const sender = [inv.seller.name, ...addressLines(inv.seller.address)].filter(Boolean).join(" · ");
  return (
    <article className="sheet" data-testid="invoice-sheet">
      <header className="sheet-head">
        <div>
          <div className="seller">{inv.seller.name}</div>
          <div className="address muted">{addressLines(inv.seller.address).join("\n")}</div>
        </div>
        <div className="doc-type">
          <div className="title">{documentTitle(inv)}</div>
          <div className="muted small">{inv.profile.name}</div>
        </div>
      </header>

      <div className="sheet-meta">
        <div className="recipient">
          <div className="sender-line">{sender}</div>
          <div className="rname">{inv.buyer.name}</div>
          <div className="address">{addressLines(inv.buyer.address).join("\n")}</div>
        </div>
        <KeyValue rows={headerRows(inv)} testId="header-facts" />
      </div>

      {inv.notes.length > 0 && (
        <div className="notes" data-testid="notes">
          {inv.notes.map((n, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <div key={i}>
              {n.subjectCode && <span className="muted">{noteSubject(n.subjectCode)}: </span>}
              {n.text}
            </div>
          ))}
        </div>
      )}

      <LinesTable inv={inv} compact={compactLines} />
      <Totals inv={inv} />

      {inv.payment || inv.paymentTerms ? (
        <section style={{ marginTop: 28 }}>
          <h3 className="section-title">Zahlung</h3>
          <PaymentBox inv={inv} />
        </section>
      ) : null}
    </article>
  );
}
