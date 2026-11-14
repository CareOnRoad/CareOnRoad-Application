import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  AlertCircle,
  Bike,
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  MapPin,
  Wrench,
} from 'lucide-react-native';

import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Banner } from '@/components/ui/banner';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { LiveSharingCard } from '@/components/mechanic/cards/live-sharing-card';
import { RouteEtaCard } from '@/components/mechanic/cards/route-eta-card';
import { JobUpdateForm } from '@/components/mechanic/forms/job-update-form';
import { DiagnosisForm } from '@/components/mechanic/forms/diagnosis-form';
import { FieldPhotoUploader } from '@/components/mechanic/forms/field-photo-uploader';
import { QuoteForm } from '@/components/mechanic/forms/quote-form';
import { DiagnosisQuoteForm } from '@/components/mechanic/forms/diagnosis-quote-form';
import { CompletionChecklistForm } from '@/components/mechanic/forms/completion-checklist-form';
import {
  quotePurposePlanFor,
  quotePlanForPurpose,
} from '@/lib/mechanic-quotes-service';
import { selectQuoteBundle } from '@/lib/quotes-service';
import { BE_JOB_TIMELINE, timelineIndexForStatus } from '@/lib/mechanic-jobs-service';
import { formatDate, formatVND } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TONE,
  JOB_STATUS_TONE_COLOR,
  type MechanicJobTone,
  type MechanicJob,
  type MechanicJobStatus,
  type MechanicJobType,
} from '@/lib/mechanic-types';

/**
 * Map BE assignment status (raw) → UI `MechanicJobStatus`.
 *
 * Mirror `mapAssignmentStatus()` trong `mechanic-app-context.tsx` — dùng cho
 * job dựng lại từ job detail khi danh sách chưa tải được.
 */
function mapFallbackStatus(beStatus: string | undefined): MechanicJobStatus {
  switch (beStatus) {
    case 'in_progress':
      return 'in_progress';
    case 'awaiting_payment':
    case 'completed':
      return 'completed';
    case 'canceled':
    case 'recovery_canceled':
      return 'canceled';
    default:
      return 'pending';
  }
}

// statusTone/statusLabel/toneColor giờ derive từ shared maps trong
// `mechanic-types.ts` để UI thống nhất với JobCard + filter chips.
const toneBg: Record<MechanicJobTone, string> = {
  amber: 'bg-amber-500/15',
  blue: 'bg-primary/10',
  red: 'bg-destructive/10',
  green: 'bg-green/10',
  neutral: 'bg-secondary',
};

/**
 * MechanicJobDetailScreen - chi tiết 1 công việc của thợ.
 *
 * Layout:
 *  1. AppHeader với back.
 *  2. Status pill + created date.
 *  3. Vehicle card.
 *  4. Customer's request card.
 *  5. Customer card.
 *  6. Job progress timeline.
 *  7. Before/After photos.
 *  8. Update form.
 *  9. Pickup location link.
 */
/**
 * Job detail của mechanic.
 *
 * Lưu ý navigation context:
 * Root layout (`apps/mobile/app/_layout.tsx`) đã gọi `enableFreeze(false)`
 * ở top-level để tránh warning "Couldn't find a navigation context" trên
 * react-native-screens 4.5.0 + NativeWind CssInterop. Màn hình này render
 * `RefreshControl` + nhiều form submit và watcher vị trí thời gian thực —
 * để root policy làm gốc thay vì override ở file.
 */
