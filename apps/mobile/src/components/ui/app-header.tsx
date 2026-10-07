import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { cn } from '@/lib/utils';

/**
 * AppHeader - header chuẩn cho mọi màn hình.
 *
 * Tones:
 *  - `default`: nền trắng, viền dưới slate-200. Phù hợp màn hình nội dung chính.
 *  - `navy`: nền navy-900, chữ trắng. Phù hợp màn hình hero / on-boarding / tracking.
 *  - `brand`: nền primary blue, chữ trắng. Dùng cho CTA flow nổi bật (đặt lịch, thanh toán).
 *
 * Caller chủ động truyền `right` (NotificationBell, RefreshCw, ...). Không còn bell
 * mặc định với dot đỏ để tránh gây nhiễu khi không có thông báo.
 *
 * Backward-compat: prop `variant` cũ vẫn hoạt động như alias của `tone`.
 */
export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
  variant,
  tone,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** @deprecated dùng `tone` thay thế. Vẫn hoạt động như alias. */
  variant?: 'default' | 'navy';
  tone?: 'default' | 'navy' | 'brand';
}) {
  const resolvedTone = tone ?? variant ?? 'default';
  const isNavy = resolvedTone === 'navy';
  const isBrand = resolvedTone === 'brand';
  const isDark = isNavy || isBrand;
  const insets = useSafeAreaInsets();
  // Đẩy nội dung xuống dưới status bar / notch bằng top inset.
  // Caller không cần wrap SafeAreaView riêng.
  const topInset = Math.max(insets.top, 0);
  return (
    <View
      className={cn(
        'flex-row items-center gap-3 px-5 pb-4',
        isNavy && 'bg-navy',
        isBrand && 'bg-primary',
        !isDark && 'border-b border-border bg-card',
      )}
      style={{ paddingTop: topInset + 20 }}
    >
      {onBack && (
        <Pressable
          onPress={onBack}
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          style={({ pressed }) => [
            {
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <View
            className={cn(
              'size-9 shrink-0 items-center justify-center rounded-full',
              isDark ? 'bg-white/10' : 'bg-secondary',
            )}
          >
            <ArrowLeft size={20} color={isDark ? '#ffffff' : '#16202f'} />
          </View>
        </Pressable>
      )}
      <View className="min-w-0 flex-1">
        <Text
          className={cn(
            'truncate text-lg font-bold leading-tight',
            isDark ? 'text-white' : 'text-foreground',
          )}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            className={cn('truncate text-sm', isDark ? 'text-white/70' : 'text-muted-foreground')}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

/**
 * HeaderBell - bell icon nhỏ dùng làm default right cho các màn hình không custom.
 * Không có badge đỏ (caller tự thêm nếu cần). Giữ backward-compat với call sites
 * đã từng nhận default bell từ AppHeader.
 */
export function HeaderBell({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Thông báo"
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
    >
      <View className="size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bell size={18} color="#16202f" />
      </View>
    </Pressable>
  );
}
