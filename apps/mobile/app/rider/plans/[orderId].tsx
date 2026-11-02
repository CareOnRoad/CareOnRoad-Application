import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  Share,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle2, Copy, ExternalLink, Hourglass, ShieldCheck, XCircle } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { QrCode } from '@/components/ui/qr-code';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { useAuth } from '@/contexts/auth-context';
import { canRenderQrCode } from '@/lib/qr-payload';
import { cn } from '@/lib/utils';
import {
  cancelSubscriptionOrder,
  formatPlanExpiry,
  getSubscriptionOrder,
  planLabel,
  planStatusLabel,
  type SubscriptionOrder,
} from '@/lib/subscriptions-service';

const POLL_INTERVAL_MS = 4000;
/**
 * Thời gian polling tối đa — phải ≥ hạn link thanh toán payOS.
 *
 * Backend đặt `expiresAt` cho link payOS là 30 phút
 * (`DEFAULT_SUBSCRIPTION_EXPIRY_MS` trong `subscription.service.ts`), nên
 * mobile phải poll ít nhất lâu bằng vậy. Nếu poll dừng sớm, người dùng đang
 * chuyển khoản sẽ không thấy trạng thái "đã thanh toán" và tưởng bị treo.
 */
const MAX_POLL_DURATION_MS = 30 * 60 * 1000;

/**
 * PlanCheckoutScreen - màn hình thanh toán payOS cho đơn đăng ký gói.
 *
 * Flow:
 *  1. Nhận orderId từ params → poll GET /api/v1/subscription/orders/{id} mỗi 4s.
 *  2. Hiển thị QR + nút mở checkout URL.
 *  3. Khi `succeeded` → refresh actor (badge gói cập nhật) → màn hình thành công.
 *  4. Khi `canceled` / `failed` / `expired` → banner + nút quay lại.
 */
