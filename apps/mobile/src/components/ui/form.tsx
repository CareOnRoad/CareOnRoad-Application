import React from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  /** Helper text hiển thị bên dưới input. */
  hint?: string;
  /** Khi có error sẽ viền đỏ + message đỏ bên dưới. */
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <View className="w-full">
      <View className="mb-1.5 flex-row items-center gap-1">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        {required && <Text className="text-xs font-semibold text-destructive">*</Text>}
      </View>
      {children}
      {error ? (
        <Text className="mt-1 text-xs font-medium text-destructive">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}

export function FormTextInput({
  className,
  error,
  ...props
}: TextInputProps & { className?: string; error?: boolean }) {
  return (
    <TextInput
      placeholderTextColor="#94a3b8"
      accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
      className={cn(
        'w-full rounded-2xl border bg-background px-4 py-3 text-sm text-foreground',
        error ? 'border-destructive' : 'border-input',
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View>
        <Text className="text-base font-bold text-foreground">{title}</Text>
        {subtitle && (
          <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
        )}
      </View>
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
    <Pressable onPress={onPress} accessibilityRole="link">
      <Text className={cn('text-sm font-semibold', className)}>{children}</Text>
    </Pressable>
  );
}
