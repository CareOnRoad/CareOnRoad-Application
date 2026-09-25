import { StarIcon } from "@/components/ui/icons";
import type { Testimonial } from "@/types";

export function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <section className="container-page py-20">
      <div className="mb-10 flex flex-col gap-3 md:max-w-2xl">
        <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
          Khách hàng nói gì
        </span>
        <h2 className="text-3xl font-bold text-ink md:text-4xl">
          Đánh giá thực tế từ người đã sử dụng
        </h2>
      </div>

      <ul className="grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex h-full flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 shadow-card"
          >
            <div
              className="flex items-center gap-1 text-warning"
              aria-label={`${item.rating} trên 5 sao`}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon
                  key={i}
                  className={`h-4 w-4 ${i < item.rating ? "text-warning" : "text-border"}`}
                />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">“{item.body}”</p>
            <div className="mt-auto border-t border-border-soft pt-4 text-sm">
              <span className="font-semibold text-ink">{item.authorName}</span>
              <span className="ml-2 text-ink-subtle">
                {new Date(item.date).toLocaleDateString("vi-VN")}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
