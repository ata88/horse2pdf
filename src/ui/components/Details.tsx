import { useMemo, useState } from "react";
import { ID_SCHEMES, label } from "../../core/codelists";
import { addressLines, money } from "../../core/format";
import type { Invoice, Party } from "../../core/model";
import {
  allowanceChargeText,
  deliveryRows,
  exemptionText,
  partyRows,
  referenceRows,
  vatBreakdownLabel,
} from "../../core/present";
import { invoiceTerms, type TermNode, termLabel } from "../../core/terms";
import { Card, Highlight, KeyValue } from "./common";

function PartyCard({ title, party, testId }: { title: string; party?: Party; testId: string }) {
  if (!party) return null;
  return (
    <Card title={title} testId={testId}>
      <div style={{ fontWeight: 600 }}>{party.name}</div>
      <div className="address" style={{ marginBottom: 10 }}>
        {addressLines(party.address).join("\n")}
      </div>
      <KeyValue rows={partyRows(party)} />
    </Card>
  );
}

export function VatTable({ inv }: { inv: Invoice }) {
  if (!inv.vatBreakdown.length) return <p className="empty-note">Keine Umsatzsteueraufschlüsselung</p>;
  return (
    <table className="table" data-testid="vat-table">
      <thead>
        <tr>
          <th>Umsatzsteuer</th>
          <th>Kategorie</th>
          <th className="num">Bemessungsgrundlage</th>
          <th className="num">Steuerbetrag</th>
        </tr>
      </thead>
      <tbody>
        {inv.vatBreakdown.map((v, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          <tr key={i}>
            <td>
              {vatBreakdownLabel(v.category, v.rate)}
              {exemptionText(v.exemptionReason, v.exemptionReasonCode) && (
                <div className="muted small">{exemptionText(v.exemptionReason, v.exemptionReasonCode)}</div>
              )}
            </td>
            <td>{v.category}</td>
            <td className="num">{money(v.taxableAmount, inv.currency)}</td>
            <td className="num">{money(v.taxAmount, inv.currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AllowancesTable({ inv }: { inv: Invoice }) {
  if (!inv.allowancesCharges.length) return null;
  return (
    <Card title="Nachlässe und Zuschläge auf Dokumentebene" testId="allowances">
      <table className="table">
        <tbody>
          {inv.allowancesCharges.map((ac, i) => {
            const t = allowanceChargeText(ac, inv.currency);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <tr key={i}>
                <td>
                  {t.label}
                  {t.detail && <div className="muted small">{t.detail}</div>}
                </td>
                <td className="num">
                  {ac.isCharge ? "+" : "−"}
                  {money(ac.amount, inv.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function filterTerms(nodes: TermNode[], q: string): TermNode[] {
  if (!q) return nodes;
  const lq = q.toLowerCase();
  const hit = (n: TermNode) =>
    n.id.toLowerCase().includes(lq) ||
    termLabel(n.id).toLowerCase().includes(lq) ||
    (n.value ?? "").toLowerCase().includes(lq);
  return nodes.flatMap((n) => {
    if (n.children) {
      if (hit(n)) return [n];
      const c = filterTerms(n.children, q);
      return c.length ? [{ ...n, children: c }] : [];
    }
    return hit(n) ? [n] : [];
  });
}

function TermTree({ nodes, q }: { nodes: TermNode[]; q: string }) {
  return (
    <>
      {nodes.map((n, i) =>
        n.children ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: groups repeat (several lines)
          <details key={i} open>
            <summary>
              <span className="mono muted">{n.id}</span> <Highlight text={termLabel(n.id)} query={q} />
            </summary>
            <TermTree nodes={n.children} q={q} />
          </details>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: terms repeat
          <div className="term" key={i}>
            <span className="id">
              <Highlight text={n.id} query={q} />
            </span>
            <span className="muted">
              <Highlight text={termLabel(n.id)} query={q} />
            </span>
            <span className="value">
              <Highlight text={n.value ?? ""} query={q} />
              {n.scheme && <span className="muted small"> [{label(ID_SCHEMES, n.scheme) ?? n.scheme}]</span>}
            </span>
          </div>
        ),
      )}
    </>
  );
}

export function AllTerms({ inv }: { inv: Invoice }) {
  const [q, setQ] = useState("");
  const terms = useMemo(() => invoiceTerms(inv), [inv]);
  const shown = useMemo(() => filterTerms(terms, q), [terms, q]);
  return (
    <Card testId="all-terms">
      <div className="filter">
        <h3 style={{ margin: 0, flex: 1 }}>Alle Angaben nach EN 16931</h3>
        <input
          className="input"
          type="search"
          placeholder="BT-Nummer, Bezeichnung oder Wert…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Alle Angaben durchsuchen"
        />
      </div>
      <div className="terms">
        {shown.length ? <TermTree nodes={shown} q={q} /> : <p className="empty-note">Keine Treffer</p>}
      </div>
    </Card>
  );
}

export function DetailsView({ inv }: { inv: Invoice }) {
  const delivery = deliveryRows(inv);
  const deliveryAddress = addressLines(inv.delivery?.address);
  return (
    <div className="stack">
      <div className="grid-2">
        <PartyCard title="Verkäufer" party={inv.seller} testId="seller" />
        <PartyCard title="Käufer" party={inv.buyer} testId="buyer" />
        <PartyCard title="Zahlungsempfänger" party={inv.payee} testId="payee" />
        <PartyCard
          title="Steuervertreter des Verkäufers"
          party={inv.sellerTaxRepresentative}
          testId="tax-rep"
        />
        {(delivery.length > 0 || deliveryAddress.length > 0) && (
          <Card title="Lieferung" testId="delivery">
            <KeyValue rows={delivery} />
            {deliveryAddress.length > 0 && (
              <div className="address" style={{ marginTop: 8 }}>
                {deliveryAddress.join("\n")}
              </div>
            )}
          </Card>
        )}
        <Card title="Referenzen" testId="references">
          <KeyValue rows={referenceRows(inv)} />
        </Card>
      </div>
      <Card title="Umsatzsteuer">
        <VatTable inv={inv} />
      </Card>
      <AllowancesTable inv={inv} />
      <AllTerms inv={inv} />
    </div>
  );
}
