import React from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline' | 'mint';
type Size = 'sm' | 'md';

const variantStyles: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  ghost: 'bg-transparent text-foreground',
  outline: 'border border-border bg-transparent text-foreground',
  mint: 'bg-mint text-green',
};

/**
 * Màu chữ theo variant.
 *
 * `variantStyles` đặt `text-*` trên container — nhưng React Native KHÔNG kế
 * thừa `color` từ View/Pressable xuống Text. Nên khi children là chuỗi,
 * `<Text>` phải tự mang class màu chữ, nếu không sẽ ra chữ màu mặc định
 * (đen) — dễ bị chìm hoặc mất tương phản trên nền trùng màu.
 */
const variantTextStyles: Record<Variant, string> = {
  primary: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  destructive: 'text-destructive-foreground',
  ghost: 'text-foreground',
  outline: 'text-foreground',
  mint: 'text-green',
};

const sizeStyles: Record<Size, string> = {
  sm: 'rounded-xl px-3 py-2',
  md: 'rounded-2xl px-5 py-3',
};

const sizeText: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-sm',
};

/**
 * ActionButton - nút hành động chính với 6 variant và 2 size.
 *
 * Variants:
 *  - `primary`: CTA chính (Submit, Save, Request Assistance...)
 *  - `destructive`: hành động phá huỷ (Delete, Cancel request...)
 *  - `outline`: CTA phụ / neutral action.
 *  - `mint`: CTA nhấn mạnh trên nền primary (CTA trên hero card).
 *  - `secondary`: hành động tạm (Filter, Sort...).
 *  - `ghost`: hành động cực nhẹ (Close icon, link).
 *
 * Sizes:
 *  - `md` (mặc định): padding đầy đủ `px-5 py-3`, dùng cho form / hero CTA.
 *  - `sm`: padding nhỏ `px-3 py-2`, dùng cho CTA inline (trong card, in-row button).
 *
 * ⚠️ Layout contract (sửa bug "nút chỉ hiện pill màu, không có chữ"):
 *  - `className` của caller phải áp lên `<Pressable>` GỐC — chính Pressable
 *    mới là flex item của container cha (ví dụ `flex-row gap-3`).
 *    Nếu bọc thêm một `<View>` bên trong và đặt `flex-1` lên View con,
 *    thì `flex-1` = `flexBasis: 0%` khiến **chiều cao content box = 0**
 *    (padding vẫn còn) → chữ bị clip hoàn toàn, chỉ còn một "pill" màu.
 *  - Không dùng `inline-flex`: React Native không hỗ trợ `display:inline-flex`,
 *    NativeWind bỏ qua class này (kèm cảnh báo) → phải dùng `flex-row` rõ ràng.
 *  - Không dùng `style={({ pressed }) => ...}` cùng lúc với `className`:
 *    NativeWind ghi đè `style` bằng style từ className. Dùng variant
 *    `active:` của Tailwind để có feedback cảm ứng.
 */
export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  fullWidth,
  disabled,
  ...props
}: ActionButtonProps) {
  const isDisabled = Boolean(disabled);
  return (
    <Pressable
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      className={cn(
        'flex-row items-center justify-center gap-2 active:scale-[0.97] active:opacity-80',
        sizeStyles[size],
        variantStyles[variant],
        // `w-full` cho chiều rộng; `shrink` để nhiều nút trong `flex-row`
        // không tràn (RN mặc định flexShrink = 0).
        fullWidth && 'w-full self-stretch shrink',
        isDisabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className={cn('font-semibold', sizeText[size], variantTextStyles[variant])}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

interface ActionButtonProps extends Omit<PressableProps, 'children'> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}
