import type { Metadata } from "next";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareOnRoad — Cứu hộ xe máy 24/7",
  description:
    "Nền tảng kết nối kỹ thuật viên cứu hộ xe máy trên toàn quốc — nhanh chóng, minh bạch, an toàn.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-brand-soft text-ink">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
