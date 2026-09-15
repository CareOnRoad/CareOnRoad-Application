import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';

export function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <View className="size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon size={16} color="#16202f" />
      </View>
      <Text className="flex-1 text-sm font-medium text-foreground">{label}</Text>
      <Pressable
        onPress={onChange}
        accessibilityRole="switch"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        className={cn(
          'h-6 w-11 shrink-0 rounded-full',
          checked ? 'bg-primary' : 'bg-muted',
        )}
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

export function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <View className="size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
      <Icon size={16} color="#16202f" />
    </View>
  );
}
