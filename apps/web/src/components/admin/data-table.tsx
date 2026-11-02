import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The shared table for every admin list.
 *
 * Pagination is FORWARD-ONLY because the backend cursor is opaque and
 * cannot be inverted. The "Trang trước" action is therefore a browser
 * history step, not a cursor arithmetic: the admin navigates forward with
 * `?cursor=…` and goes back with the browser's back button.
 */

export type AdminTableColumn<T> = {
  /** The column header. */
  header: string;
  /** The cell renderer. */
  render: (row: T) => ReactNode;
  /** A stable key for the column, used for the accessible header id. */
  key: string;
  /** Extra class for the cell. */
  className?: string;
};

export type AdminTablePage = {
  limit: number;
  has_more: boolean;
  next_cursor?: string;
};

export function DataTable<T>({
  columns,
  rows,
  emptyLabel = "Không có dữ liệu.",
  caption,
  rowKey
}: {
  columns: AdminTableColumn<T>[];
  rows: T[];
  emptyLabel?: string;
  caption?: string;
  /**
   * The React key of each row.
   *
   * Most admin entities are keyed by `id`, but a few are not: a mechanic is
   * keyed by `user_id` and a work-history row by `assignment_id`. The key is
   * therefore resolved through a resolver instead of a hard-coded `id`
   * constraint, so any shape can be tabled.
   */
  rowKey: (row: T, index: number) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl p-6 text-center text-sm" style={{ color: "#3d4d63" }}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e9ef" }}>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider ${column.className ?? ""}`}
                style={{ color: "#3d4d63" }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} style={{ borderBottom: "1px solid #f1f4f8" }}>
              {columns.map((column) => (
                <td key={column.key} className={`px-3 py-2.5 align-middle ${column.className ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Cursor pagination controls.
 *
 * `buildHref` receives the next cursor and must produce the URL of the NEXT
 * page (including every active filter, otherwise the filter is silently
 * dropped when paging).
 */
export function CursorPagination({
  page,
  buildHref,
  backHref,
  backLabel = "← Trang trước"
}: {
  page: AdminTablePage;
  buildHref: (cursor: string) => string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs"
      aria-label="Phân trang"
    >
      <span style={{ color: "#3d4d63" }}>
        Tối đa {page.limit} bản ghi/trang
        {page.has_more ? " · còn trang sau" : " · đã hết dữ liệu"}
      </span>
      <div className="flex items-center gap-2">
        {backHref ? (
          <Link
            href={backHref}
            className="rounded-lg px-3 py-1.5 font-semibold"
            style={{ backgroundColor: "#e5e9ef", color: "#162130" }}
          >
            {backLabel}
          </Link>
        ) : null}
        {page.has_more && page.next_cursor ? (
          <Link
            href={buildHref(page.next_cursor)}
            className="rounded-lg px-3 py-1.5 font-semibold text-white"
            style={{ backgroundColor: "#162130" }}
          >
            Trang sau →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/**
 * Builds a "next page" href that preserves every current filter.
 *
 * The cursor replaces the `cursor` param; everything else is carried over.
 */
export function buildCursorHref(
  searchParams: Record<string, string | undefined>,
  cursor: string
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (!value || key === "cursor") {
      continue;
    }
    params.set(key, value);
  }
  params.set("cursor", cursor);
  return `?${params.toString()}`;
}

/** Renders a timestamp in the Vietnamese locale, defensively. */
export function formatDateTime(value?: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(date);
}

/** Renders a VND amount. */
export function formatVnd(amount?: number): string {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(amount);
}
