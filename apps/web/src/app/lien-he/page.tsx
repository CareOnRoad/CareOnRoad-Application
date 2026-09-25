import type { Metadata } from "next";
import { ContactSection } from "@/components/sections/contact-form";
import { apiClient } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Liên hệ hỗ trợ — CareOnRoad",
  description: "Liên hệ CareOnRoad qua hotline, email hoặc gửi yêu cầu trực tuyến.",
};

export default async function ContactPage() {
  const [channels, faqs] = await Promise.all([
    apiClient.listContactChannels(),
    apiClient.listFaqs(),
  ]);

  return (
    <>
      <section className="container-page pt-16">
        <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
          Liên hệ hỗ trợ
        </span>
        <h1 className="mt-2 text-4xl font-bold text-ink md:text-5xl">
          Chúng tôi luôn sẵn sàng lắng nghe
        </h1>
      </section>
      <ContactSection channels={channels} faqs={faqs} />
    </>
  );
}
