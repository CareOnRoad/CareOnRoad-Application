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
  Stethoscope,
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
import { cn } from '@/lib/utils';
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
  listQuotesForRequest,
  rejectQuote,
  formatVnd,
  type Quote,
} from '@/lib/quotes-service';
import {
  getCompletionChecklist,
  getLiveLocation,
  getRouteEta,
  listAssignments,
  listAssignmentDiagnoses,
  normalizeLiveLocation,
  type AssignmentDiagnosis,
  type AssignmentListItem,
  type CompletionChecklistResponse,
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
 * Map phase tone sang màu pill header (tránh phụ thuộc UI Badge ở runtime
 * nơi padding/chevron khác card, giữ cho dãy pill ngang đều nhau).
 */
function pillToneBg(tone: 'blue' | 'amber' | 'green' | 'red'): string {
  switch (tone) {
    case 'blue':
      return 'bg-primary/10';
    case 'amber':
      return 'bg-amber-500/15';
    case 'green':
      return 'bg-green/10';
    case 'red':
      return 'bg-destructive/10';
    default:
      return 'bg-secondary';
  }
}
function pillToneFg(tone: 'blue' | 'amber' | 'green' | 'red'): string {
  switch (tone) {
    case 'blue':
      return '#1974f7';
    case 'amber':
      return '#d97706';
    case 'green':
      return '#145413';
    case 'red':
      return '#ed3f3a';
    default:
      return '#64748b';
  }
}

export default function RiderRescueDetailScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const sr = useServiceRequests();

  const [request, setRequest] = useState<ServiceRequestResponse | null>(null);
  const [assignment, setAssignment] = useState<AssignmentListItem | null>(null);
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof getLatestPendingQuote>>>(null);
  // Báo giá đã được rider duyệt (status = approved) — hiển thị riêng ở các
  // phase `awaiting_payment`/`in_service`/`completed` để rider thấy tổng tiền
  // đã chốt ngay cả khi BE không còn quote pending.
  const [approvedQuote, setApprovedQuote] = useState<Quote | null>(null);
  const [eta, setEta] = useState<RouteEtaResponse | null>(null);
  const [liveRaw, setLiveRaw] = useState<Awaited<ReturnType<typeof getLiveLocation>>>(null);
  // (B.5) Diagnosis + completion checklist mechanic đã submit.
  // Lưu ý: ETA metadata bị ẩn UI theo quyết định user — chỉ giữ route-eta.
  const [diagnoses, setDiagnoses] = useState<AssignmentDiagnosis[]>([]);
  const [completionChecklist, setCompletionChecklist] = useState<CompletionChecklistResponse | null>(
    null,
  );
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
          // (B.5) Fetch diagnoses + completion checklist.
          // Mỗi bước độc lập; lỗi 1 bước không chặn các bước sau.
          setDiagnoses(await listAssignmentDiagnoses(found.id));
          setCompletionChecklist(await getCompletionChecklist(found.id));
        } else {
          setEta(null);
          setLiveRaw(null);
          setDiagnoses([]);
          setCompletionChecklist(null);
        }

        // Quote pending (nếu request chờ duyệt).
        try {
          setQuote(await getLatestPendingQuote(requestId));
        } catch {
          setQuote(null);
        }

        // Báo giá đã duyệt — luôn load (kể cả khi chưa có pending),
        // dùng để hiển thị tổng tiền ở các phase awaiting_payment /
        // in_service / completed.
        try {
          const all = await listQuotesForRequest(requestId);
          const approved = all
            .filter((q) => q.status === 'approved')
            .sort((a, b) => b.version - a.version);
          setApprovedQuote(approved[0] ?? null);
        } catch {
          setApprovedQuote(null);
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

  // Polling diagnoses mỗi 30s khi có assignment.
  useEffect(() => {
    if (!assignment || !isActiveStatus) return;
    const t = setInterval(() => {
      void listAssignmentDiagnoses(assignment.id)
        .then(setDiagnoses)
        .catch(() => undefined);
    }, POLL_ETA_MS);
    return () => clearInterval(t);
  }, [assignment, isActiveStatus]);

  // Polling completion checklist mỗi 30s khi có assignment.
  useEffect(() => {
    if (!assignment || !isActiveStatus) return;
    const t = setInterval(() => {
      void getCompletionChecklist(assignment.id)
        .then(setCompletionChecklist)
        .catch(() => undefined);
    }, POLL_ETA_MS);
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

        {/* Header pills - tóm tắt nhanh các khung đã/đang hiển thị bên dưới
            giúp rider biết trang này có gì mà không cần scroll từng card. */}
        <View className="mb-4 flex-row flex-wrap gap-2">
          {phase ? (
            <View className={cn('rounded-full px-2.5 py-1', pillToneBg(phase.tone))}>
              <Text className="text-xs font-semibold" style={{ color: pillToneFg(phase.tone) }}>
                {phase.label}
              </Text>
            </View>
          ) : null}
          {assignment ? (
            <View className="rounded-full bg-secondary px-2.5 py-1">
              <Text className="text-xs font-semibold text-secondary-foreground">
                Thợ đã nhận
              </Text>
            </View>
          ) : (
            <View className="rounded-full bg-secondary px-2.5 py-1">
              <Text className="text-xs font-semibold text-secondary-foreground">
                Chưa có thợ
              </Text>
            </View>
          )}
          {diagnoses.length > 0 ? (
            <View className="rounded-full bg-primary/10 px-2.5 py-1">
              <Text className="text-xs font-semibold text-primary">
                Có chẩn đoán
              </Text>
            </View>
          ) : null}
          {completionChecklist ? (
            <View className="rounded-full bg-green/10 px-2.5 py-1">
              <Text className="text-xs font-semibold text-green">Đã gửi checklist</Text>
            </View>
          ) : null}
          {quote ? (
            <View className="rounded-full bg-amber-500/15 px-2.5 py-1">
              <Text className="text-xs font-semibold text-amber-700">
                Có báo giá chờ duyệt
              </Text>
            </View>
          ) : approvedQuote ? (
            <View className="rounded-full bg-green/10 px-2.5 py-1">
              <Text className="text-xs font-semibold text-green">
                Đã duyệt báo giá
              </Text>
            </View>
          ) : null}
        </View>

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

        {/* Chẩn đoán từ thợ (B.5) - list các diagnosis versions */}
        {diagnoses.length > 0 ? (
          <Card className="mt-4 p-4">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Chẩn đoán của thợ
            </Text>
            <View className="gap-3">
              {diagnoses.map((d, idx) => (
                <View
                  key={d.id}
                  className={
                    idx === 0
                      ? 'rounded-2xl bg-primary/5 p-3'
                      : 'rounded-2xl border border-border bg-background p-3'
                  }
                >
                  {idx === 0 ? (
                    <View className="mb-1.5 flex-row items-center gap-1.5">
                      <Stethoscope size={12} color="#1974f7" />
                      <Text className="text-[10px] font-bold uppercase text-primary">
                        Mới nhất
                      </Text>
                    </View>
                  ) : null}
                  <Text className="text-sm font-semibold text-foreground">
                    {d.diagnosis_text}
                  </Text>
                  {d.safety_notes ? (
                    <Text className="mt-1 text-xs text-muted-foreground">
                      Ghi chú an toàn: {d.safety_notes}
                    </Text>
                  ) : null}
                  {d.recommended_work_text ? (
                    <Text className="mt-1 text-xs text-muted-foreground">
                      Xử lý đề xuất: {d.recommended_work_text}
                    </Text>
                  ) : null}
                  <Text className="mt-1.5 text-[10px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleString('vi-VN')}
                    {diagnoses.length > 1 ? ` · v${diagnoses.length - idx}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : assignment && isActiveStatus ? (
          <View className="mt-4">
            <Banner
              tone="info"
              title="Thợ chưa gửi chẩn đoán"
              description="Chẩn đoán giúp bạn hiểu nguyên nhân trước khi duyệt báo giá."
            />
          </View>
        ) : null}

        {/* Completion checklist (B.5) - hiển thị khi thợ đã submit */}
        {completionChecklist ? (
          <Card className="mt-4 p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Checklist hoàn tất
              </Text>
              <View className="rounded-full bg-green/10 px-2 py-0.5">
                <Text className="text-[10px] font-semibold text-green">
                  v{completionChecklist.revision}
                </Text>
              </View>
            </View>
            <Text className="text-sm font-semibold text-foreground">
              {completionChecklist.work_summary}
            </Text>
            <View className="mt-3 gap-1.5">
              {Object.entries(completionChecklist.safety_checklist).map(([key, value]) => {
                const labels: Record<string, string> = {
                  test_ride_completed: 'Đã chạy thử',
                  tools_removed: 'Đã thu dọn dụng cụ',
                  area_safe: 'Khu vực an toàn',
                  rider_briefed: 'Đã bàn giao cho khách',
                  no_fluid_leak: 'Không rò rỉ dầu / xăng',
                };
                return (
                  <View key={key} className="flex-row items-center gap-2">
                    {value ? (
                      <CheckCircle2 size={14} color="#145413" />
                    ) : (
                      <XCircle size={14} color="#ed3f3a" />
                    )}
                    <Text
                      className={
                        value
                          ? 'flex-1 text-xs text-foreground'
                          : 'flex-1 text-xs text-muted-foreground line-through'
                      }
                    >
                      {labels[key] ?? key}
                    </Text>
                  </View>
                );
              })}
            </View>
            {completionChecklist.notes ? (
              <Text className="mt-2 text-xs italic text-muted-foreground">
                Ghi chú: {completionChecklist.notes}
              </Text>
            ) : null}
            <Text className="mt-2 text-[10px] text-muted-foreground">
              {new Date(completionChecklist.created_at).toLocaleString('vi-VN')}
            </Text>
          </Card>
        ) : null}

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

        {/* Báo giá đã duyệt - hiển thị khi không còn pending quote nhưng rider
            vẫn cần thấy tổng tiền đã chốt (vd phase awaiting_payment → rider
            cần nhớ số tiền thanh toán; phase completed → tổng kết chi phí). */}
        {!quote && approvedQuote ? (
          <Card className="mt-4 p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="flex-row items-center gap-2 text-sm font-bold text-foreground">
                <Receipt size={16} color="#145413" />
                Báo giá đã duyệt v{approvedQuote.version}
              </Text>
              <Badge tone="green">
                <Text className="text-xs font-semibold text-green">Đã duyệt</Text>
              </Badge>
            </View>
            <View className="gap-1.5">
              {approvedQuote.lines.map((line) => (
                <View key={line.id} className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm text-foreground">
                    {line.description}{' '}
                    <Text className="text-xs text-muted-foreground">× {line.quantity}</Text>
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatVnd(line.line_total_amount)}
                  </Text>
                </View>
              ))}
            </View>
            <View className="mt-3 border-t border-border pt-2">
              {approvedQuote.discount_amount > 0 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground">Giảm giá</Text>
                  <Text className="text-sm text-foreground">
                    -{formatVnd(approvedQuote.discount_amount)}
                  </Text>
                </View>
              ) : null}
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-base font-bold text-foreground">Tổng đã chốt</Text>
                <Text className="text-base font-bold text-primary">
                  {formatVnd(approvedQuote.total_amount)}
                </Text>
              </View>
              {approvedQuote.responded_at ? (
                <Text className="mt-1 text-[10px] text-muted-foreground">
                  Duyệt lúc {new Date(approvedQuote.responded_at).toLocaleString('vi-VN')}
                </Text>
              ) : null}
            </View>
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