export default function MechanicJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getJob,
    advanceJobStatus,
    startDiagnosis,
    startRepair,
    markReadyForPayment,
    submitChecklist,
    completeJob,
    getJobServiceType,
    getAssignmentStatus,
    submitDiagnosisForJob,
    submitDiagnosisAndQuote,
    submitQuoteForRequest,
    getDiagnosisHistoryForJob,
    getLatestDiagnosisForJob,
    loadDiagnosisHistory,
    getLatestPendingQuote,
    getQuotesForJob,
    loadQuotesForJob,
    jobDetail,
    loadJobDetail,
    sharingAssignmentId,
    sharingError,
    locationPermissionGranted,
    autoTrackingEnabled,
    toggleLiveSharing,
    error: providerError,
  } = useMechanicApp();
  const jobFromList = id ? getJob(id) : undefined;
  const detail = id ? jobDetail(id) : null;
  const diagnosisHistory = id ? getDiagnosisHistoryForJob(id) : [];
  const latestDiagnosis = id ? getLatestDiagnosisForJob(id) : null;
  // Toàn bộ quote của job — nguồn sự thật từ BE (`GET .../quotes`).
  // Dùng để (1) hiển thị báo giá đã gửi khi mở lại màn chi tiết,
  // (2) biết quote cuối đã được rider duyệt chưa.
  const requestQuotes = useMemo(
    () => (id ? getQuotesForJob(id) : []),
    [id, getQuotesForJob],
  );
  const quoteBundle = useMemo(() => selectQuoteBundle(requestQuotes), [requestQuotes]);
  /**
   * Quote "đang chờ duyệt" ưu tiên từ BE; fallback cache in-memory.
   *
   * Trước đây chỉ dùng `getLatestPendingQuote()` (cache in-memory) → mở lại
   * app là mất thông tin báo giá đã submit, form lại hiện trống.
   */
  const latestQuote = quoteBundle.pending ?? (id ? getLatestPendingQuote(id) : null);
  // Quote cuối đã được rider duyệt (`rescue_final` / `maintenance_work`).
  const approvedFinalQuote = useMemo(
    () =>
      requestQuotes
        .filter(
          (q) =>
            q.status === 'approved' &&
            (q.purpose === 'rescue_final' || q.purpose === 'maintenance_work'),
        )
        .sort((a, b) => b.version - a.version)[0] ?? null,
    [requestQuotes],
  );
  const canStartRepair = Boolean(approvedFinalQuote);
  /**
   * Job dựng lại từ job detail khi list chưa/đã lỗi.
   *
   * Xem `mechanicJobToUiJob()` trong `mechanic-app-context.tsx` để mirror
   * cùng shape. Mục đích: mở deep-link / mở lại app khi list endpoint
   * lỗi vẫn thấy được việc đang làm thay vì màn "Không tìm thấy".
   */
  const fallbackJob = useMemo<MechanicJob | undefined>(() => {
    if (!detail || !id) return undefined;
    const scheduledDate = detail.request?.scheduled_start_at
      ? detail.request.scheduled_start_at.slice(0, 10)
      : detail.assignment.accepted_at.slice(0, 10);
    const scheduledTime = detail.request?.scheduled_start_at
      ? detail.request.scheduled_start_at.slice(11, 16)
      : detail.assignment.accepted_at.slice(11, 16);
    return {
      id,
      customer: {
        id: detail.request?.id ?? '',
        name: detail.request?.request_code ?? 'Yêu cầu cứu hộ',
        phone: '',
      },
      vehicle: {
        id: detail.motorcycle?.id ?? '',
        customerId: '',
        name: detail.motorcycle?.model_text ?? '—',
        brand: detail.motorcycle?.brand_text ?? '—',
        plate: detail.motorcycle?.license_plate ?? '—',
        mileage: 0,
      },
      type: (detail.request?.service_type ?? 'other') as MechanicJobType,
      symptom: detail.request?.problem_description ?? '',
      status: mapFallbackStatus(detail.assignment.status),
      scheduledDate,
      scheduledTime,
      durationMin: 0,
      price: 0,
    };
  }, [detail, id]);
  // `service_type` — ưu tiên job detail (`GET /api/v1/mechanics/me/jobs/{id}`
  // luôn có `request.service_type`), fallback cache từ list.
  // Nếu thiếu → `quotePurposePlanFor` rơi về `standard` → BE trả 400
  // "Quote purpose does not match the service workflow." cho cứu hộ/bảo dưỡng.
  const serviceType = detail?.request?.service_type ?? (id ? getJobServiceType(id) : undefined);
  const isSharing = sharingAssignmentId === id;
  // Trạng thái assignment thật từ BE.
  //
  // Ưu tiên cache list (`GET /api/v1/mechanics/me/jobs`) — nguồn chuẩn.
  // Fallback job detail (`GET /api/v1/mechanics/me/jobs/{id}`) khi list
  // endpoint lỗi (BE 500) → nếu không, mọi nút hành động biến mất vì
  // `beStatus` = undefined và UI tưởng mechanic chưa nhận việc.
  const beStatus =
    (id ? getAssignmentStatus(id) : undefined) ?? detail?.assignment.status;
  const canShare = beStatus === 'accepted' || beStatus === 'en_route';
  // Auto-tracking ngầm: provider đang watch + còn assignment travel state.
  const autoTrackingActive = autoTrackingEnabled && (isSharing || canShare);

  const [diagnosisSubmitting, setDiagnosisSubmitting] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [checklistSubmitting, setChecklistSubmitting] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);

  // Job detail (problem description, motorcycle, latest quote) chỉ có ở
  // `GET /api/v1/mechanics/me/jobs/{id}` — list endpoint không trả.
  // Diagnosis history cũng lazy load để tránh request lúc mở list page.
  useEffect(() => {
    if (!id) return;
    void loadJobDetail(id);
    void loadDiagnosisHistory(id);
  }, [id, loadJobDetail, loadDiagnosisHistory]);

  // Load danh sách quote của job (mechanic được phép đọc quote của
  // request mình được assign). Best-effort — fail thì để mảng rỗng.
  //
  // Quan trọng: đây là nguồn để mở lại màn chi tiết vẫn thấy báo giá đã
  // gửi + biết quote cuối đã được rider duyệt (mở nút "Bắt đầu sửa").
  //
  // `loadQuotesForJob` tự fallback `requestIdMap` → `jobDetailMap[...].request.id`,
  // và identity của nó đổi khi job detail về ⇒ effect chạy lại ⇒ quote được
  // load sau khi có request id (tránh form báo giá rỗng khi mở lại màn).
  useEffect(() => {
    if (!id) return;
    void loadQuotesForJob(id);
  }, [id, loadQuotesForJob]);

  /**
   * Kế hoạch báo giá hiện tại — quyết định form nào mechanic thấy.
   *
   * Dựa trên `service_type` + trạng thái assignment BE (nguồn sự thật).
   */
  const approvedWorkQuote = useMemo(
    () =>
      requestQuotes
        .filter((q) => q.status === 'approved' && q.purpose === 'maintenance_work')
        .sort((a, b) => b.version - a.version)[0] ?? null,
    [requestQuotes],
  );
  const quotePlan = quotePurposePlanFor(
    serviceType ?? null,
    beStatus ?? null,
    Boolean(approvedWorkQuote),
  );

  /**
   * Quote PENDING của ĐÚNG bước hiện tại — chặn form (rider chưa duyệt).
   *
   * Quote pending của bước KHÁC không được chặn form bước hiện tại.
   */
  const pendingQuoteForStep = useMemo(
    () =>
      requestQuotes
        .filter(
          (q) =>
            q.status === 'pending' &&
            (q.purpose ?? 'standard') === quotePlan.purpose,
        )
        .sort((a, b) => b.version - a.version)[0] ??
      // Quote chưa load xong từ BE → fallback cache in-memory (cùng bước).
      (latestQuote &&
      (latestQuote.purpose ?? 'standard') === quotePlan.purpose
        ? latestQuote
        : null),
    [requestQuotes, quotePlan.purpose, latestQuote],
  );

  /**
   * Quote ĐÃ DUYỆT của ĐÚNG bước hiện tại.
   *
   * Quan trọng với workflow nhiều bước: cứu hộ có 2 báo giá
   * (`rescue_labor` → `rescue_final`), bảo dưỡng có 2 (`maintenance_labor` →
   * `maintenance_work`). Nếu chỉ kiểm tra "có quote approved nào không" thì
   * quote bước TRƯỚC sẽ che mất form của bước HIỆN TẠI → thợ không gửi
   * được báo giá phụ tùng.
   */
  const approvedQuoteForStep = useMemo(
    () =>
      // Bước PHÁT SINH THÊM (maintenance addition) dùng CHUNG purpose
      // `maintenance_work` với bước vật tư → quote đã approved của bước
      // trước KHÔNG được chặn form phát sinh thêm.
      quotePlan.isAddition
        ? null
        : (requestQuotes
            .filter(
              (q) =>
                q.status === 'approved' &&
                (q.purpose ?? 'standard') === quotePlan.purpose,
            )
            .sort((a, b) => b.version - a.version)[0] ?? null),
    [requestQuotes, quotePlan.purpose, quotePlan.isAddition],
  );

  /**
   * Quote ĐÃ DUYỆT của bước TRƯỚC (khác bước hiện tại) — chỉ để hiển thị
   * thông tin cho thợ, KHÔNG chặn form của bước hiện tại.
   */
  const previousApprovedQuote = useMemo(
    () =>
      requestQuotes
        .filter(
          (q) =>
            q.status === 'approved' &&
            // Bước phát sinh thêm: quote `maintenance_work` đã approved là
            // "bước trước" (basis của báo giá phát sinh) → vẫn hiển thị.
            (quotePlan.isAddition
              ? (q.purpose ?? 'standard') === quotePlan.purpose
              : (q.purpose ?? 'standard') !== quotePlan.purpose),
        )
        .sort((a, b) => b.version - a.version)[0] ?? null,
    [requestQuotes, quotePlan.purpose, quotePlan.isAddition],
  );

  /**
   * Bảo dưỡng có workflow checklist bắt buộc (khác cứu hộ / standard).
   */
  const isMaintenance = serviceType === 'periodic_maintenance';

  /**
   * BE chỉ cho tạo chẩn đoán khi assignment ở `on_site` hoặc `diagnosis`
   * (xem `apps/api/src/features/mechanic-diagnosis/mechanic-diagnosis.service.ts`).
   * Nếu không gate → mechanic bấm "Tạo chẩn đoán" ở trạng thái `accepted`/
   * `en_route` sẽ luôn nhận 409 và form bị xoá trắng.
   */
  const canCreateDiagnosis = beStatus === 'on_site' || beStatus === 'diagnosis';

  /**
   * Form GỘP chẩn đoán + báo giá chỉ mở khi thợ đã tới nơi (`on_site` /
   * `diagnosis`), vì BE yêu cầu assignment = `diagnosis` khi tạo version
   * báo giá đầu tiên sau khi tới nơi.
   *
   * Riêng bước báo giá TIỀN CÔNG TRƯỚC KHI ĐI (`rescue_labor` /
   * `maintenance_labor`) mở khi assignment còn `accepted` — nhưng bước đó
   * KHÔNG có chẩn đoán (BE chặn `diagnosis_id` cho pre-travel labor) nên
   * vẫn dùng `QuoteForm` riêng.
   */
  const isPreTravelLabor =
    quotePlan.purpose === 'rescue_labor' || quotePlan.purpose === 'maintenance_labor';
  // Báo giá mở khi:
  //  - tiền công trước khi đi → assignment `accepted`
  //  - bước sau khi tới nơi → assignment `on_site` / `diagnosis`
  //  - REVISION (đã có quote pending/approved, cần sửa) → assignment `quoted`
  //  - báo giá PHÁT SINH THÊM (bảo dưỡng) → assignment `in_progress`
  const canCreateQuote = isPreTravelLabor
    ? beStatus === 'accepted'
    : quotePlan.isAddition
      ? beStatus === 'in_progress'
      : canCreateDiagnosis || beStatus === 'quoted';

  /**
   * Dùng form GỘP (chẩn đoán + báo giá trong 1 lần bấm) cho các bước SAU khi
   * tới nơi: `rescue_final` / `maintenance_work` (bước đầu) / `standard`.
   *
   * KHÔNG dùng cho:
   *  - `rescue_labor` / `maintenance_labor` (tiền công trước khi đi): BE cấm
   *    `diagnosis_id` cho pre-travel labor, và lúc đó thợ chưa tới nơi nên
   *    chưa có chẩn đoán.
   *  - `maintenance_work` phát sinh thêm (`isAddition`): báo giá này PHẢI
   *    trỏ tới quote `maintenance_work` đã approved qua `basis_quote_id`, và
   *    gộp chẩn đoán vào sẽ làm sai nghiệp vụ (chẩn đoán đã đóng băng).
   *  - revision khi assignment đã `quoted`: BE đóng băng chẩn đoán sau khi
   *    quote tham chiếu tới ("Diagnosis is immutable after a quote references
   *    it.") → chỉ gửi lại báo giá.
   */
  const useCombinedForm =
    !isPreTravelLabor && !quotePlan.isAddition && canCreateDiagnosis;

  /**
   * Quay lại an toàn.
   *
   * Màn hình này có thể được mở bằng deep-link (notification → `/mechanic/jobs/detail?id=...`)
   * khi stack KHÔNG có màn trước → `router.back()` ném lỗi
   * "The action 'GO_BACK' was not handled by any navigator".
   */
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/mechanic/(tabs)/jobs');
  };

  /**
   * Job dùng để render.
   *
   * Nguồn chính là list (`GET /api/v1/mechanics/me/jobs`) — nhưng nếu list
   * load lỗi (BE 500 do hết connection, mạng lỗi, ...) thì `getJob(id)`
   * trả `undefined` và màn hình hiện "Không tìm thấy" dù job vẫn tồn tại.
   *
   * Fallback: dựng job từ `GET /api/v1/mechanics/me/jobs/{id}` (job detail)
   * để thợ vẫn thấy đầy đủ thông tin việc đang làm.
   */
  const job = jobFromList ?? fallbackJob;

  if (!job) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Không tìm thấy" onBack={goBack} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="warning"
            title="Công việc không tồn tại"
            description="Có thể đã hoàn tất hoặc bị huỷ. Vui lòng quay lại danh sách."
          />
        </View>
      </SafeAreaView>
    );
  }

  // Timeline dùng BE status raw (không phải UI status gộp) → phản ánh thật.
  const currentStep = timelineIndexForStatus(beStatus);
  const tone = JOB_STATUS_TONE[job.status];

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title={job.type}
        subtitle={`${job.vehicle.plate} · ${job.scheduledTime}`}
        onBack={goBack}
      />
      <ScreenScroll>
        {providerError ? (
          <View className="mb-4">
            <Banner tone="error" title="Không thể cập nhật" description={providerError} />
          </View>
        ) : null}
        <View className="mb-4 flex-row items-center gap-2">
          <View className={cn('rounded-full px-2.5 py-1', toneBg[tone])}>
            <Text
              className="text-xs font-semibold"
              style={{ color: JOB_STATUS_TONE_COLOR[tone] }}
            >
              {JOB_STATUS_LABELS[job.status]}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            Tạo {formatDate(job.scheduledDate)}
          </Text>
        </View>

        {/* Vehicle card */}
        <Card className="p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Bike size={24} color="#1974f7" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="truncate font-bold leading-tight text-foreground">
                {detail?.motorcycle
                  ? [detail.motorcycle.brand_text, detail.motorcycle.model_text]
                      .filter(Boolean)
                      .join(' ') || 'Xe của khách'
                  : 'Chưa có thông tin xe'}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {detail?.motorcycle?.license_plate
                  ? `Biển số ${detail.motorcycle.license_plate}`
                  : detail?.sensitive_details_redacted
                    ? 'Chi tiết đã được ẩn sau khi hoàn tất'
                    : 'Chưa có biển số'}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row flex-wrap items-center gap-3 border-t border-border pt-3">
            {detail?.motorcycle?.year ? (
              <View className="flex-row items-center gap-1.5">
                <Calendar size={14} color="#64748b" />
                <Text className="text-xs text-muted-foreground">
                  {detail.motorcycle.year}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1.5">
              <Calendar size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">
                Hôm nay · {job.scheduledTime}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Clock size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">{job.durationMin} phút</Text>
            </View>
            <Text className="ml-auto text-sm font-bold text-foreground">{formatVND(job.price)}</Text>
          </View>
        </Card>

        {/* Customer request */}
        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Yêu cầu của khách
          </Text>
          <Card className="p-4">
            <View className="flex-row items-start gap-2">
              <AlertCircle size={16} color="#d97706" className="mt-0.5 shrink-0" />
              <Text className="flex-1 text-sm leading-relaxed text-foreground">
                {detail?.request?.problem_description ||
                  job.symptom ||
                  'Khách chưa mô tả chi tiết vấn đề.'}
              </Text>
            </View>
            {detail?.request?.address_text ? (
              <View className="mt-3 flex-row items-start gap-2 border-t border-border pt-3">
                <MapPin size={14} color="#1974f7" className="mt-0.5 shrink-0" />
                <Text className="flex-1 text-xs text-muted-foreground">
                  {detail.request.address_text}
                </Text>
              </View>
            ) : null}
          </Card>
        </View>

        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Khách hàng
          </Text>
          <Card className="p-4">
            <View className="flex-row items-center gap-3">
              <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                <Text className="text-lg font-bold text-secondary-foreground">
                  {(detail?.request?.request_code ?? job.customer.name ?? 'K').slice(0, 1)}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text className="truncate text-sm font-bold text-foreground">
                  {detail?.request?.request_code ?? job.customer.name}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Yêu cầu {detail?.request?.service_type ?? job.type}
                </Text>
              </View>
            </View>
            <View className="mt-3 border-t border-border pt-3">
              <Banner
                tone="info"
                title="Thông tin liên hệ được bảo vệ"
                description="Số điện thoại và hồ sơ khách hàng chỉ hiển thị trên kênh hỗ trợ chính thức của hệ thống. Bạn dùng mã yêu cầu ở trên để tra cứu và trao đổi."
              />
            </View>
          </Card>
        </View>

        {/* Job progress */}
        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tiến trình công việc
          </Text>
          <Card className="p-4">
            <View className="gap-4">
              {BE_JOB_TIMELINE.map((step, i) => {
                const reached = currentStep >= 0 && i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <View key={step.status} className="flex-row items-center gap-3">
                    {/*
                      Vòng tròn trạng thái.
                      KHÔNG dùng class `ring-*` ở đây: `ring-4` khai báo CSS
                      variable (`--tw-ring-shadow`). Khi class này được thêm
                      ĐỘNG sau render đầu (khi rider duyệt báo giá → `isCurrent`
                      đổi), NativeWind chuyển component sang
                      `VariableContext.Provider` và gọi
                      `printUpgradeWarning` → `JSON.stringify` duyệt React
                      element → chạm getter mặc định của `NavigationStateContext`
                      → throw "Couldn't find a navigation context" (crash app).

                      Dùng inline style native để tránh hoàn toàn đường đi qua
                      CSS-variable upgrade.
                    */}
                    <View
                      className={cn(
                        'size-7 shrink-0 items-center justify-center rounded-full',
                        reached ? 'bg-primary' : 'bg-secondary',
                      )}
                      style={
                        isCurrent
                          ? { borderWidth: 4, borderColor: 'rgba(25, 116, 247, 0.2)' }
                          : undefined
                      }
                    >
                      {reached ? (
                        <CheckCircle2 size={16} color="#ffffff" />
                      ) : (
                        <Circle size={16} color="#64748b" />
                      )}
                    </View>
                    <Text
                      className={cn(
                        'text-sm',
                        reached ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </Text>
                    {isCurrent && (
                      <Badge tone="blue" className="ml-auto">
                        <Text className="text-xs font-semibold text-primary">Hiện tại</Text>
                      </Badge>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        </View>

        {/* Ảnh hiện trường - BE lưu media metadata theo purpose.
            Trước = diagnosis (chụp khi tới nơi, trước khi sửa).
            Sau = work_proof (chụp sau khi hoàn tất / trước khi bàn giao). */}
        {job.status !== 'completed' ? (
          <View className="mt-5 gap-4">
            <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ảnh chẩn đoán (trước khi sửa)
            </Text>
            <Card className="p-4">
              <FieldPhotoUploader
                assignmentId={job.id}
                purpose="diagnosis"
                label="Ảnh trước"
                existingItems={detail?.media?.items ?? []}
              />
            </Card>
            {beStatus === 'in_progress' || beStatus === 'awaiting_payment' ? (
              <>
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ảnh hoàn tất (sau khi sửa)
                </Text>
                <Card className="p-4">
                  <FieldPhotoUploader
                    assignmentId={job.id}
                    purpose="work_proof"
                    label="Ảnh sau"
                    existingItems={detail?.media?.items ?? []}
                  />
                </Card>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Update form */}
        <View className="mt-5">
          <View className="mb-2 flex-row items-center gap-2">
            <Wrench size={16} color="#1974f7" />
            <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cập nhật công việc
            </Text>
          </View>
          <Card className="p-4">
            <JobUpdateForm
              job={job}
              beStatus={beStatus}
              serviceType={serviceType ?? null}
              hasApprovedFinalQuote={canStartRepair}
              onComplete={(payload) => {
                void completeJob(job.id, payload);
              }}
              onAdvance={(target, jobId, notes) => {
                void advanceJobStatus(jobId, target, notes);
              }}
              onBeAction={(action, jobId) => {
                if (action === 'startTravel') {
                  void advanceJobStatus(jobId, 'en_route');
                } else if (action === 'arrivedOnSite') {
                  void advanceJobStatus(jobId, 'on_site');
                } else if (action === 'startDiagnosis') {
                  void startDiagnosis(jobId);
                } else if (action === 'startRepair') {
                  void startRepair(jobId);
                } else {
                  void markReadyForPayment(jobId);
                }
              }}
            />
          </Card>
        </View>

        {/* Live location sharing - 1.2 */}
        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Chia sẻ vị trí
          </Text>
          <LiveSharingCard
            isSharing={isSharing}
            canShare={canShare}
            error={sharingError}
            permissionGranted={locationPermissionGranted}
            autoTrackingActive={autoTrackingActive}
            onToggle={() => {
              if (id) void toggleLiveSharing(id);
            }}
          />
        </View>

        {/* Route ETA - chỉ hiển thị khi assignment ở travel states */}
        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Thời gian di chuyển
          </Text>
          <RouteEtaCard
            assignmentId={job.id}
            canShow={beStatus === 'accepted' || beStatus === 'en_route' || beStatus === 'on_site'}
          />
        </View>

        {/* Checklist hoàn tất — BẮT BUỘC cho bảo dưỡng.
            BE yêu cầu checklist gắn quote `maintenance_work` đã approved trước
            khi chuyển `in_progress → awaiting_payment`
            (xem `apps/api/src/features/assignments/assignment.service.ts`). */}
        {isMaintenance && beStatus === 'in_progress' && (
          <View className="mt-5">
            <View className="mb-2 flex-row items-center gap-2">
              <ClipboardList size={16} color="#1974f7" />
              <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Checklist hoàn tất
              </Text>
            </View>
            <Card className="p-4">
              {detail?.completion_checklist ? (
                <View className="mb-3 rounded-2xl bg-secondary px-4 py-3">
                  <Text className="text-xs font-semibold text-foreground">
                    Đã gửi (lần {detail.completion_checklist.revision})
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {detail.completion_checklist.work_summary}
                  </Text>
                </View>
              ) : null}
              <Banner
                tone="info"
                className="mb-3"
                description="Bảo dưỡng cần checklist gắn với báo giá đã duyệt trước khi chuyển sang bước chờ thanh toán."
              />
              <CompletionChecklistForm
                submitting={checklistSubmitting}
                errorMessage={checklistError}
                onSubmit={async (input) => {
                  setChecklistError(null);
                  setChecklistSubmitting(true);
                  try {
                    await submitChecklist(job.id, input);
                    // Refresh để hiện checklist vừa gửi (revision mới nhất).
                    await loadJobDetail(job.id);
                  } catch (e) {
                    setChecklistError(
                      e instanceof Error ? e.message : 'Không thể gửi checklist hoàn tất.',
                    );
                  } finally {
                    setChecklistSubmitting(false);
                  }
                }}
              />
            </Card>
          </View>
        )}

        {/* Chẩn đoán + Báo giá — 1 FORM GỘP.
            FE gọi tuần tự 2 API: `POST .../diagnoses` → `POST .../quotes`
            (kèm `diagnosis_id`). Rider nhận 1 yêu cầu duyệt duy nhất.
            BE không cần thay đổi. */}
        {job.status !== 'completed' && (
          <View className="mt-5 gap-5">
            {/* Quote đã duyệt ở bước TRƯỚC (vd `rescue_labor`) — chỉ để
                thợ thấy số tiền đã chốt, KHÔNG chặn form bước hiện tại. */}
            {previousApprovedQuote ? (
              <Card className="p-4">
                <QuoteForm
                  existing={previousApprovedQuote}
                  plan={quotePlanForPurpose(
                    previousApprovedQuote.purpose ?? 'standard',
                  )}
                  submitting={quoteSubmitting}
                  errorMessage={quoteError}
                  onSubmit={async () => undefined}
                />
              </Card>
            ) : null}
            {pendingQuoteForStep ? (
              /* Đã có quote pending của bước này → hiển thị read-only,
                 không cho gửi lại (đang chờ rider duyệt). */
              <Card className="p-4">
                <QuoteForm
                  existing={pendingQuoteForStep}
                  plan={quotePlanForPurpose(
                    pendingQuoteForStep.purpose ?? 'standard',
                  )}
                  submitting={quoteSubmitting}
                  errorMessage={quoteError}
                  onSubmit={async () => undefined}
                />
              </Card>
            ) : approvedQuoteForStep ? (
              /* Quote của bước này đã được rider duyệt → read-only.
                 Việc sửa (revision) vẫn dùng form bên dưới. */
              <Card className="p-4">
                <QuoteForm
                  existing={approvedQuoteForStep}
                  plan={quotePlanForPurpose(
                    approvedQuoteForStep.purpose ?? 'standard',
                  )}
                  submitting={quoteSubmitting}
                  errorMessage={quoteError}
                  onSubmit={async () => undefined}
                />
              </Card>
            ) : canCreateQuote && useCombinedForm ? (
              <Card className="p-4">
                <DiagnosisQuoteForm
                  plan={quotePlan}
                  submitting={quoteSubmitting}
                  errorMessage={quoteError}
                  existingDiagnosisText={latestDiagnosis?.diagnosis_text ?? null}
                  onSubmit={async (input) => {
                    setQuoteError(null);
                    setQuoteSubmitting(true);
                    try {
                      await submitDiagnosisAndQuote(job.id, {
                        ...input,
                        // Bước phát sinh thêm (maintenance) phải trỏ tới quote
                        // `maintenance_work` đã approved.
                        ...(quotePlan.isAddition && approvedWorkQuote
                          ? { basis_quote_id: approvedWorkQuote.id }
                          : {}),
                      });
                      // Refresh chẩn đoán + chi tiết job sau khi gửi.
                      await loadDiagnosisHistory(job.id);
                      await loadJobDetail(job.id);
                    } catch (e) {
                      // Giữ nguyên nội dung form + hiển thị lỗi tại chỗ.
                      setQuoteError(
                        e instanceof Error ? e.message : 'Không thể gửi báo giá.',
                      );
                      throw e;
                    } finally {
                      setQuoteSubmitting(false);
                    }
                  }}
                />
              </Card>
            ) : canCreateQuote ? (
              /* Bước tiền công trước khi đi (`rescue_labor` / `maintenance_labor`)
                 hoặc bước phát sinh thêm — KHÔNG gộp chẩn đoán (BE chặn
                 `diagnosis_id` cho pre-travel labor). */
              <Card className="p-4">
                <QuoteForm
                  existing={null}
                  plan={quotePlan}
                  submitting={quoteSubmitting}
                  errorMessage={quoteError}
                  onSubmit={async (input) => {
                    setQuoteError(null);
                    setQuoteSubmitting(true);
                    try {
                      await submitQuoteForRequest(job.id, {
                        ...input,
                        ...(quotePlan.isAddition && approvedWorkQuote
                          ? { basis_quote_id: approvedWorkQuote.id }
                          : {}),
                      });
                    } catch (e) {
                      setQuoteError(
                        e instanceof Error ? e.message : 'Không thể tạo báo giá.',
                      );
                    } finally {
                      setQuoteSubmitting(false);
                    }
                  }}
                />
              </Card>
            ) : (
              <Card className="p-4">
                <Banner
                  tone="info"
                  title="Chưa thể gửi báo giá"
                  description={
                    quotePlan.purpose === 'rescue_labor' ||
                    quotePlan.purpose === 'maintenance_labor'
                      ? 'Báo giá tiền công trước khi đi chỉ mở khi thợ đã nhận việc. Bấm “Bắt đầu đi” ở phần cập nhật công việc sau khi chốt giá công với khách.'
                      : 'Báo giá chỉ mở khi thợ đã tới nơi. Hãy bấm “Đã tới nơi” ở phần cập nhật công việc trước.'
                  }
                />
              </Card>
            )}

            {/* Chẩn đoán đã lưu (read-only) — hiển thị cho thợ và rider. */}
            {diagnosisHistory.length > 0 ? (
              <Card className="p-4">
                <DiagnosisForm
                  history={diagnosisHistory}
                  submitting={diagnosisSubmitting}
                  errorMessage={diagnosisError}
                  onSubmit={async (input) => {
                    setDiagnosisError(null);
                    setDiagnosisSubmitting(true);
                    try {
                      await submitDiagnosisForJob(job.id, input);
                      await loadDiagnosisHistory(job.id);
                    } catch (e) {
                      setDiagnosisError(
                        e instanceof Error ? e.message : 'Không thể tạo chẩn đoán.',
                      );
                      throw e;
                    } finally {
                      setDiagnosisSubmitting(false);
                    }
                  }}
                />
              </Card>
            ) : null}
          </View>
        )}

        {/* Vị trí đón khách - dùng lat/lng thật từ BE, fallback address_text.
            Ẩn nếu cả 2 đều null. Dùng guard optional chaining để tránh crash UI. */}
        {(() => {
          const req = detail?.request;
          const loc = req?.location;
          const hasCoords =
            loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
          const address =
            req?.address_text && req.address_text.trim().length > 0
              ? req.address_text.trim()
              : null;
          if (!hasCoords && !address) return null;
          const url = hasCoords
            ? `https://www.google.com/maps/search/?api=1&query=${loc!.latitude},${loc!.longitude}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address!)}`;
          return (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Mở vị trí đón khách trên bản đồ"
              onPress={() => {
                Linking.openURL(url).catch(() => undefined);
              }}
              className="mt-5 flex-row items-center gap-2 self-start"
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <MapPin size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground underline">
                Mở vị trí đón khách trên bản đồ
              </Text>
            </Pressable>
          );
        })()}
      </ScreenScroll>
    </SafeAreaView>
  );
}
