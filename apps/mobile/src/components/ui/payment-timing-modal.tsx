import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import type { PaymentTiming } from '@/lib/quotes-service';
import { cn } from '@/lib/utils';

/**
 * PaymentTimingModal - modal chọn thời điểm thanh toán khi rider duyệt báo giá
 * cứu hộ (`purpose === 'rescue_labor'`).
 *
 * BE bắt buộc `payment_timing` cho quote `rescue_labor`:
 *  - `labor_upfront` : trả tiền công cứu hộ TRƯỚC khi thợ đi.
 *  - `after_repair`  : trả sau khi sửa xong (thợ tạo báo giá phụ tùng
 *                       `rescue_final` sau đó).
 *
 * Với quote KHÁC (standard / maintenance_*), BE trả 400 nếu gửi
 * `payment_timing` → modal này KHÔNG được mở cho các quote đó.
 */
export function PaymentTimingModal({
  visible,
  totalAmountLabel,
  loading = false,
  onConfirm,
  onCancel,
}: PaymentTimingModalProps) {
  const [timing, setTiming] = useState<PaymentTiming>('labor_upfront');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={loading ? undefined : onCancel}
        accessibilityRole="button"
        accessibilityLabel="Đóng"
        className="flex-1 items-center justify-center bg-black/50 px-6"
      >
        <Pressable onPress={() => undefined} className="w-full max-w-md">
          <View className="w-full max-h-[85vh] rounded-3xl border border-border bg-card p-6 shadow-xl">
            <Text className="text-center text-lg font-bold text-foreground">
              Chọn cách thanh toán
            </Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              Báo giá cứu hộ gồm tiền công xử lý tại chỗ
              {totalAmountLabel ? ` · ${totalAmountLabel}` : ''}. Bạn muốn trả
              khi nào?
            </Text>

            <ScrollView
              className="mt-4"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <TimingOption
                value="labor_upfront"
                selected={timing === 'labor_upfront'}
                title="Trả trước khi thợ đi"
                description="Thanh toán tiền công ngay bây giờ. Thợ sẽ xuất phát sau khi hệ thống xác nhận thanh toán thành công."
                onSelect={setTiming}
              />
              <TimingOption
                value="after_repair"
                selected={timing === 'after_repair'}
                title="Trả sau khi sửa xong"
                description="Thợ đi xử lý trước. Khi sửa xong, thợ gửi báo giá phụ tùng phát sinh và bạn thanh toán phần còn lại."
                onSelect={setTiming}
              />

              <Banner
                tone="info"
                className="mt-4"
                description="Thời điểm thanh toán đã chốt không thể thay đổi sau khi duyệt báo giá."
              />
            </ScrollView>

            <View className="mt-5 flex-row gap-3">
              <ActionButton
                variant="secondary"
                className="flex-1"
                onPress={onCancel}
                disabled={loading}
                accessibilityLabel="Huỷ"
              >
                Huỷ
              </ActionButton>
              <ActionButton
                variant="primary"
                className="flex-1"
                onPress={() => onConfirm(timing)}
                disabled={loading}
                accessibilityLabel="Xác nhận thanh toán"
              >
                {loading ? <ActivityIndicator color="#ffffff" /> : 'Xác nhận'}
              </ActionButton>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TimingOption({
  value,
  selected,
  title,
  description,
  onSelect,
}: TimingOptionProps) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      className={cn(
        'mt-2 flex-row items-start gap-3 rounded-2xl border px-4 py-3 active:opacity-80',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-secondary',
      )}
    >
      <View
        className={cn(
          'mt-0.5 h-5 w-5 items-center justify-center rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-border bg-card',
        )}
      >
        {selected ? <Check size={12} color="#ffffff" /> : null}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        <Text className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

interface PaymentTimingModalProps {
  visible: boolean;
  /** Tổng tiền hiển thị (đã format sẵn) — tuỳ chọn. */
  totalAmountLabel?: string;
  loading?: boolean;
  onConfirm: (timing: PaymentTiming) => void;
  onCancel: () => void;
}

interface TimingOptionProps {
  value: PaymentTiming;
  selected: boolean;
  title: string;
  description: string;
  onSelect: (value: PaymentTiming) => void;
}
