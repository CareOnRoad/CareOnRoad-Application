import React from 'react';
import { Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * EmptyState - hiển thị placeholder thân thiện khi danh sách rỗng.
 *
 * Design principles:
 *  - Icon nền `bg-secondary` (slate-100) để tạo chiều sâu nhẹ, không phô trương.
 *  - Title bold, description muted: người dùng hiểu ngay lý do trống.
 *  - `action` tuỳ chọn: caller truyền 1 button/CTA để hướng user ra khỏi trạng thái rỗng.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = 'neutral',
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Màu tone của icon container. */
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'destructive';
}) {
  const toneStyles: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: 'bg-secondary', fg: '#64748b' },
    primary: { bg: 'bg-primary/10', fg: '#1974f7' },
    success: { bg: 'bg-green/10', fg: '#145413' },
    warning: { bg: 'bg-amber-500/15', fg: '#d97706' },
    destructive: { bg: 'bg-destructive/10', fg: '#ed3f3a' },
  };
  const s = toneStyles[tone] ?? toneStyles.neutral;
  return (
    <Card className={cn('items-center gap-3 px-6 py-10', className)}>
      {Icon && (
        <View className={cn('size-14 items-center justify-center rounded-2xl', s.bg)}>
          <Icon size={28} color={s.fg} />
        </View>
      )}
      <Text className="text-center font-semibold text-foreground">{title}</Text>
      {description && (
        <Text className="text-center text-sm text-muted-foreground">{description}</Text>
      )}
      {action && <View className="mt-1 w-full">{action}</View>}
    </Card>
  );
}
