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
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Hourglass,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { QrCode } from '@/components/ui/qr-code';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { cn } from '@/lib/utils';
import { formatDdMmYyyyHHmm } from '@/lib/format';
import { canRenderQrCode } from '@/lib/qr-payload';
import {
  cancelPaymentOrder,
  createPaymentOrder,
  failureCodeLabel,
  getPaymentOrder,
  getPaymentSummary,
  isFinalStatus,
  isPendingStatus,
  paymentRetryDecision,
  readPaymentOrderRef,
  removePaymentOrderRef,
  savePaymentOrderRef,
  statusLabel,
  type PaymentOrder,
  type PaymentStatus,
  type PaymentSummary,
} from '@/lib/payments-service';
import { ApiError } from '@/lib/api';

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000;

/**
 * BE trả 409 với message này khi quote đã có đơn `succeeded`.
 * Xem `apps/api/src/features/payments/payment.service.ts:234`.
 */
const ALREADY_PAID_MESSAGE = 'This quote has already been paid.';

function isAlreadyPaidError(e: unknown): boolean {
  if (e instanceof ApiError && e.status === 409) {
    return e.message.includes(ALREADY_PAID_MESSAGE);
  }
  if (e instanceof Error) return e.message.includes(ALREADY_PAID_MESSAGE);
  return false;
}

/**
 * Dựng order giả từ `payment-summary` khi không còn đơn cũ nhưng quote đã
 * được trả đủ (đơn `succeeded` bị xoá khỏi storage / tạo trên máy khác).
 *
 * Chỉ dùng để render màn "thành công" — không dùng để gọi API.
 */
