import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ClipboardList, Plus, Wrench, X } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { MechanicJob, JobUpdatePayload } from '@/lib/mechanic-types';
import {
  nextAllowedStatuses,
  nextStepHint,
  statusLabel,
  submitEta,
  type AssignmentStatus,
} from '@/lib/mechanic-jobs-service';

/**
 * Nút hành động theo trạng thái BE hiện tại của assignment.
 *
 * Nguồn sự thật là BE state machine (`nextAllowedStatuses`), KHÔNG phải UI
 * status — vì UI `MechanicJobStatus` chỉ có 5 giá trị và không phản ánh
 * được `on_site`/`diagnosis`/`quoted`/`awaiting_payment`.
 */
type BeAction = {
  key:
    | 'startTravel'
    | 'arrivedOnSite'
    | 'startDiagnosis'
    | 'startRepair'
    | 'markReadyForPayment';
  label: string;
  description: string;
};

const BE_ACTIONS: Record<string, BeAction> = {
  accepted: {
    key: 'startTravel',
    label: 'Bắt đầu đi',
    description: 'Chuyển assignment sang bước đang đến nơi để rider theo dõi vị trí.',
  },
  en_route: {
    key: 'arrivedOnSite',
    label: 'Đã tới nơi',
    description: 'Thông báo đã tới nơi và bắt đầu kiểm tra tại hiện trường.',
  },
  on_site: {
    key: 'startDiagnosis',
    label: 'Bắt đầu chẩn đoán',
    description: 'Chuyển assignment sang bước chẩn đoán để có thể gửi báo giá.',
  },
  awaiting_payment: {
    key: 'startRepair',
    label: 'Bắt đầu sửa',
    description: 'Rider đã thanh toán — bắt đầu công việc sửa chữa.',
  },
  in_progress: {
    key: 'markReadyForPayment',
    label: 'Báo đã sửa xong',
    description: 'Chuyển sang chờ thanh toán để rider thanh toán phần còn lại.',
  },
};

/**
 * Action cho trạng thái `diagnosis` — chỉ dùng cho workflow nhiều bước.
 *
 * BE (`quote.service.ts` → approve quote) đưa assignment về `diagnosis` sau khi
 * rider duyệt báo giá cuối (`rescue_final` / `maintenance_work`). Mechanic
 * phải bấm "Bắt đầu sửa" để chuyển `diagnosis → in_progress`.
 *
 * Với `standard`, `diagnosis` là bước chẩn đoán (bấm "Bắt đầu chẩn đoán"
 * chuyển `on_site → diagnosis`), nên KHÔNG hiện action này.
 */
const DIAGNOSIS_BE_ACTION: BeAction = {
  key: 'startRepair',
  label: 'Bắt đầu sửa',
  description: 'Rider đã duyệt báo giá — bắt đầu sửa chữa.',
};

/**
 * Trạng thái BE mà mechanic KHÔNG được tự chuyển tới từ form này:
 *  - `canceled`: huỷ việc là hành động riêng, cần xác nhận.
 *  - `completed`: đóng assignment thuộc về rider (sau thanh toán) hoặc admin —
 *    xem `completeJob()` (gửi checklist + chuyển `awaiting_payment`).
 */
const EXCLUDED_ADVANCE_TARGETS: AssignmentStatus[] = ['canceled', 'completed'];

