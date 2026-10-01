import React from 'react';
import { View, type ViewProps } from 'react-native';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * HeroCard - hero card navy `bg-navy` với padding `p-5` chuẩn hoá.
 *
 * Dùng cho:
 *  - Trang chủ (greeting + CTA)
 *  - Dashboard thợ (greeting + rating)
 *  - Profile (avatar + info)
 *  - Các flow nổi bật (Rescue flow, Up Next card dùng `bg-green` riêng)
 *
 * Padding `p-5` (20px) đồng nhất giữa các hero. Override qua `className` nếu cần.
 */
export function HeroCard({
  children,
  className,
  ...rest
}: ViewProps & { className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn('overflow-hidden border-0 bg-navy', className)} {...rest}>
      <View className="p-5">{children}</View>
    </Card>
  );
}
