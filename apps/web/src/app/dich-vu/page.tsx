import type { Metadata } from "next";
import { ContactSection } from "@/components/sections/contact-form";
import { CtaGlass } from "@/components/sections/cta-glass";
import { ServicesGrid } from "@/components/sections/services-grid";
import { apiClient } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Dịch vụ — CareOnRoad",
  description: "Tổng hợp các dịch vụ cứu hộ và bảo dưỡng xe máy của CareOnRoad.",
};

export default async function ServicesPage() {
  const [services, channels, faqs] = await Promise.all([
    apiClient.listServiceCategories(),
    apiClient.listContactChannels(),
    apiClient.listFaqs(),
  ]);

  return (
    <>
      <section className="container-page pt-16">
        <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
          Dịch vụ
        </span>
        <h1 className="mt-2 text-4xl font-bold text-ink md:text-5xl">
          Danh mục dịch vụ cứu hộ & bảo dưỡng
        </h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Tất cả dịch vụ đều có báo giá minh bạch trước khi xử lý. Kỹ thuật
          viên sẽ xác nhận chi phí tại hiện trường.
        </p>
      </section>
      <ServicesGrid services={services} />
      <CtaGlass />
      <ContactSection channels={channels} faqs={faqs} />
    </>
  );
}
