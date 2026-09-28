import type { Metadata } from "next";
import { LoginSection } from "@/components/sections/login-section";

export const metadata: Metadata = {
  title: "Đăng nhập — CareOnRoad",
  description:
    "Đăng nhập CareOnRoad để theo dõi yêu cầu cứu hộ, đặt lịch bảo dưỡng và quản lý hồ sơ xe máy của bạn.",
};

export default function LoginPage() {
  return <LoginSection />;
}