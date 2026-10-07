import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  CheckCircle2,
  MapPin,
  Navigation,
  Receipt,
  RefreshCw,
  Wrench,
  XCircle,
} from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { useServiceRequests } from '@/hooks/use-service-requests';
import {
  getServiceRequest,
  serviceTypeLabel,
  type RouteEtaResponse,
  type ServiceRequestResponse,
} from '@/lib/service-requests-service';
import {
  approveQuote,
  getLatestPendingQuote,
  rejectQuote,
  formatVnd,
} from '@/lib/quotes-service';
import {
  getLiveLocation,
  getRouteEta,
  listAssignments,
  normalizeLiveLocation,
  type AssignmentListItem,
} from '@/lib/assignments-service';

/**
 * RiderRescueDetailScreen - chi tiết 1 yêu cầu cứu hộ / bảo dưỡng.
 *
 * Dùng cho request đang active (mechanic đã nhận việc, chờ báo giá, chờ
 * thanh toán) và request đã kết thúc. Route:
 *   `/rider/rescue/[requestId]`
 *
 * Polling:
 *  - request + quote: 5s khi request còn active
 *  - ETA: 30s khi có assignment
 *  - live-location: 15s khi có assignment
 *
 * Vì sao screen này tồn tại: tab `rescue` chỉ theo dõi session "đang chạy"
 * qua `useServiceRequests().active`. Khi rider mở app lại, thoát app, hoặc
 * vào từ notification/history, `active` rỗng → không có UI để xem báo giá,
 * ETA, trạng thái thợ. Screen này load theo `requestId` nên luôn khôi phục
 * được trạng thái từ BE.
 */

const POLL_ACTIVE_MS = 5_000;
const POLL_ETA_MS = 30_000;
const POLL_LIVE_MS = 15_000;

const ACTIVE_STATUSES = new Set([
  'submitted',
  'dispatching',
  'offered',
  'assigned',
  'mechanic_en_route',
  'on_site',
  'diagnosis',
  'quoted',
  'awaiting_quote_approval',
  'awaiting_payment',
  'in_service',
  'in_progress',
]);

const PHASE_BY_STATUS: Record<string, { label: string; tone: 'blue' | 'amber' | 'green' | 'red' }> = {
  submitted: { label: 'Đang gửi yêu cầu', tone: 'blue' },
  dispatching: { label: 'Đang tìm thợ', tone: 'amber' },
  offered: { label: 'Đang chờ thợ nhận', tone: 'amber' },
  manual_escalation: { label: 'Cần hỗ trợ tìm thợ', tone: 'red' },
  assigned: { label: 'Thợ đã nhận việc', tone: 'blue' },
  mechanic_en_route: { label: 'Thợ đang đến', tone: 'blue' },
  in_service: { label: 'Thợ đang xử lý', tone: 'amber' },
  awaiting_quote_approval: { label: 'Chờ duyệt báo giá', tone: 'amber' },
  awaiting_payment: { label: 'Chờ thanh toán', tone: 'amber' },
  completed: { label: 'Hoàn tất', tone: 'green' },
  canceled: { label: 'Đã huỷ', tone: 'red' },
};

/**
 * `freezeOnBlur: false` — xem giải thích ở `mechanic/jobs/detail.tsx`.
 * Màn hình này có `RefreshControl` + polling nên bị freeze sẽ mất cây view
 * khi quay lại, gây warning navigation context và UI trắng.
 */
export const unstable_settings = {
  freezeOnBlur: false,
  detachPreviousScreen: false,
};

