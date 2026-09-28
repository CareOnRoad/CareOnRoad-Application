import type { Metadata } from "next";
import { SignupSection } from "@/components/sections/signup-section";

export const metadata: Metadata = {
  title: "Đăng ký — CareOnRoad",
  description:
    "Tạo tài khoản CareOnRoad miễn phí để sử dụng dịch vụ cứu hộ và bảo dưỡng xe máy.",
};

export default function SignupPage() {
  return <SignupSection />;
}