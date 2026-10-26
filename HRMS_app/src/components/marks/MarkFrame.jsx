import { useId, useState } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Frame for every chart: title, optional key and summary, and a switch to the
 * same numbers as a table (for screen readers, exact values and copy-paste).
 * table: { columns: [{ key, label, align, format }], rows: [{...}] }
 */
export function MarkFrame({ id, title, kicker, summary, actions, table, empty, emptyText = "No data for this period.", className, children }) {
  const [asTable, setAsTable] = useState(false);
  const headingId = useId();
  const showTable = asTable && table;

  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-panel p-4", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {kicker && <p className="label-key">{kicker}</p>}
          <h3 id={headingId} className="text-[15px] font-semibold leading-snug text-ink">{title}</h3>
          {summary && <p className="mt-0.5 text-[12.5px] text-ink-2">{summary}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {actions}
          {table && !empty && (
            <button
              type="button"
              aria-pressed={asTable}
              onClick={() => setAsTable((v) => !v)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11.5px] text-ink-2 hover:border-line-2 hover:text-ink"
            >
              {asTable ? <BarChart3 className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
              {asTable ? "Chart" : "Table"}
            </button>
          )}
        </div>
      </header>
      {empty ? <p className="py-6 text-center text-[13px] text-ink-3">{emptyText}</p> : showTable ? <DataTable {...table} caption={title} /> : children}
    </section>
  );
}

export function DataTable({ columns, rows, caption, className }) {
  return (
    <div className={cn("max-h-80 overflow-auto rounded-md border border-line", className)}>
      <table className="w-full border-collapse text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-raise">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("border-b border-line px-2.5 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3", c.align === "right" ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-line last:border-0">
              {columns.map((c, j) => {
                const value = c.format ? c.format(row[c.key], row) : row[c.key];
                const Cell = j === 0 ? "th" : "td";
                return (
                  <Cell key={c.key} scope={j === 0 ? "row" : undefined} className={cn("px-2.5 py-1.5 font-normal", c.align === "right" ? "figure text-right" : "text-left", j === 0 ? "text-ink" : "text-ink-2")}>
                    {value ?? "—"}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Small legend: swatch + label (+ value). items: [{ label, color, value, pattern }]
export function Legend({ items, className }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-2", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <i aria-hidden className={cn("inline-block h-2.5 w-2.5 rounded-[2px]", item.className)} style={item.color ? { background: item.color } : undefined} />
          {item.label}
          {item.value != null && <span className="figure text-ink">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}
