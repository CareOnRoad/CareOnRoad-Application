import type { Metadata } from "next";
import { headers } from "next/headers";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareOnRoad — Cứu hộ xe máy 24/7",
  description:
    "Nền tảng kết nối kỹ thuật viên cứu hộ xe máy trên toàn quốc — nhanh chóng, minh bạch, an toàn.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ẩn Header / Footer marketing cho segment /admin/* (dashboard tự có chrome riêng).
  const h = await headers();
  const pathname = h.get("x-pathname") ?? h.get("x-invoke-path") ?? h.get("referer") ?? "";
  const isAdmin = pathname.includes("/admin");

  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-brand-soft text-ink">
        {!isAdmin ? <Header /> : null}
        <main className="flex-1">{children}</main>
        {!isAdmin ? <Footer /> : null}
      </body>
    </html>
  );
}
