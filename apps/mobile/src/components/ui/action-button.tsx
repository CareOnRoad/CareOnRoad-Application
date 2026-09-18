import React from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline' | 'mint';

const variantStyles: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  ghost: 'bg-transparent text-foreground',
  outline: 'border border-border bg-transparent text-foreground',
  mint: 'bg-mint text-green',
};

/**
 * ActionButton - nút hành động chính với 6 variant.
 *
 * Nguyên tắc sử dụng:
 *  - `primary`: CTA chính (Submit, Save, Request Assistance...)
 *  - `destructive`: hành động phá huỷ (Delete, Cancel request...)
 *  - `outline`: CTA phụ / neutral action.
 *  - `mint`: CTA nhấn mạnh trên nền primary (CTA trên hero card).
 *  - `secondary`: hành động tạm (Filter, Sort...).
 *  - `ghost`: hành động cực nhẹ (Close icon, link).
 *
 * Nút được `active:scale-[0.97]` để có feedback cảm ứng tốt.
 */
export function ActionButton({
  children,
  variant = 'primary',
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
        'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 active:scale-[0.97]',
        variantStyles[variant],
        fullWidth && 'w-full self-stretch',
        isDisabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className="text-sm font-semibold">{children}</Text>
      ) : (
        <View className="flex-row items-center gap-2">{children}</View>
      )}
    </Pressable>
  );
}

interface ActionButtonProps extends Omit<PressableProps, 'children'> {
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}
