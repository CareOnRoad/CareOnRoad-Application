import { z } from "zod";

import { planCodes } from "@/features/plans/plan";

/**
 * Scheme deep-link được phép dùng cho `return_url` / `cancel_url`.
 *
 * - `careonroad`: app build (dev client / release) — scheme khai báo trong `app.config.ts`.
 * - `exp` / `exps`: Expo Go — deep link trả về app khi đang test trên Expo.
 *
 * KHÔNG cho phép `http`/`https` vì mục đích của URL này là quay lại app,
 * không phải mở web. Backend cũng có URL return mặc định từ env
 * (`PAYOS_SUBSCRIPTION_RETURN_URL`) để fallback.
 */
export const ALLOWED_DEEP_LINK_SCHEMES = ["careonroad", "exp", "exps"] as const;

const deepLinkUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
      const scheme = value.slice(0, value.indexOf("://")).toLowerCase();
      return (ALLOWED_DEEP_LINK_SCHEMES as readonly string[]).includes(scheme);
    },
    {
      message: "Only careonroad://, exp:// and exps:// deep links are allowed."
    }
  );

/**
 * Input tạo đơn đăng ký gói.
 *
 * `non_refundable_acknowledged` bắt buộc = true: người dùng phải xác nhận
 * đã hiểu điều khoản "đã mua không được hoàn tiền" trước khi thanh toán.
 *
 * `return_url` / `cancel_url` là deep-link về app (tuỳ chọn). Khi có, payOS
 * sẽ chuyển người dùng thẳng về app sau khi thanh toán — thay vì mở một
 * trang web trống. Nếu không có, backend dùng URL cấu hình từ env.
 */
export const createSubscriptionOrderSchema = z
  .object({
    plan_code: z.enum(planCodes),
    non_refundable_acknowledged: z.literal(true),
    return_url: deepLinkUrlSchema.optional(),
    cancel_url: deepLinkUrlSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.plan_code === "free") {
      context.addIssue({
        code: "custom",
        path: ["plan_code"],
        message: "The free plan cannot be purchased."
      });
    }
  });

export const subscriptionOrderIdParamSchema = z.string().uuid();

export type CreateSubscriptionOrderInput = z.infer<typeof createSubscriptionOrderSchema>;
