import React from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="w-full">
      <Text className="mb-1.5 block text-sm font-semibold text-foreground">{label}</Text>
      {children}
    </View>
  );
}

export function FormTextInput({
  className,
  ...props
}: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor="#94a3b8"
      className={cn(
        'w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-base font-bold text-foreground">{title}</Text>
      {action && (
        <PressableText onPress={onAction} className="text-primary">
          {action}
        </PressableText>
      )}
    </View>
  );
}

export function PressableText({
  onPress,
  children,
  className,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Pressable onPress={onPress}>
      <Text className={cn('text-sm font-semibold', className)}>{children}</Text>
    </Pressable>
  );
}