export default function PlanCheckoutScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { refreshActor } = useAuth();
  const [order, setOrder] = useState<SubscriptionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(MAX_POLL_DURATION_MS);
  const pollStartedAt = useRef<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const refresh = useCallback(
    async (id: string) => {
      try {
        const next = await getSubscriptionOrder(id);
        setOrder(next);
        if (next.status !== 'pending' && next.status !== 'created') {
          stopPolling();
        }
        return next;
      } catch (e) {
        // Network blip — polling tiếp tục.
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[plans] refresh failed:', e);
        }
        return null;
      }
    },
    [stopPolling],
  );

  useEffect(() => {
    if (!orderId) {
      setError('Thiếu mã đơn thanh toán.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const current = await refresh(orderId);
      if (cancelled) return;
      if (!current) {
        setError('Không tải được đơn thanh toán.');
        setLoading(false);
        return;
      }
      pollStartedAt.current = Date.now();
      pollTimer.current = setInterval(async () => {
        const next = await refresh(orderId);
        if (!next || (next.status !== 'pending' && next.status !== 'created')) return;
        if (Date.now() - (pollStartedAt.current ?? 0) > MAX_POLL_DURATION_MS) {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [orderId, refresh, stopPolling]);

  // Countdown UI
  useEffect(() => {
    if (!order || (order.status !== 'pending' && order.status !== 'created')) return;
    const timer = setInterval(() => {
      setTimeLeft(
        Math.max(0, MAX_POLL_DURATION_MS - (Date.now() - (pollStartedAt.current ?? 0))),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [order?.status]);

  /**
   * Quay lại app sau khi thanh toán ở trình duyệt → app được foreground.
   *
   * Lúc này phải hỏi lại backend ngay thay vì chờ tới tick 4s tiếp theo, và
   * phải "đánh thức" polling (app bị background nên timer có thể bị hệ điều
   * hành làm chậm). Backend cũng tự đồng bộ trạng thái với payOS khi đọc đơn.
   */
  useEffect(() => {
    if (!orderId) return;
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      void refresh(orderId);
    });
    return () => subscription.remove();
  }, [orderId, refresh]);

  const handleCancel = async () => {
    if (!order) return;
    try {
      const next = await cancelSubscriptionOrder(order.id);
      setOrder(next);
      stopPolling();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể huỷ đơn');
    }
  };

  const handleOpenCheckout = () => {
    if (order?.checkout_url) {
      Linking.openURL(order.checkout_url).catch(() => undefined);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Thanh toán gói" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1974f7" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Thanh toán gói" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="error"
            title="Không thể tải đơn thanh toán"
            description={error ?? 'Vui lòng thử lại sau.'}
          />
          <ActionButton
            className="mt-5"
            onPress={() => router.replace('/rider/plans')}
          >
            <Text className="text-sm font-semibold text-primary-foreground">
              Về trang gói của tôi
            </Text>
          </ActionButton>
        </View>
      </SafeAreaView>
    );
  }

  if (order.status === 'succeeded') {
    return <PlanSuccess order={order} onRefreshActor={refreshActor} />;
  }

  if (order.status === 'canceled' || order.status === 'failed' || order.status === 'expired') {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Thanh toán gói" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone={order.status === 'failed' ? 'error' : 'warning'}
            title={`Đơn ${planStatusLabel(order.status).toLowerCase()}`}
            description={
              order.status === 'canceled'
                ? 'Bạn đã huỷ đơn thanh toán này.'
                : order.status === 'expired'
                  ? 'Đơn đã hết hạn. Vui lòng tạo đơn mới.'
                  : 'Thanh toán thất bại. Vui lòng thử lại.'
            }
          />
          <ActionButton className="mt-5" onPress={() => router.replace('/rider/plans')}>
            <Text className="text-sm font-semibold text-primary-foreground">
              Về trang gói của tôi
            </Text>
          </ActionButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title="Thanh toán gói"
        subtitle={planStatusLabel(order.status)}
        onBack={() => router.back()}
      />
      <ScreenScroll>
        <PendingPlanPaymentCard
          order={order}
          timeLeft={timeLeft}
          onOpenCheckout={handleOpenCheckout}
        />
        {error ? (
          <View className="mt-4">
            <Banner tone="error" description={error} />
          </View>
        ) : null}
        <ActionButton
          fullWidth
          variant="outline"
          className="mt-4"
          onPress={handleCancel}
          accessibilityLabel="Huỷ đơn thanh toán"
        >
          <XCircle size={16} color="#ed3f3a" />
          <Text className="text-sm font-semibold text-destructive">Huỷ đơn thanh toán</Text>
        </ActionButton>
      </ScreenScroll>
    </SafeAreaView>
  );
}

function PendingPlanPaymentCard({
  order,
  timeLeft,
  onOpenCheckout,
}: {
  order: SubscriptionOrder;
  timeLeft: number;
  onOpenCheckout: () => void;
}) {
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!order.checkout_url && !order.qr_code) return;
    try {
      await Share.share({
        message: order.checkout_url ?? order.qr_code ?? '',
        title: 'Thanh toán gói CareOnRoad',
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <Card className="overflow-hidden p-0">
      <View className="bg-primary px-5 py-4">
        <Text className="text-xs text-white/80">
          Số tiền thanh toán · Gói {planLabel(order.plan_code)}
        </Text>
        <Text className="mt-1 text-3xl font-bold text-white">
          {new Intl.NumberFormat('vi-VN').format(order.amount)}₫
        </Text>
      </View>
      <View className="items-center p-5">
        {order.qr_code && canRenderQrCode(order.qr_code) ? (
          <QrCode
            value={order.qr_code}
            size={224}
            accessibilityLabel="QR code thanh toán gói"
          />
        ) : order.checkout_url ? (
          <View className="size-56 items-center justify-center rounded-2xl bg-secondary">
            <ShieldCheck size={64} color="#1974f7" />
          </View>
        ) : (
          <View className="size-56 items-center justify-center rounded-2xl bg-secondary px-4">
            <Text className="text-center text-xs text-muted-foreground">
              Không tạo được mã QR. Vui lòng dùng nút &quot;Mở trang thanh toán&quot;
              bên dưới.
            </Text>
          </View>
        )}
        <View className="mt-4 flex-row items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5">
          <Hourglass size={12} color="#a16207" />
          <Text className="text-xs font-semibold text-amber-700">
            Tự động cập nhật trong {minutes}:{seconds.toString().padStart(2, '0')}
          </Text>
        </View>
        <Text className="mt-2 text-center text-xs text-muted-foreground">
          Quét QR qua ứng dụng ngân hàng / ví điện tử để thanh toán.
        </Text>
        {order.checkout_url && (
          <Pressable
            onPress={onOpenCheckout}
            accessibilityLabel="Mở trang thanh toán"
            className="mt-4 flex-row items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 active:opacity-70"
          >
            <ExternalLink size={14} color="#1974f7" />
            <Text className="text-xs font-semibold text-primary">Mở trang thanh toán</Text>
          </Pressable>
        )}
        {(order.checkout_url || order.qr_code) && (
          <Pressable
            onPress={handleCopy}
            accessibilityLabel="Sao chép liên kết thanh toán"
            className="mt-2 flex-row items-center gap-1.5 active:opacity-70"
          >
            <Copy size={12} color="#64748b" />
            <Text className="text-xs text-muted-foreground">
              {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function PlanSuccess({
  order,
  onRefreshActor,
}: {
  order: SubscriptionOrder;
  onRefreshActor: () => Promise<unknown>;
}) {
  useEffect(() => {
    // Refresh actor để badge gói trên profile cập nhật ngay.
    void onRefreshActor();
    const timer = setTimeout(() => router.replace('/rider/plans'), 2500);
    return () => clearTimeout(timer);
  }, [onRefreshActor]);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader title="Thanh toán gói" />
      <View className="flex-1 items-center justify-center px-8">
        <View className="size-24 items-center justify-center">
          <View className="absolute inset-0 rounded-full bg-green/15" />
          <View className="absolute inset-2 rounded-full bg-green/25" />
          <View className="relative size-16 items-center justify-center rounded-full bg-green">
            <CheckCircle2 size={32} color="#ffffff" strokeWidth={3} />
          </View>
        </View>
        <Text className="mt-5 text-2xl font-bold text-foreground">
          Gói đã được kích hoạt!
        </Text>
        <Text className="mt-1 px-4 text-center text-sm text-muted-foreground">
          Gói {planLabel(order.plan_code)} đã có hiệu lực ngay bây giờ.
        </Text>
        <Card className="mt-5 w-full p-4">
          <RowLine label="Gói" value={planLabel(order.plan_code)} />
          <RowLine
            label="Số tiền"
            value={`${new Intl.NumberFormat('vi-VN').format(order.amount)}₫`}
          />
          {order.expires_at ? (
            <RowLine label="Hết hạn" value={formatPlanExpiry(order.expires_at)} />
          ) : null}
        </Card>
      </View>
    </SafeAreaView>
  );
}

function RowLine({ label, value }: { label: string; value: string }) {
  return (
    <View className={cn('flex-row items-center justify-between py-1.5')}>
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
