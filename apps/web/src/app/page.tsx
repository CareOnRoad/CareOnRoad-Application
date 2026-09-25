import { ContactQuickLink } from "@/components/sections/contact-quick-link";
import { FeaturedBlog } from "@/components/sections/featured-blog";
import { Hero } from "@/components/sections/hero-figma";
import { IntroSection } from "@/components/sections/intro-section";
import { ServicesGrid } from "@/components/sections/services-grid-figma";

/**
 * Trang chủ (/) — strict theo frame figma "trang chủ" (node 38:2043, 1440×3180).
 * Thứ tự section:
 *   1. Hero
 *   2. Intro Section (Về chúng tôi)
 *   3. Services Grid (4 cards: Bảo dưỡng / Thay nhớt / Sửa chữa lưu động / Cứu hộ khẩn cấp)
 *   4. Featured Blog (3 bài viết)
 *   5. Contact Quick Link (pill xanh hotline)
 *
 * Footer nằm trong app/layout.tsx (component 38:2081 từ Design System).
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <IntroSection />
      <ServicesGrid />
      <FeaturedBlog />
      <ContactQuickLink />
    </>
  );
}