function buildPaidOrderFromSummary(quoteId: string, s: PaymentSummary): PaymentOrder {
  const now = new Date().toISOString();
  return {
    id: s.quote_id || quoteId,
    quote_id: s.quote_id || quoteId,
    request_id: s.request_id,
    rider_id: '',
    status: 'succeeded',
    amount: s.paid_amount,
    currency: 'VND',
    created_at: now,
    updated_at: now,
    succeeded_at: now,
  };
}

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
  // `quoteId` thiếu → lỗi hiển thị ngay, không cần setState trong effect.
  const [loading, setLoading] = useState<boolean>(Boolean(quoteId));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(
    quoteId ? null : 'Thiếu mã báo giá để tạo thanh toán.',
  );
  const [timeLeft, setTimeLeft] = useState<number>(MAX_POLL_DURATION_MS);
  // Tổng hợp thanh toán (đã trả / còn trả) — cho thanh toán nhiều bước.
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
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
        // Chỉ dừng polling khi status đã chốt (succeeded/canceled/failed).
        // `created` và `pending` vẫn cần poll vì payOS chưa xác nhận.
        if (isFinalStatus(o.status)) {
          stopPolling();
          // Đơn đã chốt (succeeded/canceled) → xoá ref để không rò rỉ.
          // Giữ ref cho `failed` vì nhánh retry cần `order.id` để huỷ.
          if (o.status === 'succeeded' || o.status === 'canceled') {
            void removePaymentOrderRef(quoteId ?? '');
          }
        }
        return o;
      } catch (e) {
        // Network blip — không fail cứng; polling tiếp tục.
        if (__DEV__) {
          console.warn('[payment] refresh failed:', e);
        }
        return null;
      }
    },
    [stopPolling, quoteId],
  );

  /** Bắt đầu poll đơn (dùng cho cả đơn mới lẫn đơn đọc lại từ storage). */
  const startPolling = useCallback(
    (orderId: string) => {
      stopPolling();
      pollStartedAt.current = Date.now();
      pollTimer.current = setInterval(async () => {
        const o = await refresh(orderId);
        if (!o || !isPendingStatus(o.status)) return;
        // Timeout
        if (Date.now() - (pollStartedAt.current ?? 0) > MAX_POLL_DURATION_MS) {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [refresh, stopPolling],
  );

  /**
   * Init: ưu tiên `GET` đơn đã lưu trong AsyncStorage, mới `POST` tạo mới.
   *
   * Vì sao không `POST` thẳng:
   *  - BE trả 409 "This quote has already been paid." nếu quote đã có đơn
   *    `succeeded` → reload màn thanh toán sẽ hiện banner lỗi thay vì màn
   *    "thành công" (P1 của plan).
   *  - Đọc ref trước giúp mount sau khi trả xong → hiện đúng màn success,
   *    không gọi `POST` không cần thiết.
   *
   * Nếu `GET` lỗi (404 / đơn không còn) → xoá ref rồi `POST` tạo mới.
   */
  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    (async () => {
      try {
        setCreating(true);

        // 1) Đọc đơn đã lưu trước.
        const cachedId = await readPaymentOrderRef(quoteId);
        if (cachedId) {
          try {
            const existing = await getPaymentOrder(cachedId);
            if (cancelled) return;
            setOrder(existing);
            if (existing.status === 'succeeded') {
              // Đã trả rồi → hiện màn success, không gọi POST (tránh 409).
              void removePaymentOrderRef(quoteId);
              setLoading(false);
              return;
            }
            if (existing.status === 'canceled') {
              // Đơn cũ đã huỷ → không dùng lại được, xoá ref và tạo mới.
              await removePaymentOrderRef(quoteId);
            } else if (existing.status === 'failed') {
              // Đơn `failed` → giữ ref để nhánh "Huỷ đơn & tạo lại" dùng
              // lại `order.id` (BE cần huỷ đơn cũ trước khi tạo đơn mới).
              setLoading(false);
              return;
            } else {
              // Còn `created`/`pending` → poll tiếp, KHÔNG tạo đơn mới.
              startPolling(existing.id);
              setLoading(false);
              return;
            }
          } catch {
            // Đơn cũ không còn dùng được → xoá ref, tạo mới bên dưới.
            await removePaymentOrderRef(quoteId);
          }
        }
        if (cancelled) return;

        // 2) Chưa có ref (hoặc ref hỏng) → tạo đơn mới.
        const created = await createPaymentOrder(quoteId);
        if (cancelled) return;
        setOrder(created);
        void savePaymentOrderRef(quoteId, created.id);
        startPolling(created.id);
      } catch (e) {
        if (cancelled) return;
        // P1: BE trả 409 "This quote has already been paid." khi quote đã
        // được trả (đơn cũ bị mất ref). Xác nhận lại bằng `payment-summary`
        // → nếu đã trả đủ thì hiện màn success thay vì banner lỗi.
        if (isAlreadyPaidError(e) && requestId) {
          const s = await getPaymentSummary(requestId).catch(() => null);
          if (cancelled) return;
          if (s && s.paid_amount >= s.total_amount && s.total_amount > 0) {
            setSummary(s);
            setOrder(buildPaidOrderFromSummary(quoteId, s));
            setLoading(false);
            return;
          }
        }
        setError(e instanceof Error ? e.message : 'Không thể tạo đơn thanh toán');
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
  }, [quoteId, requestId, refresh, startPolling, stopPolling]);

  // Tổng hợp thanh toán — BE là nguồn chính xác cho "đã trả / còn trả".
  // Không có `requestId` thì bỏ qua (màn vẫn chạy được bằng `order.amount`).
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    void getPaymentSummary(requestId)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // Countdown UI
  useEffect(() => {
    if (!order || !isPendingStatus(order.status)) return;
    const t = setInterval(() => {
      setTimeLeft(Math.max(0, MAX_POLL_DURATION_MS - (Date.now() - (pollStartedAt.current ?? 0))));
    }, 1000);
    return () => clearInterval(t);
  }, [order]);

  /**
   * Quay lại app sau khi thanh toán ở trình duyệt → app được foreground.
   *
   * Hệ điều hành có thể làm chậm timer khi app chạy nền, nên phải hỏi lại
   * backend ngay thay vì chờ tới tick 4s tiếp theo — nếu không người dùng
   * thấy trạng thái "đang chờ" dù đã trả tiền.
   */
  useEffect(() => {
    if (!order?.id) return;
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      void refresh(order.id);
    });
    return () => subscription.remove();
  }, [order?.id, refresh]);

  const handleCancel = async () => {
    if (!order) return;
    try {
      await cancelPaymentOrder(order.id);
      const o = await getPaymentOrder(order.id);
      setOrder(o);
      stopPolling();
      void removePaymentOrderRef(quoteId ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể huỷ đơn');
    }
  };

  const [retrying, setRetrying] = useState(false);

  /**
   * P2: đơn `failed` bị kẹt vĩnh viễn.
   *
   * BE giữ đơn `failed` trong `findActiveByQuoteForUpdate` → `POST` tạo đơn
   * mới sẽ trả lại chính đơn cũ, nên rider không bao giờ thoát được nếu
   * không có nút huỷ. BE cho phép huỷ đơn `failed`
   * (`apps/api/src/features/payments/payment.service.ts:432-438`).
   *
   * Thứ tự: huỷ đơn cũ → tạo đơn mới. Nếu huỷ 409 (chưa xác nhận được với
   * provider) → DỪNG, không tạo đơn mới, báo liên hệ hỗ trợ (chống
   * double-charge).
   */
  const handleRetry = async () => {
    if (!order || !quoteId) return;
    setRetrying(true);
    setError(null);
    try {
      await cancelPaymentOrder(order.id);
      const fresh = await createPaymentOrder(quoteId);
      setOrder(fresh);
      void savePaymentOrderRef(quoteId, fresh.id);
      startPolling(fresh.id);
    } catch (e) {
      if (isAlreadyPaidError(e)) {
        // Trong lúc retry, đơn cũ có thể đã được provider ghi nhận thành công.
        const s = requestId ? await getPaymentSummary(requestId).catch(() => null) : null;
        if (s && s.paid_amount >= s.total_amount && s.total_amount > 0) {
          setSummary(s);
          setOrder(buildPaidOrderFromSummary(quoteId, s));
          return;
        }
      }
      setError(
        e instanceof Error
          ? e.message
          : 'Không thể tạo lại đơn thanh toán. Vui lòng liên hệ hỗ trợ.',
      );
    } finally {
      setRetrying(false);
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

  if (order.status === 'succeeded') {
    return <PaymentSuccess order={order} requestId={requestId} summary={summary} />;
  }

  if (
    order.status === 'canceled' ||
    order.status === 'failed' ||
    order.status === 'needs_review'
  ) {
    const decision = paymentRetryDecision(order);
    const failureLabel = failureCodeLabel(order.failure_code);
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
                : order.status === 'needs_review'
                  ? 'Đơn thanh toán đang được xem xét. Vui lòng liên hệ hỗ trợ nếu cần.'
                  : failureLabel
                    ? `${failureLabel}. Vui lòng tạo đơn thanh toán mới.`
                    : 'Thanh toán thất bại. Vui lòng thử lại.'
            }
          />
          {order.status === 'failed' && order.failure_code ? (
            <Text className="mt-2 text-xs text-muted-foreground">
              Mã lỗi: {order.failure_code}
            </Text>
          ) : null}
          {error ? (
            <View className="mt-3 w-full">
              <Banner tone="error" description={error} />
            </View>
          ) : null}
          <View className="mt-5 w-full gap-3">
            {decision === 'retryable' ? (
              <ActionButton
                fullWidth
                onPress={() => void handleRetry()}
                disabled={retrying}
                accessibilityLabel="Huỷ đơn và tạo lại"
              >
                <RefreshCw size={16} color="#ffffff" />
                <Text className="text-sm font-semibold text-primary-foreground">
                  {retrying ? 'Đang tạo lại…' : 'Huỷ đơn & tạo lại'}
                </Text>
              </ActionButton>
            ) : null}
            <ActionButton
              fullWidth
              variant={decision === 'retryable' ? 'outline' : 'primary'}
              onPress={() => router.replace('/rider/(tabs)/rescue')}
            >
              <Text
                className={
                  decision === 'retryable'
                    ? 'text-sm font-semibold text-foreground'
                    : 'text-sm font-semibold text-primary-foreground'
                }
              >
                Về Cứu hộ
              </Text>
            </ActionButton>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader title="Thanh toán" subtitle={statusLabel(order.status)} onBack={() => router.back()} />
      <ScreenScroll>
        <PendingPaymentCard
          order={order}
          summary={summary}
          timeLeft={timeLeft}
          onOpenCheckout={handleOpenCheckout}
        />
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
      </ScreenScroll>
    </SafeAreaView>
  );
}

function PendingPaymentCard({
  order,
  summary,
  timeLeft,
  onOpenCheckout,
}: {
  order: PaymentOrder;
  summary: PaymentSummary | null;
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
        {order.qr_code && canRenderQrCode(order.qr_code) ? (
          <QrCode
            value={order.qr_code}
            size={224}
            accessibilityLabel="QR code thanh toán"
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
        {/* Thanh toán nhiều bước: BE `payment-summary` cho biết phần đã trả
            và phần còn lại của tổng báo giá. */}
        {summary && summary.paid_amount > 0 ? (
          <View className="mt-3 w-full rounded-2xl bg-secondary px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Đã thanh toán</Text>
              <Text className="text-xs font-semibold text-green">
                {new Intl.NumberFormat('vi-VN').format(summary.paid_amount)}₫
              </Text>
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Tổng báo giá</Text>
              <Text className="text-xs font-semibold text-foreground">
                {new Intl.NumberFormat('vi-VN').format(summary.total_amount)}₫
              </Text>
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Còn phải trả</Text>
              <Text className="text-xs font-bold text-foreground">
                {new Intl.NumberFormat('vi-VN').format(summary.remaining_amount)}₫
              </Text>
            </View>
          </View>
        ) : null}
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
  summary,
}: {
  order: PaymentOrder;
  /** BE trả về service-request id qua params; hiện không dùng trên UI này. */
  requestId?: string;
  summary?: PaymentSummary | null;
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
          {summary && summary.paid_amount > order.amount ? (
            <RowLine
              label="Tổng đã thanh toán"
              value={`${new Intl.NumberFormat('vi-VN').format(summary.paid_amount)}₫`}
            />
          ) : null}
          {order.succeeded_at && (
            <RowLine
              label="Thời gian"
              value={formatDdMmYyyyHHmm(order.succeeded_at)}
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
