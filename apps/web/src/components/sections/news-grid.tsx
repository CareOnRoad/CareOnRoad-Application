import Link from "next/link";
import type { NewsArticle } from "@/types";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export function NewsGrid({ items }: { items: NewsArticle[] }) {
  return (
    <section className="container-page py-20">
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
            Tin tức & cẩm nang
          </span>
          <h2 className="mt-2 text-3xl font-bold text-ink md:text-4xl">
            Mẹo hay và cập nhật mới nhất
          </h2>
        </div>
        <Link
          href="/tin-tuc"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep hover:underline"
        >
          Xem tất cả bài viết →
        </Link>
      </div>

      <ul className="grid gap-6 md:grid-cols-3">
        {items.map((article) => (
          <li
            key={article.id}
            className="flex h-full flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-card transition-shadow hover:shadow-pop"
          >
            <div
              aria-hidden
              className="h-44 w-full"
              style={{ background: article.coverColor }}
            />
            <div className="flex flex-1 flex-col gap-3 p-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-deep">
                {article.category}
              </span>
              <h3 className="text-lg font-semibold text-ink">
                <Link href={`/tin-tuc/${article.slug}`} className="hover:underline">
                  {article.title}
                </Link>
              </h3>
              <p className="text-sm text-ink-muted">{article.excerpt}</p>
              <span className="mt-auto text-xs text-ink-subtle">
                {formatDate(article.publishedAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
