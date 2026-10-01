import React from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';
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
 * Nút được `active:scale-[0.97]` để có feedback cảm ứng tốt.
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
        'inline-flex items-center justify-center gap-2 active:scale-[0.97]',
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && 'w-full self-stretch',
        isDisabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className={cn('font-semibold', sizeText[size])}>{children}</Text>
      ) : (
        <View className="flex-row items-center gap-2">{children}</View>
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
