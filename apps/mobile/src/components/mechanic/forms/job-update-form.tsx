import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ClipboardList, Plus, X } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { MechanicJob, MechanicJobStatus, JobUpdatePayload } from '@/lib/mechanic-types';
import {
  nextAllowedStatuses,
  statusLabel,
  submitEta,
  type AssignmentStatus,
} from '@/lib/mechanic-jobs-service';

/**
 * Helper mapping UI MechanicJobStatus → BE AssignmentStatus (informational only;
 * thực tế mapping được thực hiện trong MechanicAppContext để áp dụng cho toàn app).
 */
export function uiStatusToBe(ui: MechanicJobStatus): AssignmentStatus | null {
  switch (ui) {
    case 'pending':
      return 'accepted';
    case 'in_progress':
      return 'in_progress';
    case 'awaiting_parts':
      return 'diagnosis';
    case 'completed':
      return 'completed';
    default:
      return null;
  }
}

const uiStatusOptions: { id: MechanicJobStatus; label: string }[] = [
  { id: 'pending', label: 'Chờ xử lý' },
  { id: 'in_progress', label: 'Đang sửa' },
  { id: 'awaiting_parts', label: 'Chờ phụ tùng' },
  { id: 'completed', label: 'Hoàn tất' },
];

export function JobUpdateForm({
  job,
  onSave,
  onComplete,
}: {
  job: MechanicJob;
  onSave: (status: MechanicJobStatus, notes: string) => void;
  onComplete: (payload: JobUpdatePayload) => void;
}) {
  const [status, setStatus] = useState<MechanicJobStatus>(job.status);
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

  const canSave =
    status === 'completed'
      ? Number(price) > 0
      : status !== job.status || notes !== (job.notes ?? '');

  // BE state machine — giúp mechanic hiểu transitions hợp lệ
  const allowedBeStatuses = useMemo(
    () => nextAllowedStatuses((job.status as unknown) as AssignmentStatus),
    [job.status],
  );

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
      setFormError(e instanceof Error ? e.message : 'Không thể gửi ETA');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    setFormError(null);
    if (status === 'completed') {
      onComplete({
        price: Number(price) || 0,
        notes: notes.trim() || undefined,
        partsReplaced: parts.length > 0 ? parts : undefined,
      });
    } else {
      onSave(status, notes.trim());
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View className="gap-4">
        {/* ETA section - chỉ hiển thị khi job đang chạy và không completed */}
        {status !== 'completed' && (
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
            Hiện tại: {statusLabel((job.status as unknown) as AssignmentStatus)}
          </Text>
          {allowedBeStatuses.length > 0 && (
            <Text className="mt-0.5 text-xs text-muted-foreground">
              Có thể chuyển: {allowedBeStatuses.map((s) => statusLabel(s)).join(' · ')}
            </Text>
          )}
        </View>

        <View>
          <Text className="mb-2 text-sm font-semibold text-foreground">Cập nhật trạng thái</Text>
          <View className="flex-row flex-wrap gap-2">
            {uiStatusOptions.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setStatus(opt.id)}
                className={cn(
                  'min-w-[48%] flex-1 rounded-2xl border px-3 py-2.5 active:scale-[0.98]',
                  status === opt.id ? 'border-primary bg-primary' : 'border-border bg-background',
                )}
              >
                <Text
                  className={cn(
                    'text-center text-sm font-medium',
                    status === opt.id ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
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

        {status === 'completed' && (
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
                  placeholder="e.g. Má phanh trước"
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
        )}

        {formError && <Banner tone="error" description={formError} />}

        <ActionButton
          fullWidth
          disabled={!canSave}
          variant={status === 'completed' ? 'mint' : 'primary'}
          onPress={handleSubmit}
        >
          <Text
            className={`text-sm font-semibold ${status === 'completed' ? 'text-green' : 'text-primary-foreground'}`}
          >
            {status === 'completed' ? 'Đánh dấu hoàn tất' : 'Lưu thay đổi'}
          </Text>
        </ActionButton>
      </View>
    </ScrollView>
  );
}

// Re-export helper for callers that want to submit ETA without using form
export { submitEta };
