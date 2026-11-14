import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { SafetyChecklist } from '@/lib/mechanic-jobs-service';

/**
 * CompletionChecklistForm - form checklist hoàn tất cho bảo dưỡng.
 *
 * BE BẮT BUỘC checklist gắn với quote `maintenance_work` đã approved trước
 * khi mechanic chuyển assignment → `awaiting_payment`
 * (xem `apps/api/src/features/assignments/assignment.service.ts`).
 *
 * Lưu ý:
 *  - BE tự gắn `approved_quote_id` (server-owned) → client KHÔNG tự chọn.
 *  - `work_summary` phải ≥ 10 ký tự (BE trả 400 nếu thiếu).
 *  - Gửi checklist KHÔNG tự đổi trạng thái assignment.
 */

const SAFETY_CHECKS: { key: keyof SafetyChecklist; label: string }[] = [
  { key: 'test_ride_completed', label: 'Đã chạy thử' },
  { key: 'tools_removed', label: 'Đã thu dọn dụng cụ' },
  { key: 'area_safe', label: 'Khu vực an toàn' },
  { key: 'rider_briefed', label: 'Đã hướng dẫn khách' },
  { key: 'no_fluid_leak', label: 'Không rò rỉ dầu / nước' },
];

const EMPTY_SAFETY: SafetyChecklist = {
  test_ride_completed: false,
  tools_removed: false,
  area_safe: false,
  rider_briefed: false,
  no_fluid_leak: false,
};

export function CompletionChecklistForm({
  submitting = false,
  errorMessage,
  submitLabel = 'Gửi checklist',
  onSubmit,
}: {
  submitting?: boolean;
  errorMessage?: string | null;
  submitLabel?: string;
  onSubmit: (input: {
    work_summary: string;
    safety_checklist: SafetyChecklist;
    notes?: string;
  }) => Promise<void> | void;
}) {
  const [workSummary, setWorkSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [safety, setSafety] = useState<SafetyChecklist>(EMPTY_SAFETY);
  const [formError, setFormError] = useState<string | null>(null);

  const allChecked = useMemo(
    () => SAFETY_CHECKS.every((item) => safety[item.key]),
    [safety],
  );

  const toggle = (key: keyof SafetyChecklist) =>
    setSafety((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = async () => {
    setFormError(null);
    if (workSummary.trim().length < 10) {
      setFormError('Vui lòng mô tả công việc đã thực hiện (tối thiểu 10 ký tự).');
      return;
    }
    if (!allChecked) {
      setFormError('Vui lòng xác nhận đầy đủ các bước kiểm tra an toàn.');
      return;
    }
    await onSubmit({
      work_summary: workSummary.trim(),
      safety_checklist: safety,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <View className="gap-4">
      <Field
        label="Tóm tắt công việc đã thực hiện"
        hint="Bắt buộc — ít nhất 10 ký tự. Khách và quản trị viên đọc được nội dung này."
      >
        <FormTextInput
          multiline
          numberOfLines={4}
          value={workSummary}
          onChangeText={setWorkSummary}
          placeholder="VD: Thay dầu, lọc gió, kiểm tra phanh theo báo giá đã duyệt."
          className="min-h-[100px]"
        />
      </Field>

      <View>
        <Text className="mb-2 text-sm font-semibold text-foreground">
          Kiểm tra an toàn
        </Text>
        <View className="gap-2">
          {SAFETY_CHECKS.map((item) => {
            const checked = safety[item.key];
            return (
              <Pressable
                key={item.key}
                onPress={() => toggle(item.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={item.label}
                className="flex-row items-center gap-3 rounded-2xl border border-border bg-secondary px-4 py-3 active:opacity-80"
              >
                <View
                  className={cn(
                    'h-5 w-5 items-center justify-center rounded-md border',
                    checked ? 'border-primary bg-primary' : 'border-border bg-card',
                  )}
                >
                  {checked ? <Check size={14} color="#ffffff" /> : null}
                </View>
                <Text className="flex-1 text-sm text-foreground">{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Field label="Ghi chú thêm (tuỳ chọn)">
        <FormTextInput
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          placeholder="VD: Nhắc khách quay lại sau 500km."
        />
      </Field>

      {formError ? <Banner tone="warning" description={formError} /> : null}
      {errorMessage ? <Banner tone="error" description={errorMessage} /> : null}

      <ActionButton
        fullWidth
        disabled={submitting}
        onPress={() => void handleSubmit()}
        accessibilityLabel="Gửi checklist hoàn tất"
      >
        <Text className="text-sm font-semibold text-primary-foreground">
          {submitting ? 'Đang gửi…' : submitLabel}
        </Text>
      </ActionButton>
    </View>
  );
}
