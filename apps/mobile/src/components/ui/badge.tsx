import React from 'react';
import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'blue' | 'green' | 'red' | 'amber';

// Background color for View, text color for Text
const toneStyles: Record<BadgeTone, { bg: string; text: string }> = {
  neutral: { bg: 'bg-secondary', text: 'text-secondary-foreground' },
  blue: { bg: 'bg-primary/10', text: 'text-primary' },
  green: { bg: 'bg-green/10', text: 'text-green' },
  red: { bg: 'bg-destructive/10', text: 'text-destructive' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-600' },
};

/**
 * Badge - nhãn trạng thái/loại nhỏ gọn. 5 tone khớp với semantic của hệ thống:
 *  neutral (slate), blue (primary), green (success), red (destructive), amber (warning).
 */
export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  const s = toneStyles[tone];
  return (
    <View className={cn('inline-flex flex-row items-center gap-1 self-start rounded-full px-2.5 py-1', s.bg, className)}>
      {typeof children === 'string' ? (
        <Text className={cn('text-xs font-semibold', s.text)}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}
