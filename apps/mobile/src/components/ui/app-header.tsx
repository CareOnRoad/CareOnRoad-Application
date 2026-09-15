import React from 'react';
import { Pressable, Text, View, type ViewProps } from 'react-native';
import { ArrowLeft, Bell, ChevronDown, ChevronRight } from 'lucide-react-native';
import { cn } from '@/lib/utils';

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
        isNavy ? 'bg-navy' : 'border-b border-border bg-card/95',
      )}
    >
      {onBack && (
        <Pressable
          onPress={onBack}
          accessibilityLabel="Go back"
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
          accessibilityLabel="Notifications"
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

export { ChevronDown, ChevronRight };
