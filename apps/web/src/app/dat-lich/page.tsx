import type { Metadata } from "next";
import { BookingForm } from "@/components/sections/booking-form";
import { CtaGlass } from "@/components/sections/cta-glass";
import { apiClient } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Đặt lịch — CareOnRoad",
  description: "Đặt lịch trước cho dịch vụ cứu hộ và bảo dưỡng xe máy.",
};

export default async function BookingPage() {
  const slots = await apiClient.listBookingSlots();

  return (
    <>
      <section className="container-page pt-16">
        <span className="text-sm font-semibold uppercase tracking-wider text-brand-deep">
          Đặt lịch
        </span>
        <h1 className="mt-2 text-4xl font-bold text-ink md:text-5xl">
          Chọn khung giờ thuận tiện
        </h1>
      </section>
      <BookingForm slots={slots} />
      <CtaGlass />
    </>
  );
}
