import type { Metadata } from "next";
import { NewsGrid } from "@/components/sections/news-grid";
import { apiClient } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Tin tức — CareOnRoad",
  description: "Tin tức, mẹo hay và cẩm nang chăm sóc xe máy.",
};

export default async function NewsPage() {
  const news = await apiClient.listNewsArticles();

  return (
    <>
      <section className="container-page pt-16">
        <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
          Tin tức & cẩm nang
        </span>
        <h1 className="mt-2 text-4xl font-bold text-ink md:text-5xl">
          Cập nhật mới nhất từ CareOnRoad
        </h1>
      </section>
      <NewsGrid items={news} />
    </>
  );
}
