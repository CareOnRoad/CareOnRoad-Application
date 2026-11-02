import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The header of an admin page.
 *
 * Every tab uses it, so the title, the backend endpoint that feeds the page
 * and the back link are always present. Showing the endpoint is deliberate:
 * an admin can tell exactly which API the numbers come from, and a
 * mis-wired tab is obvious.
 */
export function PageHeader({
  title,
  description,
  endpoint,
  backHref,
  backLabel = "Quay lại",
  actions
}: {
  title: string;
  description?: string;
  /** The backend path that feeds this page. */
  endpoint?: string;
  backHref?: string;
  backLabel?: string;
  /** Buttons or filters rendered on the right side. */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {backHref ? (
            <Link
              href={backHref}
              className="text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: "#3d6dcc" }}
            >
              ← {backLabel}
            </Link>
          ) : null}
          <h1 className="text-xl font-bold" style={{ color: "#162130" }}>
            {title}
          </h1>
          {description ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {endpoint ? (
        <p className="text-[11px] font-mono" style={{ color: "#6b7a8d" }}>
          Nguồn dữ liệu: {endpoint}
        </p>
      ) : null}
    </header>
  );
}

/**
 * An empty-state panel.
 *
 * Used when a list is genuinely empty — never as a substitute for a failed
 * request. A failed request renders an error panel instead, so "no data" is
 * never confused with "could not load".
 */
export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl bg-white p-10 text-center shadow-sm"
      style={{ border: "1px solid #e5e9ef" }}
    >
      <p className="text-sm font-semibold" style={{ color: "#162130" }}>
        {title}
      </p>
      {description ? (
        <p className="max-w-md text-xs" style={{ color: "#3d4d63" }}>
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}

/**
 * An error panel.
 *
 * The wording never claims the data is empty — a failed request must be
 * visibly different from an empty result.
 */
export function ErrorState({
  title = "Không tải được dữ liệu",
  message,
  action
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-start gap-2 rounded-2xl p-5 shadow-sm"
      style={{ background: "rgba(252,85,95,0.08)", border: "1px solid rgba(252,85,95,0.3)" }}
      role="alert"
    >
      <p className="text-sm font-semibold" style={{ color: "#b3131d" }}>
        {title}
      </p>
      {message ? (
        <p className="text-xs" style={{ color: "#3d4d63" }}>
          {message}
        </p>
      ) : null}
      {action}
    </div>
  );
}

/** A card wrapper with the standard admin surface styling. */
export function Panel({
  title,
  description,
  actions,
  children
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm"
      style={{ border: "1px solid #e5e9ef" }}
    >
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-bold" style={{ color: "#162130" }}>
              {title}
            </h2>
            {description ? (
              <p className="text-xs" style={{ color: "#3d4d63" }}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