export default function RiderRescueDetailScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const sr = useServiceRequests();

  const [request, setRequest] = useState<ServiceRequestResponse | null>(null);
  const [assignment, setAssignment] = useState<AssignmentListItem | null>(null);
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof getLatestPendingQuote>>>(null);
  const [eta, setEta] = useState<RouteEtaResponse | null>(null);
  const [liveRaw, setLiveRaw] = useState<Awaited<ReturnType<typeof getLiveLocation>>>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const liveLocation = useMemo(() => normalizeLiveLocation(liveRaw), [liveRaw]);

  const isActiveStatus = request ? ACTIVE_STATUSES.has(request.status) : false;
  const phase = request ? (PHASE_BY_STATUS[request.status] ?? { label: request.status, tone: 'blue' as const }) : null;
  const canCancel =
    request !== null &&
    ['submitted', 'dispatching', 'offered', 'assigned', 'mechanic_en_route'].includes(request.status);

  /**
   * Load 1 lần: request → tìm assignment → ETA + live location + quote.
   * Mỗi bước độc lập; lỗi 1 bước không chặn các bước sau.
   */
  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!requestId) {
        setError('Thiếu mã yêu cầu.');
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      try {
        const req = await getServiceRequest(requestId);
        setRequest(req);

        // Tìm assignment gắn với request (rider được phép đọc assignment
        // của chính mình qua `GET /api/v1/assignments`).
        let found: AssignmentListItem | null = null;
        try {
          const page = await listAssignments({ active_only: true, limit: 50 });
          found = page.items.find((a) => a.request_id === requestId) ?? null;
          if (!found) {
            // Không còn active → thử full list (job có thể vừa completed).
            const all = await listAssignments({ limit: 50 });
            found = all.items.find((a) => a.request_id === requestId) ?? null;
          }
        } catch {
          found = null;
        }
        setAssignment(found);

        // ETA + live location chỉ có khi có assignment.
        if (found) {
          try {
            setEta(await getRouteEta(found.id));
          } catch {
            setEta(null);
          }
          try {
            setLiveRaw(await getLiveLocation(found.id));
          } catch {
            setLiveRaw(null);
          }
        } else {
          setEta(null);
          setLiveRaw(null);
        }

        // Quote pending (nếu request chờ duyệt).
        try {
          setQuote(await getLatestPendingQuote(requestId));
        } catch {
          setQuote(null);
        }

        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải được yêu cầu cứu hộ.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestId],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  // Polling request + quote khi request còn active.
  useEffect(() => {
    if (!requestId || !isActiveStatus) return;
    const t = setInterval(() => {
      void load('refresh');
    }, POLL_ACTIVE_MS);
    return () => clearInterval(t);
  }, [load, requestId, isActiveStatus]);

  // Polling ETA 30s khi có assignment.
  useEffect(() => {
    if (!assignment || !isActiveStatus) return;
    const t = setInterval(() => {
      void getRouteEta(assignment.id)
        .then(setEta)
        .catch(() => undefined);
    }, POLL_ETA_MS);
    return () => clearInterval(t);
  }, [assignment, isActiveStatus]);

  // Polling live-location 15s khi có assignment.
  useEffect(() => {
    if (!assignment || !isActiveStatus) return;
    const t = setInterval(() => {
      void getLiveLocation(assignment.id)
        .then(setLiveRaw)
        .catch(() => undefined);
    }, POLL_LIVE_MS);
    return () => clearInterval(t);
  }, [assignment, isActiveStatus]);

  const handleCancel = useCallback(async () => {
    if (!requestId) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await sr.cancelById(requestId, 'Người dùng huỷ từ màn hình chi tiết');
      await load('refresh');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Không huỷ được yêu cầu.');
    } finally {
      setActionBusy(false);
    }
  }, [requestId, sr, load]);

  const handleApprove = useCallback(async () => {
    if (!quote) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await approveQuote(quote.id);
      await load('refresh');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Không duyệt được báo giá.');
    } finally {
      setActionBusy(false);
    }
  }, [quote, load]);

  const handleReject = useCallback(async () => {
    if (!quote) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await rejectQuote(quote.id, 'Từ chối từ màn hình chi tiết');
      await load('refresh');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Không từ chối được báo giá.');
    } finally {
      setActionBusy(false);
    }
  }, [quote, load]);

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Chi tiết yêu cầu" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1974f7" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !request) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Chi tiết yêu cầu" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon={XCircle}
            title="Không tìm thấy yêu cầu"
            description={error ?? 'Yêu cầu có thể đã bị xoá hoặc bạn không có quyền xem.'}
          />
          <View className="mt-4">
            <ActionButton variant="outline" onPress={() => router.back()}>
              <Text className="text-sm font-semibold text-foreground">Quay lại</Text>
            </ActionButton>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const etaMinutes =
    eta?.status === 'available' && eta.duration_seconds
      ? Math.max(1, Math.round(eta.duration_seconds / 60))
      : null;
  const etaDistance = eta?.distance_meters ? `${(eta.distance_meters / 1000).toFixed(1)} km` : null;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title="Chi tiết yêu cầu"
        subtitle={request.request_code}
        onBack={() => router.back()}
        right={
          <ActionButton
            variant="ghost"
            size="sm"
            accessibilityLabel="Làm mới"
            disabled={refreshing}
            onPress={() => void load('refresh')}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#1974f7" />
            ) : (
              <RefreshCw size={16} color="#1974f7" />
            )}
          </ActionButton>
        }
      />
      <ScreenScroll>
        {actionError && (
          <View className="mb-4">
            <Banner tone="error" description={actionError} />
          </View>
        )}

        {/* Trạng thái */}
        <Card className="p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="size-11 items-center justify-center rounded-2xl bg-primary/10">
                <Wrench size={20} color="#1974f7" />
              </View>
              <View>
                <Text className="text-sm font-bold text-foreground">
                  {serviceTypeLabel(request.service_type)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(request.created_at).toLocaleString('vi-VN')}
                </Text>
              </View>
            </View>
            {phase && (
              <Badge tone={phase.tone}>
                <Text className="text-xs font-semibold">{phase.label}</Text>
              </Badge>
            )}
          </View>
          {request.problem_description ? (
            <View className="mt-3 border-t border-border pt-3">
              <Text className="text-sm leading-relaxed text-foreground">
                {request.problem_description}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* ETA + vị trí thợ */}
        {assignment ? (
          <Card className="mt-4 p-4">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Thợ đã nhận việc
            </Text>
            <View className="flex-row items-center gap-3">
              <View className="size-10 items-center justify-center rounded-xl bg-primary/10">
                <Navigation size={18} color="#1974f7" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  ETA {etaMinutes ? `~${etaMinutes} phút` : eta?.status === 'fallback' ? 'đang tính…' : '—'}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {etaDistance ? `Khoảng cách ${etaDistance}` : 'Chưa có khoảng cách'}
                </Text>
              </View>
            </View>
            {liveLocation ? (
              <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-secondary px-3 py-2">
                <MapPin size={14} color="#1974f7" className="mt-0.5" />
                <Text className="flex-1 text-xs text-muted-foreground">
                  Vị trí thợ: {liveLocation.latitude.toFixed(4)}, {liveLocation.longitude.toFixed(4)} ·{' '}
                  {liveLocation.ageSeconds}s trước
                </Text>
              </View>
            ) : (
              <View className="mt-3 rounded-xl bg-secondary px-3 py-2">
                <Text className="text-xs text-muted-foreground">
                  Thợ chưa chia sẻ vị trí. ETA dựa trên khoảng cách ước tính.
                </Text>
              </View>
            )}
            {request.address_text ? (
              <View className="mt-3 flex-row items-start gap-2 border-t border-border pt-3">
                <MapPin size={14} color="#64748b" className="mt-0.5" />
                <Text className="flex-1 text-xs text-muted-foreground">{request.address_text}</Text>
              </View>
            ) : null}
          </Card>
        ) : (
          <View className="mt-4">
            <Banner
              tone="info"
              title={request.status === 'manual_escalation' ? 'Cần hỗ trợ' : 'Đang tìm thợ'}
              description={
                request.status === 'manual_escalation'
                  ? 'Chúng tôi chưa tìm được thợ phù hợp. Yêu cầu vẫn còn hiệu lực, vui lòng liên hệ hỗ trợ.'
                  : 'Chưa có thợ nhận việc. Trang này tự động cập nhật mỗi vài giây.'
              }
            />
          </View>
        )}

        {/* Báo giá */}
        {quote ? (
          <Card className="mt-4 p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="flex-row items-center gap-2 text-sm font-bold text-foreground">
                <Receipt size={16} color="#d97706" />
                Báo giá v{quote.version}
              </Text>
              <Badge tone="amber">
                <Text className="text-xs font-semibold text-amber-700">Chờ duyệt</Text>
              </Badge>
            </View>
            <View className="gap-1.5">
              {quote.lines.map((line) => (
                <View key={line.id} className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm text-foreground">
                    {line.description} <Text className="text-xs text-muted-foreground">× {line.quantity}</Text>
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatVnd(line.line_total_amount)}
                  </Text>
                </View>
              ))}
            </View>
            <View className="mt-3 border-t border-border pt-2">
              {quote.discount_amount > 0 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground">Giảm giá</Text>
                  <Text className="text-sm text-foreground">-{formatVnd(quote.discount_amount)}</Text>
                </View>
              ) : null}
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-base font-bold text-foreground">Tổng</Text>
                <Text className="text-base font-bold text-primary">{formatVnd(quote.total_amount)}</Text>
              </View>
            </View>
            {request.status === 'awaiting_quote_approval' ? (
              <View className="mt-4 flex-row gap-2">
                <ActionButton
                  variant="outline"
                  fullWidth
                  disabled={actionBusy}
                  onPress={() => void handleReject()}
                  accessibilityLabel="Từ chối báo giá"
                >
                  <Text className="text-sm font-semibold text-foreground">Từ chối</Text>
                </ActionButton>
                <ActionButton fullWidth disabled={actionBusy} onPress={() => void handleApprove()}>
                  <Text className="text-sm font-semibold text-white">Duyệt & thanh toán</Text>
                </ActionButton>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Hành động */}
        {canCancel ? (
          <ActionButton
            variant="destructive"
            fullWidth
            className="mt-5 py-4"
            disabled={actionBusy}
            onPress={() => void handleCancel()}
            accessibilityLabel="Huỷ yêu cầu"
          >
            <Text className="text-sm font-semibold text-white">Huỷ yêu cầu</Text>
          </ActionButton>
        ) : null}

        {request.status === 'awaiting_payment' ? (
          <ActionButton
            fullWidth
            className="mt-5 py-4"
            onPress={() => router.push(`/rider/payments/${quote?.id ?? ''}`)}
            accessibilityLabel="Thanh toán"
          >
            <Text className="text-sm font-semibold text-white">Thanh toán ngay</Text>
          </ActionButton>
        ) : null}

        {request.status === 'completed' ? (
          <ActionButton
            variant="outline"
            fullWidth
            className="mt-5"
            onPress={() => router.push(`/rider/review?requestId=${request.id}`)}
            accessibilityLabel="Đánh giá"
          >
            <Text className="flex-row items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 size={16} color="#145413" />
              Đánh giá thợ
            </Text>
          </ActionButton>
        ) : null}
      </ScreenScroll>
    </SafeAreaView>
  );
}
