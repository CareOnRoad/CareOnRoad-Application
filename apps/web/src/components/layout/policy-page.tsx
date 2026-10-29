import type { ReactNode } from "react";

interface Props {
  title: string;
  intro?: ReactNode;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Layout dùng chung cho các trang chính sách pháp lý.
 * - Tiêu đề + ngày cập nhật + phần mở đầu tóm tắt.
 * - Body render với prose HTML thân thiện mobile.
 * - Toàn bộ nội dung phải tuân thủ pháp luật Việt Nam (Nghị định 13/2023/NĐ-CP)
 *   và chính sách Google Play (Account deletion, Data safety, User Data Policy).
 */
export function PolicyPage({ title, intro, lastUpdated, children }: Props) {
  return (
    <section className="container-page py-12 md:py-16">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold leading-tight text-ink md:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-ink-subtle">
            Cập nhật lần cuối: <time>{lastUpdated}</time>
          </p>
          {intro ? (
            <div className="rounded-2xl border border-border-soft bg-brand-soft/40 p-5 text-sm leading-6 text-ink-muted">
              {intro}
            </div>
          ) : null}
        </header>
        <div className="flex flex-col gap-6 text-base leading-7 text-ink-muted [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:gap-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:gap-1 [&_li]:my-1 [&_a]:text-brand-deep [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-ink [&_table]:my-2 [&_table_th]:border [&_table_th]:border-border-soft [&_table_th]:bg-brand-soft/40 [&_table_th]:px-3 [&_table_th]:py-2 [&_table_th]:text-left [&_table_td]:border [&_table_td]:border-border-soft [&_table_td]:px-3 [&_table_td]:py-2">
          {children}
        </div>
      </div>
    </section>
  );
}
