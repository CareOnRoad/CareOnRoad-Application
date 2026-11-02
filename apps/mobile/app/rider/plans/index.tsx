import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check, Sparkles } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { PlanBadge } from '@/components/ui/plan-badge';
import { PlanConfirmModal } from '@/components/ui/plan-confirm-modal';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { SectionHeader } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { buildPlanReturnUrl } from '@/lib/plan-return-url';
import {
  createSubscriptionOrder,
  formatPlanExpiry,
  getMySubscription,
  getPlanCatalog,
  planLabel,
  planPriceLabel,
  planPurchaseDecision,
  planStatusLabel,
  type MySubscription,
  type PlanCatalogEntry,
  type PlanCatalogResponse,
  type PlanCode,
  type SubscriptionOrder,
} from '@/lib/subscriptions-service';
import { cn } from '@/lib/utils';

/**
 * PlansScreen - trang quản lý gói của rider.
 *
 * Hiển thị đủ 3 gói (free / advance 10k / vip 50k, chu kỳ 30 ngày), gói đang
 * dùng, cảnh báo không hoàn tiền và nút mua. Nhấn mua → modal xác nhận
 * (bắt buộc tick đồng ý không hoàn tiền) → tạo đơn → chuyển sang màn hình
 * QR thanh toán.
 */
