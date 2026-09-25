import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle2, Copy, ExternalLink, Hourglass, ShieldCheck, XCircle } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  cancelPaymentOrder,
  createPaymentOrder,
  getPaymentOrder,
  statusLabel,
  type PaymentOrder,
  type PaymentStatus,
} from '@/lib/payments-service';

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000;

/**
 * PaymentScreen - thanh toán payOS cho 1 quote đã duyệt.
 *
 * Flow:
 *  1. Khi mount, nhận quoteId từ params → tạo payment order (idempotent).
 *  2. Hiển thị QR + nút mở checkout URL.
 *  3. Poll GET /api/v1/payments/orders/{id} mỗi 4s để detect paid.
 *  4. Khi paid → hiển thị success screen + auto goBack sau 2s.
 *
 * Idempotency: cùng quoteId có thể tạo nhiều order do retry; BE xử lý.
 */
export default function PaymentScreen() {
  const { quoteId, requestId } = useLocalSearchParams<{ quoteId?: string; requestId?: string }>();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  /**
   * Refresh order state từ BE.
   */
  const refresh = useCallback(
    async (orderId: string) => {
      try {
        const o = await getPaymentOrder(orderId);
        setOrder(o);
        if (o.status !== 'pending') {
          stopPolling();
        }
        return o;
      } catch (e) {
        // Network blip — không fail cứng; polling tiếp tục.
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[payment] refresh failed:', e);
        }
        return null;
      }
    },
    [stopPolling],
  );

  /**
   * Init: tạo order nếu chưa có; nếu có sẵn thì không tạo lại.
   */
  useEffect(() => {
    if (!quoteId) {
      setError('Thiếu mã báo giá để tạo thanh toán.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setCreating(true);
        const created = await createPaymentOrder(quoteId);
        if (cancelled) return;
        setOrder(created);
        pollStartedAt.current = Date.now();
        // Start polling
        pollTimer.current = setInterval(async () => {
          const o = await refresh(created.id);
          if (!o || o.status !== 'pending') return;
          // Timeout
          if (Date.now() - (pollStartedAt.current ?? 0) > MAX_POLL_DURATION_MS) {
            stopPolling();
          }
        }, POLL_INTERVAL_MS);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Không thể tạo đơn thanh toán');
        }
      } finally {
        if (!cancelled) {
          setCreating(false);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [quoteId, refresh, stopPolling]);

  // Countdown UI
  useEffect(() => {
    if (order?.status !== 'pending') return;
    const t = setInterval(() => {
      setTimeLeft(Math.max(0, MAX_POLL_DURATION_MS - (Date.now() - (pollStartedAt.current ?? 0))));
    }, 1000);
    return () => clearInterval(t);
  }, [order?.status]);

  const handleCancel = async () => {
    if (!order) return;
    try {
      await cancelPaymentOrder(order.id);
      const o = await getPaymentOrder(order.id);
      setOrder(o);
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
        <AppHeader title="Thanh toán" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          {creating ? (
            <>
              <ActivityIndicator color="#1974f7" size="large" />
              <Text className="mt-3 text-sm text-muted-foreground">Đang tạo đơn thanh toán…</Text>
            </>
          ) : (
            <ActivityIndicator color="#1974f7" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Thanh toán" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="error"
            title="Không thể tải đơn thanh toán"
            description={error ?? 'Vui lòng thử lại sau.'}
          />
          <ActionButton
            className="mt-5"
            onPress={() => router.replace('/rider/(tabs)/rescue')}
          >
            <Text className="text-sm font-semibold text-primary-foreground">Về Cứu hộ</Text>
          </ActionButton>
        </View>
      </SafeAreaView>
    );
  }

  if (order.status === 'paid') {
    return <PaymentSuccess order={order} requestId={requestId} />;
  }

  if (order.status === 'canceled' || order.status === 'failed' || order.status === 'expired') {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Thanh toán" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone={order.status === 'failed' ? 'error' : 'warning'}
            title={`Đơn ${statusLabel(order.status).toLowerCase()}`}
            description={
              order.status === 'canceled'
                ? 'Bạn đã huỷ đơn thanh toán này.'
                : order.status === 'expired'
                  ? 'Đơn đã hết hạn. Vui lòng tạo đơn mới.'
                  : 'Thanh toán thất bại. Vui lòng thử lại.'
            }
          />
          <ActionButton
            className="mt-5"
            onPress={() => router.replace('/rider/(tabs)/rescue')}
          >
            <Text className="text-sm font-semibold text-primary-foreground">Về Cứu hộ</Text>
          </ActionButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader title="Thanh toán" subtitle={statusLabel(order.status)} onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <PendingPaymentCard order={order} timeLeft={timeLeft} onOpenCheckout={handleOpenCheckout} />
        {error && (
          <View className="mt-4">
            <Banner tone="error" description={error} />
          </View>
        )}
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
      </ScrollView>
    </SafeAreaView>
  );
}

function PendingPaymentCard({
  order,
  timeLeft,
  onOpenCheckout,
}: {
  order: PaymentOrder;
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
        title: 'Thanh toán CareOnRoad',
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
        <Text className="text-xs text-white/80">Số tiền thanh toán</Text>
        <Text className="mt-1 text-3xl font-bold text-white">
          {new Intl.NumberFormat('vi-VN').format(order.amount)}₫
        </Text>
      </View>
      <View className="items-center p-5">
        {order.qr_code ? (
          <Image
            source={{ uri: order.qr_code }}
            className="size-56"
            resizeMode="contain"
            accessibilityLabel="QR code thanh toán"
          />
        ) : order.checkout_url ? (
          <View className="size-56 items-center justify-center rounded-2xl bg-secondary">
            <ShieldCheck size={64} color="#1974f7" />
          </View>
        ) : null}
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

function PaymentSuccess({
  order,
}: {
  order: PaymentOrder;
  /** BE trả về service-request id qua params; hiện không dùng trên UI này. */
  requestId?: string;
}) {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/rider/(tabs)/rescue'), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader title="Thanh toán" />
      <View className="flex-1 items-center justify-center px-8">
        <View className="size-24 items-center justify-center">
          <View className="absolute inset-0 rounded-full bg-green/15" />
          <View className="absolute inset-2 rounded-full bg-green/25" />
          <View className="relative size-16 items-center justify-center rounded-full bg-green">
            <CheckCircle2 size={32} color="#ffffff" strokeWidth={3} />
          </View>
        </View>
        <Text className="mt-5 text-2xl font-bold text-foreground">Thanh toán thành công!</Text>
        <Text className="mt-1 px-4 text-center text-sm text-muted-foreground">
          Thợ sẽ nhận được thông báo và bắt đầu công việc.
        </Text>
        <Card className="mt-5 w-full p-4">
          <RowLine label="Số tiền" value={`${new Intl.NumberFormat('vi-VN').format(order.amount)}₫`} />
          <RowLine label="Mã đơn" value={order.id.slice(0, 8) + '…'} />
          {order.paid_at && (
            <RowLine
              label="Thời gian"
              value={new Date(order.paid_at).toLocaleString('vi-VN')}
            />
          )}
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

export type { PaymentStatus };
