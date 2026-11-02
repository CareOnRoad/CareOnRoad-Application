import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { PlanBadge } from '@/components/ui/plan-badge';
import { planPriceLabel } from '@/lib/subscriptions-service';
import type { PlanCatalogEntry } from '@/lib/subscriptions-service';
import { cn } from '@/lib/utils';

/**
 * PlanConfirmModal - modal xác nhận mua gói.
 *
 * Bắt buộc tick "Tôi đã hiểu và đồng ý không được hoàn tiền" trước khi
 * nút "Mua gói" bật — backend cũng từ chối đơn thiếu xác nhận.
 *
 * `onConfirm` nhận `true` nghĩa là người dùng đã xác nhận điều khoản.
 */
export function PlanConfirmModal({
  visible,
  plan,
  currentPlanExpiryText,
  nonRefundableNotice,
  loading = false,
  onConfirm,
  onCancel,
}: PlanConfirmModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!plan) return null;

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
              Xác nhận mua gói {plan.name}
            </Text>

            <ScrollView
              className="mt-4"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <View className="flex-row items-center justify-between rounded-2xl bg-secondary px-4 py-3">
                <Text className="text-sm text-muted-foreground">Gói</Text>
                <PlanBadge plan={plan.code} />
              </View>

              <View className="mt-2 flex-row items-center justify-between rounded-2xl bg-secondary px-4 py-3">
                <Text className="text-sm text-muted-foreground">Giá</Text>
                <Text className="text-sm font-bold text-foreground">
                  {planPriceLabel(plan.price)}
                </Text>
              </View>

              <View className="mt-2 flex-row items-center justify-between rounded-2xl bg-secondary px-4 py-3">
                <Text className="text-sm text-muted-foreground">Thời hạn</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {plan.period_days} ngày
                </Text>
              </View>

              {currentPlanExpiryText ? (
                <View className="mt-2 flex-row items-center justify-between rounded-2xl bg-secondary px-4 py-3">
                  <Text className="text-sm text-muted-foreground">Hạn gói hiện tại</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {currentPlanExpiryText}
                  </Text>
                </View>
              ) : null}

              <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bao gồm
              </Text>
              {plan.features.map((feature) => (
                <View key={feature} className="mt-2 flex-row items-start gap-2">
                  <Check size={16} color="#22c55e" className="mt-0.5 shrink-0" />
                  <Text className="flex-1 text-sm text-foreground">{feature}</Text>
                </View>
              ))}

              <Banner
                tone="warning"
                title="Gói đã mua không được hoàn tiền"
                description={
                  nonRefundableNotice ??
                  'Gói đã mua không được hoàn tiền. Vui lòng kiểm tra kỹ trước khi thanh toán.'
                }
                className="mt-4"
              />

              <Pressable
                onPress={() => setAcknowledged((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acknowledged }}
                accessibilityLabel="Xác nhận không được hoàn tiền"
                className="mt-4 flex-row items-start gap-3 rounded-2xl border border-border px-4 py-3"
              >
                <View
                  className={cn(
                    'mt-0.5 h-5 w-5 items-center justify-center rounded-md border',
                    acknowledged ? 'border-primary bg-primary' : 'border-border bg-secondary',
                  )}
                >
                  {acknowledged ? <Check size={14} color="#ffffff" /> : null}
                </View>
                <Text className="flex-1 text-sm text-foreground">
                  Tôi đã hiểu và đồng ý rằng gói đã mua không được hoàn tiền.
                </Text>
              </Pressable>
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
                onPress={onConfirm}
                disabled={!acknowledged || loading}
                accessibilityLabel="Mua gói"
              >
                {loading ? <ActivityIndicator color="#ffffff" /> : 'Mua gói'}
              </ActionButton>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface PlanConfirmModalProps {
  visible: boolean;
  plan?: PlanCatalogEntry | null;
  currentPlanExpiryText?: string;
  nonRefundableNotice?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
