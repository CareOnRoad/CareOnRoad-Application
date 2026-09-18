import React from 'react';
import { Text, View } from 'react-native';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import { cn } from '@/lib/utils';

/**
 * Banner - inline notice phù hợp với các trạng thái feedback ngắn:
 *  - `error` (đỏ): lỗi form, network, validation.
 *  - `warning` (amber): cảnh báo thân thiện (vd. chế độ demo, sắp hết quota).
 *  - `success` (green): thông báo thành công nội bộ.
 *  - `info` (blue): thông tin bổ sung, không critical.
 *
 * Design principle: alerts nghiêm trọng = đỏ, warning thường = amber.
 */
export function Banner({
  tone,
  title,
  description,
  className,
}: {
  tone: 'error' | 'warning' | 'success' | 'info';
  title?: string;
  description?: string;
  className?: string;
}) {
  const styles = {
    error: {
      container: 'border-red-500/40 bg-red-500/15',
      icon: '#ef4444',
      Icon: AlertCircle,
      titleClass: 'text-red-400',
      descClass: 'text-red-400/80',
    },
    warning: {
      container: 'border-amber-500/40 bg-amber-500/15',
      icon: '#f59e0b',
      Icon: AlertTriangle,
      titleClass: 'text-amber-400',
      descClass: 'text-amber-400/80',
    },
    success: {
      container: 'border-green/30 bg-green/10',
      icon: '#22c55e',
      Icon: CheckCircle2,
      titleClass: 'text-green',
      descClass: 'text-green',
    },
    info: {
      container: 'border-primary/30 bg-primary/10',
      icon: '#1974f7',
      Icon: Info,
      titleClass: 'text-primary',
      descClass: 'text-primary',
    },
  } as const;
  const s = styles[tone];
  const Icon = s.Icon;
  return (
    <View className={cn('flex-row items-start gap-3 rounded-2xl border px-4 py-3', s.container, className)}>
      <Icon size={20} color={s.icon} className="mt-0.5 shrink-0" />
      <View className="flex-1">
        {title && <Text className={cn('text-sm font-semibold', s.titleClass)}>{title}</Text>}
        {description && (
          <Text className={cn('mt-1 text-xs', s.descClass)}>{description}</Text>
        )}
      </View>
    </View>
  );
}
