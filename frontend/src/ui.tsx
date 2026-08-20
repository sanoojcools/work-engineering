import type { FormEvent, ReactNode } from "react";

export function Banner({ kind, children }: { kind: "error" | "info" | "ok"; children: ReactNode }) {
  return <div className={`banner ${kind}`}>{children}</div>;
}

export function Loading() {
  return <p className="health">Loading…</p>;
}

export function Field({
  label,
  children,
  span2 = false,
}: {
  label: string;
  children: ReactNode;
  span2?: boolean;
}) {
  return (
    <label className={span2 ? "span-2" : undefined}>
      {label}
      {children}
    </label>
  );
}

export function Form({
  onSubmit,
  children,
  className = "form-grid",
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(event);
      }}
    >
      {children}
    </form>
  );
}

type Column<T> = { key: string; header: string; render?: (row: T) => ReactNode };

export function DataTable<T extends { id: number }>({
  rows,
  columns,
  onRowClick,
  selectedId,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  selectedId?: number | null;
}) {
  if (rows.length === 0) {
    return <p className="health">No rows yet.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={selectedId === row.id ? "selected" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ ok, children }: { ok?: boolean; children: ReactNode }) {
  return <span className={ok ? "badge ok" : "badge"}>{children}</span>;
}
