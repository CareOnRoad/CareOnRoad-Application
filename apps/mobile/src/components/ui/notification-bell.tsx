import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { cn } from '@/lib/utils';

/**
 * NotificationBell - bell icon với badge đếm unread.
 *
 * Dùng được cả 2 role (rider + mechanic). Tông màu icon/badge đổi theo `tone`:
 *  - `default`: nền secondary, icon slate-900 (trên header trắng).
 *  - `navy`: nền white/10, icon trắng (trên header navy).
 *  - `brand`: nền white/10, icon trắng (trên header primary blue).
 *
 * Badge chỉ hiển thị khi `count > 0`. Nếu `count > 99` sẽ hiển thị `99+`.
 *
 * Cách dùng trong AppHeader:
 * ```tsx
 * <AppHeader
 *   title="Trang chủ"
 *   right={<NotificationBell count={unread} onPress={() => router.push('/rider/notifications')} />}
 * />
 * ```
 */
export function NotificationBell({
  count = 0,
  tone = 'default',
  onPress,
  accessibilityLabel = 'Mở thông báo',
}: {
  count?: number;
  tone?: 'default' | 'navy' | 'brand';
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const isDark = tone === 'navy' || tone === 'brand';
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className={cn(
        'relative size-9 items-center justify-center rounded-full active:scale-95',
        isDark ? 'bg-white/10' : 'bg-secondary',
      )}
    >
      <Bell size={16} color={isDark ? '#ffffff' : '#16202f'} />
      {count > 0 && (
        <View className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5">
          <Text className="text-[10px] font-bold text-destructive-foreground">
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
