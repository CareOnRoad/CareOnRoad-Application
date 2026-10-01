import type { Metadata } from "next";
import { CtaGlass } from "@/components/sections/cta-glass";
import { RequestForm } from "@/components/sections/request-form";
import { apiClient } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Yêu cầu cứu hộ — CareOnRoad",
  description: "Tạo yêu cầu cứu hộ khẩn cấp hoặc thường.",
};

export default async function RequestPage() {
  const services = await apiClient.listServiceCategories();
  return (
    <>
      <section className="container-page pt-16">
        <span className="text-sm font-semibold uppercase tracking-wider text-accent">
          Yêu cầu cứu hộ
        </span>
        <h1 className="mt-2 text-4xl font-bold text-ink md:text-5xl">
          Tạo yêu cầu mới
        </h1>
      </section>
      <RequestForm services={services} />
      <CtaGlass />
    </>
  );
}
