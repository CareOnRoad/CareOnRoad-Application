import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';

/**
 * ToggleRow - hàng setting có switch bật/tắt ở cuối.
 * Dùng trong nhóm Settings (notifications, dark mode, language...).
 *
 * Switch tuân thủ accessibilityRole="switch" + state checked để screen reader
 * đọc đúng vai trò.
 */
export function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <View className="size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon size={16} color="#16202f" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {description && (
          <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
        )}
      </View>
      <Pressable
        onPress={onChange}
        accessibilityRole="switch"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        className={cn('h-6 w-11 shrink-0 rounded-full', checked ? 'bg-primary' : 'bg-muted')}
      >
        <View
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </Pressable>
    </View>
  );
}

/**
 * RowIcon - icon vuông bo góc dùng ở đầu các list-row (avatar icon).
 */
export function RowIcon({ icon: Icon, tone = 'neutral' }: { icon: LucideIcon; tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red' }) {
  const toneStyles = {
    neutral: 'bg-secondary',
    blue: 'bg-primary/10',
    green: 'bg-green/10',
    amber: 'bg-amber-500/15',
    red: 'bg-destructive/10',
  } as const;
  const toneIconColor = {
    neutral: '#16202f',
    blue: '#1974f7',
    green: '#145413',
    amber: '#d97706',
    red: '#ed3f3a',
  } as const;
  return (
    <View className={cn('size-9 shrink-0 items-center justify-center rounded-xl', toneStyles[tone])}>
      <Icon size={16} color={toneIconColor[tone]} />
    </View>
  );
}

/**
 * NavRow - hàng điều hướng (icon + label + chevron bên phải).
 */
export function NavRow({
  icon,
  label,
  description,
  onPress,
  right,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 p-4 active:bg-secondary/40"
    >
      <RowIcon icon={icon} />
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {description && (
          <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
        )}
      </View>
      {right}
    </Pressable>
  );
}