export function JobUpdateForm({
  job,
  onComplete,
  beStatus,
  onBeAction,
  onAdvance,
  serviceType,
  hasApprovedFinalQuote,
}: {
  job: MechanicJob;
  onComplete: (payload: JobUpdatePayload) => void;
  /** Trạng thái assignment thật từ BE (raw). */
  beStatus?: string;
  /** Handler cho các nút hành động theo BE state machine. */
  onBeAction?: (action: BeAction['key'], jobId: string) => void;
  /**
   * Chuyển assignment sang 1 BE status cụ thể (kèm ghi chú).
   * Nguồn danh sách: `nextAllowedStatuses(beStatus)` — mirror state machine BE.
   */
  onAdvance?: (target: AssignmentStatus, jobId: string, notes?: string) => void;
  /** `service_type` của request — dùng để mirror workflow nhiều bước. */
  serviceType?: string | null;
  /** Đã có quote cuối (`rescue_final` / `maintenance_work`) được rider duyệt. */
  hasApprovedFinalQuote?: boolean;
}) {
  const [notes, setNotes] = useState(job.notes ?? '');
  const [price, setPrice] = useState(job.price.toString());
  const [parts, setParts] = useState<string[]>(job.partsReplaced ?? []);
  const [newPart, setNewPart] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const addPart = () => {
    const trimmed = newPart.trim();
    if (!trimmed) return;
    setParts((prev) => [...prev, trimmed]);
    setNewPart('');
  };

  const removePart = (idx: number) => setParts((prev) => prev.filter((_, i) => i !== idx));

  // BE state machine — giúp mechanic hiểu transitions hợp lệ.
  // PHẢI dùng `beStatus` (BE raw), không dùng `job.status` (UI status gộp
  // 8 BE state vào 5 giá trị) — nếu không, `nextAllowedStatuses('pending')`
  // trả về `[]` và mechanic không thấy bước tiếp theo nào.
  const allowedBeStatuses = useMemo(
    () =>
      beStatus
        ? nextAllowedStatuses(beStatus as AssignmentStatus, {
            serviceType,
            hasApprovedFinalQuote,
          })
        : nextAllowedStatuses((job.status as unknown) as AssignmentStatus, {
            serviceType,
            hasApprovedFinalQuote,
          }),
    [beStatus, job.status, serviceType, hasApprovedFinalQuote],
  );

  /** Các bước chuyển trạng thái mechanic được phép bấm trực tiếp. */
  const advanceTargets = useMemo(
    () => allowedBeStatuses.filter((s) => !EXCLUDED_ADVANCE_TARGETS.includes(s)),
    [allowedBeStatuses],
  );

  /**
   * Nút hành động theo trạng thái BE thật (không phải UI status).
   * Chỉ hiện khi BE đang ở `accepted` / `en_route` / `on_site` /
   * `awaiting_payment` / `in_progress`.
   *
   * Ngoại lệ `diagnosis`: workflow nhiều bước (cứu hộ / bảo dưỡng) đưa
   * assignment về `diagnosis` sau khi rider duyệt báo giá cuối → hiện nút
   * "Bắt đầu sửa" (`diagnosis → in_progress`).
   */
  const beAction = useMemo(() => {
    if (!beStatus) return null;
    if (beStatus === 'diagnosis') {
      const multiStepWorkflow =
        serviceType === 'emergency_rescue' || serviceType === 'periodic_maintenance';
      return multiStepWorkflow && hasApprovedFinalQuote ? DIAGNOSIS_BE_ACTION : null;
    }
    return BE_ACTIONS[beStatus] ?? null;
  }, [beStatus, serviceType, hasApprovedFinalQuote]);

  /**
   * Hướng dẫn bước tiếp theo — quan trọng ở các trạng thái BE KHÔNG có
   * transition thủ công (vd `diagnosis`: BE tự chuyển `quoted` khi thợ gửi
   * báo giá). Nếu không có hướng dẫn, mechanic tưởng app bị lỗi.
   */
  const nextHint = useMemo(
    () =>
      nextStepHint((beStatus ?? job.status) as AssignmentStatus, {
        serviceType,
        hasApprovedFinalQuote,
      }),
    [beStatus, job.status, serviceType, hasApprovedFinalQuote],
  );

  /**
   * Form chi phí cuối + phụ tùng chỉ hợp lệ khi đã có thể chốt việc
   * (BE: `in_progress` / `awaiting_payment`). Ở các trạng thái khác,
   * `completeJob` sẽ bị BE từ chối (409).
   */
  const canComplete = beStatus === 'in_progress' || beStatus === 'awaiting_payment';

  const handleEtaSubmit = async () => {
    setFormError(null);
    if (!etaMinutes.trim() && !delayReason.trim()) {
      setFormError('Vui lòng nhập số phút ETA hoặc lý do trễ.');
      return;
    }
    setSubmitting(true);
    try {
      const etaAt = etaMinutes.trim()
        ? new Date(Date.now() + Number(etaMinutes) * 60 * 1000).toISOString()
        : undefined;
      await submitEta(job.id, {
        ...(etaAt ? { eta_at: etaAt } : {}),
        ...(delayReason.trim() ? { delay_reason: delayReason.trim() } : {}),
      });
      setEtaMinutes('');
      setDelayReason('');
    } catch (e) {
      // Hiển thị message từ server (vd: "ETA must be at least one minute...")
      // kèm prefix tiếng Việt để user hiểu.
      const serverMsg =
        e instanceof Error ? e.message : 'Không thể gửi ETA';
      setFormError(`Gửi ETA thất bại: ${serverMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View className="gap-4">
        {/* ETA section - chỉ hiển thị khi job đang chạy và không completed */}
        {beStatus !== 'completed' && (
          <View className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <Text className="text-sm font-semibold text-foreground">Báo ETA / trễ (tùy chọn)</Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              Rider sẽ thấy thông báo ETA này mà không cần bạn gọi điện.
            </Text>
            <View className="mt-2 flex-row gap-2">
              <FormTextInput
                value={etaMinutes}
                onChangeText={setEtaMinutes}
                keyboardType="numeric"
                placeholder="Phút tới nơi"
                className="flex-1"
              />
              <FormTextInput
                value={delayReason}
                onChangeText={setDelayReason}
                placeholder="Lý do trễ (tùy chọn)"
                className="flex-1"
              />
            </View>
            <ActionButton
              fullWidth
              variant="secondary"
              onPress={() => void handleEtaSubmit()}
              disabled={submitting}
              className="mt-2 py-2"
            >
              <Text className="text-sm font-semibold text-foreground">
                {submitting ? 'Đang gửi…' : 'Gửi ETA'}
              </Text>
            </ActionButton>
          </View>
        )}

        {/* Trạng thái hiện tại theo BE state machine */}
        <View className="rounded-2xl bg-secondary px-3 py-2">
          <Text className="text-[11px] uppercase tracking-wider text-muted-foreground">
            BE State machine
          </Text>
          <Text className="mt-0.5 text-sm font-semibold text-foreground">
            Hiện tại: {statusLabel((beStatus ?? job.status) as AssignmentStatus)}
          </Text>
          {allowedBeStatuses.length > 0 ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">
              Có thể chuyển: {allowedBeStatuses.map((s) => statusLabel(s)).join(' · ')}
            </Text>
          ) : null}
          {/*
            Luôn hiện hướng dẫn bước tiếp theo khi KHÔNG có transition thủ
            công — nhiều trạng thái BE (vd `diagnosis`) được hệ thống tự
            chuyển, không phải mechanic bấm.
          */}
          {nextHint ? (
            <Text className="mt-1 text-xs font-medium text-primary">
              {nextHint}
            </Text>
          ) : null}
        </View>

        {/* Hành động theo BE state machine — nguồn sự thật là BE status */}
        {beAction && onBeAction ? (
          <View className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <Text className="text-sm font-semibold text-foreground">{beAction.label}</Text>
            <Text className="mt-1 text-xs text-muted-foreground">{beAction.description}</Text>
            <ActionButton
              fullWidth
              className="mt-2 py-2"
              disabled={submitting}
              onPress={() => onBeAction(beAction.key, job.id)}
            >
              <Text className="text-sm font-semibold text-primary-foreground">
                {submitting ? 'Đang xử lý…' : beAction.label}
              </Text>
            </ActionButton>
          </View>
        ) : null}

        {/* Cập nhật tiến độ — chuyển trạng thái theo state machine BE */}
        <View>
          <Text className="mb-2 text-sm font-semibold text-foreground">Cập nhật tiến độ</Text>
          {advanceTargets.length > 0 && onAdvance ? (
            <View className="gap-2">
              {advanceTargets.map((target) => (
                <Pressable
                  key={target}
                  accessibilityRole="button"
                  accessibilityLabel={`Chuyển sang ${statusLabel(target)}`}
                  onPress={() => onAdvance(target, job.id, notes.trim() || undefined)}
                  className={cn(
                    'flex-row items-center gap-2 rounded-2xl border px-3 py-2.5 active:scale-[0.98]',
                    'border-primary bg-primary',
                  )}
                >
                  <Wrench size={14} color="#ffffff" />
                  <Text className="text-sm font-medium text-primary-foreground">
                    {statusLabel(target)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text className="text-xs text-muted-foreground">
              {nextHint
                ? nextHint
                : 'Không có bước chuyển trạng thái nào khả dụng ở thời điểm này. Dùng các nút hành động phía trên để tiếp tục.'}
            </Text>
          )}
        </View>

        <Field label="Ghi chú sửa chữa">
          <FormTextInput
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            placeholder="Mô tả đã làm gì, phụ tùng thay, lời khuyên cho khách..."
            className="min-h-[100px]"
          />
        </Field>

        {canComplete ? (
          <>
            <Field label="Chi phí cuối (VND)">
              <FormTextInput
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
                placeholder="180000"
              />
            </Field>

            <View>
              <Text className="mb-1.5 block text-sm font-semibold text-foreground">Phụ tùng đã thay</Text>
              <View className="flex-row gap-2">
                <FormTextInput
                  value={newPart}
                  onChangeText={setNewPart}
                  onSubmitEditing={addPart}
                  placeholder="VD: Má phanh trước"
                  className="flex-1"
                  returnKeyType="done"
                />
                <Pressable
                  onPress={addPart}
                  accessibilityLabel="Thêm phụ tùng"
                  className="size-12 shrink-0 items-center justify-center rounded-2xl bg-primary active:opacity-60"
                >
                  <Plus size={20} color="#ffffff" />
                </Pressable>
              </View>
              {parts.length > 0 && (
                <View className="mt-3 gap-2">
                  {parts.map((p, i) => (
                    <View key={i} className="flex-row items-center gap-2 rounded-2xl bg-secondary px-3 py-2">
                      <ClipboardList size={16} color="#64748b" />
                      <Text className="flex-1 truncate text-sm text-foreground">{p}</Text>
                      <Pressable
                        onPress={() => removePart(i)}
                        accessibilityLabel={`Xoá ${p}`}
                        className="size-7 items-center justify-center rounded-full active:bg-background"
                      >
                        <X size={16} color="#64748b" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}

        {formError && <Banner tone="error" description={formError} />}

        {canComplete ? (
          <ActionButton
            fullWidth
            variant="mint"
            onPress={() =>
              onComplete({
                price: Number(price) || 0,
                notes: notes.trim() || undefined,
                partsReplaced: parts.length > 0 ? parts : undefined,
              })
            }
          >
            <Text className="text-sm font-semibold text-green">
              Gửi checklist & chờ thanh toán
            </Text>
          </ActionButton>
        ) : null}
      </View>
    </ScrollView>
  );
}

// Re-export helper for callers that want to submit ETA without using form
export { submitEta };