export default function PlansScreen() {
  const [catalog, setCatalog] = useState<PlanCatalogResponse | null>(null);
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlanCatalogEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    // Catalog và subscription tải độc lập: lỗi ở `/subscription` không được
    // làm ẩn luôn danh sách gói (đây là màn hình người dùng bấm để mua).
    const [catalogResult, subscriptionResult] = await Promise.allSettled([
      getPlanCatalog(),
      getMySubscription(),
    ]);

    if (catalogResult.status === 'fulfilled') {
      setCatalog(catalogResult.value);
      setError(null);
    } else {
      const message =
        catalogResult.reason instanceof Error
          ? catalogResult.reason.message
          : 'Không tải được danh sách gói';
      setError(message);
    }

    if (subscriptionResult.status === 'fulfilled') {
      setSubscription(subscriptionResult.value);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Người dùng thanh toán trên trình duyệt rồi quay lại app → app foreground.
   * Backend đã tự đồng bộ trạng thái với payOS khi đọc `/subscription`, nên
   * chỉ cần gọi lại `load()` để gói mới hiện ngay.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]);

  const handleConfirmPurchase = useCallback(async () => {
    if (!selected) return;
    setCreating(true);
    setError(null);
    try {
      const order = await createSubscriptionOrder(
        selected.code as 'advance' | 'vip',
        true,
        buildPlanReturnUrl(),
        buildPlanReturnUrl(),
      );
      setSelected(null);
      router.push(`/rider/plans/${order.id}`);
    } catch (e) {
      setSelected(null);
      if (e instanceof ApiError && e.status === 409) {
        const reason =
          e.details && typeof e.details === 'object'
            ? (e.details as { reason?: string }).reason
            : undefined;
        setError(
          reason === 'downgrade_blocked'
            ? 'Bạn không thể hạ cấp gói. Gói hiện tại đã bao gồm nhiều tính năng hơn, hãy chờ gói hiện tại hết hạn hoặc liên hệ hỗ trợ.'
            : 'Không thể tạo đơn thanh toán. Vui lòng thử lại.',
        );
      } else {
        setError(e instanceof Error ? e.message : 'Không thể tạo đơn thanh toán');
      }
    } finally {
      setCreating(false);
    }
  }, [selected]);

  const currentPlan = subscription?.current_plan ?? 'free';
  const currentExpiryText = formatPlanExpiry(subscription?.plan_expires_at);
  const history = subscription?.history ?? [];
  /** Đơn đang chờ thanh toán (nếu có) — để người dùng quay lại app còn tiếp tục được. */
  const pendingOrder = history.find(
    (order) => order.status === 'pending' || order.status === 'created',
  );

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Gói của tôi" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1974f7" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader title="Gói của tôi" onBack={() => router.back()} />
      <ScreenScroll>
        {/* Gói hiện tại */}
        <Card>
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1">
              <Text className="text-sm text-muted-foreground">Gói đang dùng</Text>
              <Text className="mt-1 text-xl font-bold text-foreground">
                {planLabel(currentPlan)}
              </Text>
            </View>
            <PlanBadge plan={currentPlan} />
          </View>
          <View className="px-4 pb-4">
            <Text className="text-xs text-muted-foreground">
              {currentExpiryText
                ? `Gói hiện tại có hiệu lực đến ${currentExpiryText}.`
                : 'Bạn đang dùng gói Free. Nâng cấp để mở nhắc bảo dưỡng định kỳ và chi tiết xe VIP.'}
            </Text>
          </View>
        </Card>

        {error ? (
          <View className="mt-4">
            <Banner tone="error" title="Không thể hoàn tất" description={error} />
          </View>
        ) : null}

        {pendingOrder ? (
          <View className="mt-4">
            <Banner
              tone="info"
              title={`Có đơn mua gói ${planLabel(pendingOrder.plan_code)} đang chờ thanh toán`}
              description="Mở lại màn thanh toán để quét mã QR hoặc kiểm tra trạng thái đơn."
            />
            <ActionButton
              fullWidth
              variant="outline"
              className="mt-3"
              onPress={() => router.push(`/rider/plans/${pendingOrder.id}`)}
              accessibilityLabel="Mở lại màn thanh toán gói"
            >
              <Text className="text-sm font-semibold text-foreground">
                Mở lại màn thanh toán
              </Text>
            </ActionButton>
          </View>
        ) : null}

        <Banner
          tone="warning"
          title="Gói đã mua không được hoàn tiền"
          description={
            catalog?.non_refundable_notice ??
            'Gói đã mua không được hoàn tiền. Vui lòng kiểm tra kỹ trước khi thanh toán.'
          }
          className="mt-4"
        />

        <View className="mt-6">
          <SectionHeader title="Các gói dịch vụ" />
          <Text className="mb-3 text-xs text-muted-foreground">
            Mọi gói đều tính theo chu kỳ 30 ngày. Khi gia hạn hoặc nâng cấp, số ngày
            còn dư của gói hiện tại được cộng dồn vào chu kỳ mới.
          </Text>

          <View className="gap-3">
            {(catalog?.plans ?? []).map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                currentPlan={currentPlan}
                onSelect={() => setSelected(plan)}
              />
            ))}
          </View>
        </View>

        {/* Lịch sử mua / gia hạn gói */}
        {history.length > 0 ? (
          <View className="mt-6">
            <SectionHeader title="Lịch sử gói" />
            <Card className="divide-y divide-border">
              {history.map((order) => (
                <HistoryRow key={order.id} order={order} />
              ))}
            </Card>
          </View>
        ) : null}
      </ScreenScroll>

      {selected ? (
        <PlanConfirmModal
          key={selected.code}
          visible
          plan={selected}
          currentPlanExpiryText={currentExpiryText}
          nonRefundableNotice={catalog?.non_refundable_notice}
          loading={creating}
          onConfirm={handleConfirmPurchase}
          onCancel={() => {
            if (!creating) setSelected(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function PlanCard({
  plan,
  currentPlan,
  onSelect,
}: {
  plan: PlanCatalogEntry;
  currentPlan: PlanCode;
  onSelect: () => void;
}) {
  const isFree = plan.code === 'free';
  const highlighted = plan.code === 'vip';
  const isCurrent = plan.code === currentPlan;

  /**
   * Quy tắc mua gói — dùng chung với backend qua `planPurchaseDecision`:
   *  - Gói thấp hơn gói hiện tại → bị chặn (hạ cấp).
   *  - Gói bằng gói hiện tại → gia hạn (cộng dồn số ngày còn dư).
   *  - Gói cao hơn → nâng cấp.
   */
  const decision = planPurchaseDecision(currentPlan, plan.code);
  const isDowngrade = decision === 'downgrade';
  const isRenewal = decision === 'renewal';

  return (
    <Card
      className={cn(
        'overflow-hidden',
        isCurrent && 'border-primary',
        highlighted && !isCurrent && 'border-amber-500/60',
      )}
    >
      <View className="flex-row items-start justify-between p-4">
        <View className="flex-1 pr-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-foreground">{plan.name}</Text>
            {isCurrent ? <PlanBadge plan={plan.code} /> : null}
            {highlighted && !isCurrent ? (
              <View className="flex-row items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5">
                <Sparkles size={11} color="#d97706" />
                <Text className="text-[10px] font-semibold text-amber-600">Nâng cấp</Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-1 text-xs text-muted-foreground">{plan.tagline}</Text>
        </View>
        <View className="items-end">
          <Text className="text-lg font-bold text-foreground">
            {planPriceLabel(plan.price)}
          </Text>
          <Text className="text-[10px] text-muted-foreground">/ {plan.period_days} ngày</Text>
        </View>
      </View>

      <View className="border-t border-border px-4 py-3">
        {plan.features.map((feature) => (
          <View key={feature} className="mt-1.5 flex-row items-start gap-2">
            <Check size={14} color="#22c55e" className="mt-0.5 shrink-0" />
            <Text className="flex-1 text-xs text-foreground">{feature}</Text>
          </View>
        ))}
        {plan.note ? (
          <Text className="mt-2 text-[11px] italic text-muted-foreground">{plan.note}</Text>
        ) : null}
      </View>

      <View className="px-4 pb-4">
        {isFree ? (
          <ActionButton variant="outline" size="sm" fullWidth disabled>
            <Text className="text-xs font-semibold text-foreground">Gói mặc định</Text>
          </ActionButton>
        ) : isDowngrade ? (
          <ActionButton variant="outline" size="sm" fullWidth disabled>
            <Text className="text-xs font-semibold text-foreground">
              Không thể hạ cấp gói
            </Text>
          </ActionButton>
        ) : (
          <ActionButton
            variant="primary"
            size="sm"
            fullWidth
            onPress={onSelect}
            accessibilityLabel={
              isRenewal ? `Gia hạn gói ${plan.name}` : `Mua gói ${plan.name}`
            }
          >
            <Text className="text-xs font-semibold text-primary-foreground">
              {isRenewal
                ? 'Gia hạn gói này'
                : plan.code === 'vip'
                  ? 'Nâng cấp lên VIP'
                  : 'Mua gói'}
            </Text>
          </ActionButton>
        )}
      </View>
    </Card>
  );
}

/**
 * HistoryRow - 1 dòng lịch sử mua/gia hạn gói.
 *
 * Đọc-only: backend không cho sửa/xoá lịch sử gói.
 */
function HistoryRow({ order }: { order: SubscriptionOrder }) {
  return (
    <View className="flex-row items-center justify-between gap-3 p-4">
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">
          Gói {planLabel(order.plan_code)}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {new Intl.NumberFormat('vi-VN').format(order.amount)}₫ ·{' '}
          {planStatusLabel(order.status)}
          {order.expires_at
            ? ` · hết hạn ${formatPlanExpiry(order.expires_at)}`
            : ''}
        </Text>
      </View>
      <PlanBadge plan={order.plan_code} />
    </View>
  );
}
