import { ContactSection } from "@/components/sections/contact-form";
import { CtaGlass } from "@/components/sections/cta-glass";
import { EmergencyBanner } from "@/components/sections/emergency-banner";
import { Hero } from "@/components/sections/hero";
import { NewsGrid } from "@/components/sections/news-grid";
import { ProcessSteps } from "@/components/sections/process";
import { ServicesGrid } from "@/components/sections/services-grid";
import { Testimonials } from "@/components/sections/testimonials";
import { apiClient } from "@/lib/api-client";

export default async function HomePage() {
  const [
    highlights,
    stats,
    services,
    steps,
    testimonials,
    news,
    faqs,
    channels,
  ] = await Promise.all([
    apiClient.getHeroHighlights(),
    apiClient.getHeroStats(),
    apiClient.listServiceCategories(),
    apiClient.listProcessSteps(),
    apiClient.listTestimonials(),
    apiClient.listNewsArticles(),
    apiClient.listFaqs(),
    apiClient.listContactChannels(),
  ]);

  return (
    <>
      <Hero highlights={highlights} stats={stats} />
      <ServicesGrid services={services} />
      <ProcessSteps steps={steps} />
      <CtaGlass />
      <EmergencyBanner />
      <Testimonials items={testimonials} />
      <NewsGrid items={news} />
      <ContactSection channels={channels} faqs={faqs} />
    </>
  );
}
