import React from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'neutral';

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: 'bg-primary/10', fg: '#1974f7' },
  green: { bg: 'bg-green/10', fg: '#145413' },
  amber: { bg: 'bg-amber-500/15', fg: '#d97706' },
  red: { bg: 'bg-destructive/10', fg: '#ed3f3a' },
  neutral: { bg: 'bg-secondary', fg: '#16202f' },
};

/**
 * StatTile - tile thống kê dùng cho quick stats row.
 *
 * Layout đồng nhất:
 *  - Card với `flex-1` (caller bọc trong `flex-row gap-3`)
 *  - Icon trong box 40x40 với tone color (top)
 *  - Value (text-2xl bold, hoặc text-base khi small)
 *  - Label (text-xs muted-foreground)
 *
 * Variants:
 *  - `tone`: blue/green/amber/red/neutral — đổi màu icon box
 *  - `small`: dùng cho value ngắn (VND, %)
 *
 * Cách dùng:
 * ```tsx
 * <View className="flex-row gap-3">
 *   <StatTile icon={Bike} tone="blue" label="Xe đã đăng ký" value="3" />
 * </View>
 * ```
 */
export function StatTile({
  icon: Icon,
  tone = 'blue',
  label,
  value,
  small = false,
}: {
  icon: LucideIcon;
  tone?: Tone;
  label: string;
  value: string | number;
  small?: boolean;
}) {
  const t = toneStyles[tone];
  return (
    <Card className="flex-1 items-center p-4">
      <View className={cn('mb-2 size-10 items-center justify-center rounded-2xl', t.bg)}>
        <Icon size={18} color={t.fg} />
      </View>
      <Text
        className={cn(
          'font-bold text-foreground',
          small ? 'text-base' : 'text-2xl',
        )}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text className="mt-0.5 text-center text-xs text-muted-foreground" numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}
