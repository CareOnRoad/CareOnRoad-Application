import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { cn } from '@/lib/utils';

/**
 * AppHeader - header chuẩn cho mọi màn hình.
 *
 * Variants:
 *  - `default`: nền trắng, viền dưới slate-200. Phù hợp màn hình nội dung chính.
 *  - `navy`: nền navy-900, chữ trắng. Phù hợp màn hình hero / on-boarding / tracking.
 *
 * Mặc định hiển thị 1 nút bell ở góc phải (notifications). Caller có thể override
 * qua prop `right`.
 */
export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
  variant = 'default',
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  variant?: 'default' | 'navy';
}) {
  const isNavy = variant === 'navy';
  return (
    <View
      className={cn(
        'flex-row items-center gap-3 px-5 pb-4 pt-5',
        isNavy ? 'bg-navy' : 'border-b border-border bg-card',
      )}
    >
      {onBack && (
        <Pressable
          onPress={onBack}
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          className={cn(
            'size-9 shrink-0 items-center justify-center rounded-full active:scale-95',
            isNavy ? 'bg-white/10' : 'bg-secondary',
          )}
        >
          <ArrowLeft size={20} color={isNavy ? '#ffffff' : '#16202f'} />
        </Pressable>
      )}
      <View className="min-w-0 flex-1">
        <Text
          className={cn(
            'truncate text-lg font-bold leading-tight',
            isNavy ? 'text-white' : 'text-foreground',
          )}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            className={cn('truncate text-sm', isNavy ? 'text-white/70' : 'text-muted-foreground')}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? (
        <Pressable
          accessibilityLabel="Thông báo"
          accessibilityRole="button"
          className={cn(
            'relative size-9 shrink-0 items-center justify-center rounded-full active:scale-95',
            isNavy ? 'bg-white/10' : 'bg-secondary',
          )}
        >
          <Bell size={18} color={isNavy ? '#ffffff' : '#16202f'} />
          <View className="absolute right-2 top-2 size-2 rounded-full bg-destructive" />
        </Pressable>
      )}
    </View>
  );
}
