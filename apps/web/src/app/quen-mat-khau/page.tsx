import type { Metadata } from "next";
import { ForgotPasswordSection } from "@/components/sections/forgot-password-section";

export const metadata: Metadata = {
  title: "Quên mật khẩu — CareOnRoad",
  description:
    "Đặt lại mật khẩu CareOnRoad qua email — chúng tôi sẽ gửi liên kết an toàn để bạn tạo mật khẩu mới.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordSection />;
}