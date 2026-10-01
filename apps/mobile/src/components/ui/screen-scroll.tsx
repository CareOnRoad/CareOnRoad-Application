import React from 'react';
import {
  ScrollView,
  RefreshControl,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { cn } from '@/lib/utils';

/**
 * ScreenScroll - wrapper ScrollView với padding chuẩn cho mọi màn hình content.
 *
 * Mặc định:
 *  - `paddingHorizontal: 20` (80px screen width padding)
 *  - `paddingTop: 16` (gap với AppHeader bottom border)
 *  - `paddingBottom: 32` (đủ chỗ cho tab bar / safe area bottom)
 *  - `showsVerticalScrollIndicator: false`
 *
 * Caller có thể override qua `contentContainerStyle` hoặc `contentContainerClassName`
 * (NativeWind v4 hỗ trợ cả className cho contentContainer).
 *
 * Calendar grid (`mechanic/(tabs)/schedule.tsx`, `rider/(tabs)/schedule.tsx`) không
 * dùng ScreenScroll vì cần paddingHorizontal riêng cho các cột timeline.
 */
export function ScreenScroll({
  children,
  className,
  contentContainerStyle,
  contentContainerClassName,
  refreshControl,
  ...props
}: ScrollViewProps & {
  contentContainerClassName?: string;
  children?: React.ReactNode;
}) {
  const baseStyle: StyleProp<ViewStyle> = {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  };
  return (
    <ScrollView
      className={cn('flex-1', className)}
      contentContainerClassName={contentContainerClassName}
      contentContainerStyle={[baseStyle, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl ?? <RefreshControl refreshing={false} tintColor="#94a3b8" />}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
