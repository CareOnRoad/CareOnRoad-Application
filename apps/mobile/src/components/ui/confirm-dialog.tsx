import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * ConfirmDialog - dialog xác nhận dùng cho hành động quan trọng (đăng xuất, xoá...).
 *
 * Design:
 *  - Overlay đen 50% che toàn màn hình, content card bo góc 24px.
 *  - 2 nút: Cancel (ghost) + Confirm (primary/destructive tuỳ `tone`).
 *  - Loading state tự khoá cả 2 nút và thay text bằng spinner.
 *
 * Lưu ý:
 *  - Component không tự đóng khi confirm xong — caller quyết định dựa trên kết quả.
 *  - Khi `loading=true`, 2 nút đều disabled để tránh double-tap.
 */
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Tự động khoá 2 nút khi loading để tránh double-tap.
  const bothDisabled = loading;

  const confirmTone =
    tone === 'destructive'
      ? {
          bg: 'bg-destructive',
          fg: 'text-destructive-foreground',
        }
      : {
          bg: 'bg-primary',
          fg: 'text-primary-foreground',
        };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable
        // Nhấn ra ngoài dialog sẽ cancel (giống pattern iOS/Android).
        // `flex-1` phải nằm trên chính Pressable này: bọc ngoài bằng View
        // sẽ khiến overlay co lại theo nội dung và đẩy card ra ngoài màn hình.
        onPress={bothDisabled ? undefined : onCancel}
        accessibilityLabel="Đóng dialog"
        accessibilityRole="button"
        className="flex-1 items-center justify-center bg-black/50 px-6"
      >
        {/* Chặn sự kiện nhấn xuyên qua card */}
        <Pressable onPress={() => undefined} className="w-full max-w-sm">
          <View className="w-full rounded-3xl border border-border bg-card p-6 shadow-xl">
            <Text className="text-center text-lg font-bold text-foreground">{title}</Text>
            {description && (
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                {description}
              </Text>
            )}

            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={bothDisabled ? undefined : onCancel}
                disabled={bothDisabled}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                className="flex-1"
                style={({ pressed }) => [
                  {
                    opacity: bothDisabled ? 0.5 : pressed ? 0.85 : 1,
                    transform: [{ scale: pressed && !bothDisabled ? 0.97 : 1 }],
                  },
                ]}
              >
                <View className="items-center justify-center rounded-2xl border border-border bg-secondary py-3">
                  <Text className="text-sm font-semibold text-foreground">{cancelLabel}</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={bothDisabled ? undefined : onConfirm}
                disabled={bothDisabled}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                className="flex-1"
                style={({ pressed }) => [
                  {
                    opacity: bothDisabled ? 0.7 : pressed ? 0.85 : 1,
                    transform: [{ scale: pressed && !bothDisabled ? 0.97 : 1 }],
                  },
                ]}
              >
                <View className={cn('items-center justify-center rounded-2xl py-3', confirmTone.bg)}>
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className={cn('text-sm font-semibold', confirmTone.fg)}>
                      {confirmLabel}
                    </Text>
                  )}
                </View>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'destructive';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
