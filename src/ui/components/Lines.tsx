import { Fragment, useMemo, useState } from "react";
import { money, quantity } from "../../core/format";
import type { Invoice, InvoiceLine } from "../../core/model";
import { lineDetails, unitLabel, unitShort, vatLabel } from "../../core/present";
import { Highlight } from "./common";

const COMPACT_LIMIT = 12;

function flatten(lines: InvoiceLine[], depth = 0): Array<{ line: InvoiceLine; depth: number }> {
  return lines.flatMap((l) => [{ line: l, depth }, ...flatten(l.subLines, depth + 1)]);
}

function matches(l: InvoiceLine, q: string, details: string[]): boolean {
  const hay = [l.id, l.item.name, ...details].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function LinesTable({
  inv,
  compact,
  filter = "",
}: {
  inv: Invoice;
  compact?: boolean;
  filter?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => flatten(inv.lines), [inv]);
  const visible = rows.filter(
    ({ line }) => !filter || matches(line, filter, lineDetails(line, inv.currency)),
  );
  const limited = compact && !showAll ? visible.slice(0, COMPACT_LIMIT) : visible;

  return (
    <>
      <table className="table" data-testid="lines">
        <thead>
          <tr>
            <th style={{ width: 52 }}>Pos.</th>
            <th>Bezeichnung</th>
            <th className="num">Menge</th>
            <th>Einheit</th>
            <th className="num">Einzelpreis</th>
            <th className="num">USt</th>
            <th className="num">Gesamt netto</th>
          </tr>
        </thead>
        <tbody>
          {limited.map(({ line: l, depth }) => {
            const details = lineDetails(l, inv.currency);
            const isGroup = l.subLines.length > 0;
            return (
              <Fragment key={`${depth}-${l.id}-${l.item.name}`}>
                <tr
                  className={[depth ? "sub" : "", isGroup ? "group" : ""].join(" ")}
                  style={{ "--depth": depth } as React.CSSProperties}
                  data-testid="line"
                >
                  <td className="muted">{l.id}</td>
                  <td>
                    <div className="item-name">
                      <Highlight text={l.item.name ?? ""} query={filter} />
                    </div>
                    {details.length > 0 && (
                      <ul className="details">
                        {details.map((d, i) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: static list
                          <li key={i}>
                            <Highlight text={d} query={filter} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="num">{quantity(l.quantity)}</td>
                  <td title={unitLabel(l.unit)}>{unitShort(l.unit)}</td>
                  <td className="num">{money(l.price.net, inv.currency)}</td>
                  <td className="num">{vatLabel(l.vatCategory, l.vatRate)}</td>
                  <td className="num" style={{ fontWeight: depth ? 400 : 600 }}>
                    {money(l.netAmount, inv.currency)}
                  </td>
                </tr>
              </Fragment>
            );
          })}
          {!limited.length && (
            <tr>
              <td colSpan={7} className="empty-note">
                {rows.length
                  ? "Keine Position entspricht dem Filter."
                  : "Diese Rechnung enthält keine Positionen."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {compact && visible.length > COMPACT_LIMIT && (
        <button
          type="button"
          className="btn ghost"
          style={{ marginTop: 8 }}
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? "Weniger anzeigen" : `Alle ${visible.length} Positionen anzeigen`}
        </button>
      )}
    </>
  );
}

export function LinesView({ inv }: { inv: Invoice }) {
  const [filter, setFilter] = useState("");
  const count = flatten(inv.lines).length;
  return (
    <div className="card">
      <div className="filter">
        <h3 style={{ margin: 0, flex: 1 }}>
          {count} Position{count === 1 ? "" : "en"}
        </h3>
        <input
          className="input"
          type="search"
          placeholder="Positionen durchsuchen…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Positionen durchsuchen"
        />
      </div>
      <LinesTable inv={inv} filter={filter} />
    </div>
  );
}
