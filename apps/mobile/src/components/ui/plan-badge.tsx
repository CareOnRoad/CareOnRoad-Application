import React from 'react';
import { Text, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PlanCode } from '@/lib/auth-types';

const planTone: Record<PlanCode, BadgeTone> = {
  free: 'neutral',
  advance: 'blue',
  vip: 'amber',
};

const planName: Record<PlanCode, string> = {
  free: 'FREE',
  advance: 'ADVANCE',
  vip: 'VIP',
};

/**
 * PlanBadge - nhãn gói của rider (FREE / ADVANCE / VIP).
 *
 * Tone theo hạng: free = neutral, advance = blue, vip = amber.
 * `expiryText` hiển thị hạn dùng kèm theo (vd. "Hết hạn 30/11/2026").
 */
export function PlanBadge({
  plan,
  expiryText,
  className,
}: {
  plan?: PlanCode | null;
  expiryText?: string;
  className?: string;
}) {
  const code: PlanCode = plan === 'advance' || plan === 'vip' ? plan : 'free';
  const label = planName[code];
  if (!expiryText) {
    return (
      <Badge tone={planTone[code]} className={className}>
        {label}
      </Badge>
    );
  }
  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      <Badge tone={planTone[code]}>{label}</Badge>
      <Text className="text-xs text-muted-foreground">{expiryText}</Text>
    </View>
  );
}
