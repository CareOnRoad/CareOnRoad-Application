import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle, ChevronDown, X } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Field } from '@/components/ui/form';
import { FormTextInput } from '@/components/ui/form';
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
      <Pressable onPress={onClose} className="absolute inset-0" />
      <View className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close dialog"
          className="absolute right-3 top-3 z-10 size-9 items-center justify-center rounded-full bg-secondary active:scale-95"
        >
          <X size={16} color="#16202f" />
        </Pressable>

        <View className="gap-5 p-5">
          <View className="flex-row items-start gap-3">
            <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertTriangle size={20} color="#ed3f3a" />
            </View>
            <View className="min-w-0 flex-1 pr-8">
              <Text className="text-base font-bold leading-tight text-foreground">
                Cancel this appointment?
              </Text>
              {appointmentLabel && (
                <Text className="mt-1 text-xs text-muted-foreground">{appointmentLabel}</Text>
              )}
            </View>
          </View>

          <Field label="Lý do hủy">
            <View className="relative">
              <View
                className={cn(
                  'w-full rounded-2xl border border-input bg-background px-4 py-3',
                  error && 'border-destructive',
                )}
              >
                <Text className="text-sm font-medium text-foreground">
                  {reason || '-- Chọn lý do --'}
                </Text>
              </View>
              <Pressable
                onPress={() => setError(null)}
                accessibilityLabel="Select reason"
                className="absolute inset-0"
              />
              <ChevronDown
                size={16}
                color="#64748b"
                className="absolute right-4 top-1/2 -translate-y-1/2"
              />
            </View>
            <View className="mt-2 gap-1.5">
              <Pressable
                onPress={() => {
                  setReason('');
                  setError(null);
                }}
                className={cn(
                  'rounded-xl border px-3 py-2',
                  !reason ? 'border-primary bg-primary/5' : 'border-border bg-background',
                )}
              >
                <Text className="text-sm">-- Chọn lý do --</Text>
              </Pressable>
              {CANCEL_REASONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => {
                    setReason(r);
                    setError(null);
                  }}
                  className={cn(
                    'rounded-xl border px-3 py-2',
                    reason === r ? 'border-primary bg-primary/5' : 'border-border bg-background',
                  )}
                >
                  <Text className="text-sm">{r}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setReason('other');
                  setError(null);
                }}
                className={cn(
                  'rounded-xl border px-3 py-2',
                  reason === 'other' ? 'border-primary bg-primary/5' : 'border-border bg-background',
                )}
              >
                <Text className="text-sm">Khác (tự điền)</Text>
              </Pressable>
            </View>
          </Field>

          {reason === 'other' && (
            <Field label="Nhập lý do của bạn">
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

          {error && <Text className="text-xs font-medium text-destructive">{error}</Text>}

          <View className="flex-row gap-2 pt-1">
            <ActionButton variant="outline" fullWidth onPress={onClose} className="flex-1 py-3">
              Keep appointment
            </ActionButton>
            <ActionButton
              variant="destructive"
              fullWidth
              onPress={handleConfirm}
              className="flex-1 py-3"
            >
              Confirm cancel
            </ActionButton>
          </View>
        </View>
      </View>
    </View>
  );
}
