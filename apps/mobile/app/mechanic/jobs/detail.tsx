import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  AlertCircle,
  Bike,
  Calendar,
  CheckCircle2,
  Circle,
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
import { suggestPurposeForServiceType } from '@/lib/mechanic-quotes-service';
import { formatDate, formatVND } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MechanicJobStatus } from '@/lib/mechanic-types';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TONE,
  JOB_STATUS_TONE_COLOR,
  type MechanicJobTone,
} from '@/lib/mechanic-types';

const purposeLabelMap: Record<string, string> = {
  standard: 'Sửa chữa thường',
  rescue_labor: 'Cứu hộ · Trước',
  rescue_final: 'Cứu hộ · Hoàn tất',
  maintenance_labor: 'Bảo dưỡng · Công',
  maintenance_work: 'Bảo dưỡng · Vật tư',
};

const timeline: { id: MechanicJobStatus; label: string }[] = [
  { id: 'pending', label: 'Đã nhận' },
  { id: 'in_progress', label: 'Đang xử lý' },
  { id: 'awaiting_parts', label: 'Chờ phụ tùng' },
  { id: 'completed', label: 'Hoàn tất' },
];

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
 * `freezeOnBlur: false` — màn hình này render `RefreshControl` + nhiều form
 * submit. Với `freezeOnBlur` mặc định (react-native-screens), khi user quay
 * lại tab trước rồi vào lại, screen bị detach rồi re-attach ở trạng thái
 * "unmounted" trong khi `NavigationStateContext` của react-navigation đã bị
 * dispose → warning "Couldn't find a navigation context" và UI trắng.
 * Tắt freeze cho phép screen giữ nguyên cây view nên không gặp lỗi này.
 */
export const unstable_settings = {
  freezeOnBlur: false,
  detachPreviousScreen: false,
};

export default function MechanicJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getJob,
    updateJobStatus,
    completeJob,
    getJobServiceType,
    getAssignmentStatus,
    submitDiagnosisForJob,
    submitQuoteForRequest,
    getDiagnosisHistoryForJob,
    loadDiagnosisHistory,
    getLatestPendingQuote,
    jobDetail,
    loadJobDetail,
    sharingAssignmentId,
    sharingError,
    locationPermissionGranted,
    autoTrackingEnabled,
    toggleLiveSharing,
  } = useMechanicApp();
  const job = id ? getJob(id) : undefined;
  const detail = id ? jobDetail(id) : null;
  const diagnosisHistory = id ? getDiagnosisHistoryForJob(id) : [];
  const latestQuote = id ? getLatestPendingQuote(id) : null;
  const serviceType = id ? getJobServiceType(id) : undefined;
  const quotePurpose = suggestPurposeForServiceType(serviceType ?? null);
  const quotePurposeLabel = purposeLabelMap[quotePurpose] ?? quotePurpose;
  const isSharing = sharingAssignmentId === id;
  // Chỉ cho phép share khi assignment thật sự ở travel state (BE whitelist
  // `accepted`/`en_route`). Phản ánh đúng contract server-side thay vì chỉ
  // guard UI = "không completed".
  const beStatus = id ? getAssignmentStatus(id) : undefined;
  const canShare = beStatus === 'accepted' || beStatus === 'en_route';
  // Auto-tracking ngầm: provider đang watch + còn assignment travel state.
  const autoTrackingActive = autoTrackingEnabled && (isSharing || canShare);

  const [diagnosisSubmitting, setDiagnosisSubmitting] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Job detail (problem description, motorcycle, latest quote) chỉ có ở
  // `GET /api/v1/mechanics/me/jobs/{id}` — list endpoint không trả.
  // Diagnosis history cũng lazy load để tránh request lúc mở list page.
  useEffect(() => {
    if (!id) return;
    void loadJobDetail(id);
    void loadDiagnosisHistory(id);
  }, [id, loadJobDetail, loadDiagnosisHistory]);

  if (!job) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Không tìm thấy" onBack={() => router.back()} />
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

  const currentStep = timeline.findIndex((s) => s.id === job.status);
  const tone = JOB_STATUS_TONE[job.status];

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title={job.type}
        subtitle={`${job.vehicle.plate} · ${job.scheduledTime}`}
        onBack={() => router.back()}
      />
      <ScreenScroll>
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
              {timeline.map((step, i) => {
                const reached = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <View key={step.id} className="flex-row items-center gap-3">
                    <View
                      className={cn(
                        'size-7 shrink-0 items-center justify-center rounded-full',
                        reached ? 'bg-primary' : 'bg-secondary',
                        isCurrent && 'ring-4 ring-primary/20',
                      )}
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
              onSave={(status, notes) => {
                void updateJobStatus(job.id, status, notes);
              }}
              onComplete={(payload) => {
                void completeJob(job.id, payload);
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

        {/* Chẩn đoán + Báo giá - chỉ hiển thị khi job đang active */}
        {job.status !== 'completed' && (
          <View className="mt-5 gap-5">
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
                    // Refresh history sau khi tạo mới.
                    await loadDiagnosisHistory(job.id);
                  } finally {
                    setDiagnosisSubmitting(false);
                  }
                }}
              />
            </Card>

            <Card className="p-4">
              <QuoteForm
                existing={latestQuote}
                purposeLabel={quotePurposeLabel}
                submitting={quoteSubmitting}
                errorMessage={quoteError}
                onSubmit={async (input) => {
                  setQuoteError(null);
                  setQuoteSubmitting(true);
                  try {
                    await submitQuoteForRequest(job.id, input);
                  } finally {
                    setQuoteSubmitting(false);
                  }
                }}
              />
            </Card>
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
