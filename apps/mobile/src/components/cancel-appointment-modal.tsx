import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Field, FormTextInput } from '@/components/ui/form';
import { cn } from '@/lib/utils';

export const CANCEL_REASONS = [
  'Tôi có việc đột xuất',
  'Tôi không còn nhu cầu',
  'Tôi muốn thay đổi lịch hẹn',
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number] | 'other';

export function CancelAppointmentModal({
  open,
  appointmentLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  appointmentLabel?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = () => {
    if (reason === 'other') {
      if (!customReason.trim()) {
        setError('Vui lòng nhập lý do hủy của bạn.');
        return;
      }
      onConfirm(customReason.trim());
      return;
    }
    if (!reason) {
      setError('Vui lòng chọn một lý do hủy.');
      return;
    }
    onConfirm(reason);
  };

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/60 px-4">
      <Pressable
        onPress={onClose}
        accessibilityLabel="Đóng hộp thoại"
        accessibilityRole="button"
      >
        <View className="absolute inset-0" />
      </Pressable>
      <View className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <Pressable
          onPress={onClose}
          accessibilityLabel="Đóng hộp thoại"
          accessibilityRole="button"
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <View className="absolute right-3 top-3 z-10 size-9 items-center justify-center rounded-full bg-secondary">
            <X size={16} color="#16202f" />
          </View>
        </Pressable>

        <ScrollView
          className="max-h-[600px]"
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-5">
            <View className="flex-row items-start gap-3">
              <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10">
                <AlertTriangle size={20} color="#ed3f3a" />
              </View>
              <View className="min-w-0 flex-1 pr-8">
                <Text className="text-base font-bold leading-tight text-foreground">
                  Huỷ lịch hẹn này?
                </Text>
                {appointmentLabel && (
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {appointmentLabel}
                  </Text>
                )}
              </View>
            </View>

            <Field label="Lý do huỷ" required>
              <View
                className={cn(
                  'w-full rounded-2xl border bg-background px-4 py-3',
                  error ? 'border-destructive' : 'border-input',
                )}
              >
                <Text className="text-sm font-medium text-foreground">
                  {reason === 'other'
                    ? 'Khác (tự điền)'
                    : reason || '-- Chọn lý do --'}
                </Text>
              </View>
              <View className="mt-2 gap-1.5">
                <ReasonOption
                  selected={!reason}
                  label="-- Chọn lý do --"
                  onPress={() => {
                    setReason('');
                    setError(null);
                  }}
                />
                {CANCEL_REASONS.map((r) => (
                  <ReasonOption
                    key={r}
                    selected={reason === r}
                    label={r}
                    onPress={() => {
                      setReason(r);
                      setError(null);
                    }}
                  />
                ))}
                <ReasonOption
                  selected={reason === 'other'}
                  label="Khác (tự điền)"
                  onPress={() => {
                    setReason('other');
                    setError(null);
                  }}
                />
              </View>
            </Field>

            {reason === 'other' && (
              <Field label="Nhập lý do của bạn" required>
                <FormTextInput
                  value={customReason}
                  onChangeText={(t) => {
                    setCustomReason(t);
                    setError(null);
                  }}
                  multiline
                  numberOfLines={3}
                  placeholder="Ví dụ: Tôi cần đổi sang thợ khác..."
                  className={cn('min-h-[80px]', error && 'border-destructive')}
                />
              </Field>
            )}

            {error && (
              <Text className="text-xs font-medium text-destructive">{error}</Text>
            )}

            <View className="flex-row gap-2 pt-1">
              <ActionButton
                variant="outline"
                fullWidth
                onPress={onClose}
                className="flex-1 py-3"
                accessibilityLabel="Giữ lịch hẹn"
              >
                <Text className="text-sm font-semibold text-foreground">Giữ lịch hẹn</Text>
              </ActionButton>
              <ActionButton
                variant="destructive"
                fullWidth
                onPress={handleConfirm}
                className="flex-1 py-3"
                accessibilityLabel="Xác nhận huỷ"
              >
                <Text className="text-sm font-semibold text-primary-foreground">
                  Xác nhận huỷ
                </Text>
              </ActionButton>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function ReasonOption({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View
        className={cn(
          'flex-row items-center gap-2 rounded-xl border px-3 py-2.5',
          selected ? 'border-primary bg-primary/5' : 'border-border bg-background',
        )}
      >
      <View
        className={cn(
          'size-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-input bg-background',
        )}
      >
        {selected && <View className="size-1.5 rounded-full bg-white" />}
      </View>
      <Text
        className={cn(
          'flex-1 text-sm',
          selected ? 'font-semibold text-foreground' : 'text-foreground',
        )}
      >
        {label}
      </Text>
      </View>
    </Pressable>
  );
}
