import React from 'react';
import { Pressable, Text, View, type PressableProps, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

interface CardProps extends ViewProps {
  onPress?: () => void;
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Card - container bo góc 24px, viền nhẹ, đổ bóng subtle.
 * Dùng làm khối chính cho mọi nội dung (stat, list item, banner...).
 *
 * Khi có onPress sẽ tự thêm active:scale-[0.98] để feedback tốt hơn.
 */
export function Card({ children, className, onPress, interactive, ...rest }: CardProps) {
  const merged = cn(
    'w-full rounded-3xl border border-border bg-card shadow-sm',
    (onPress || interactive) && 'active:scale-[0.98]',
    className,
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={merged} {...(rest as PressableProps)}>
        {children}
      </Pressable>
    );
  }

  return (
    <View className={merged} {...rest}>
      {children}
    </View>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={cn('text-base font-bold text-foreground', className)}>{children}</Text>;
}
