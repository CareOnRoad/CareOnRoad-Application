import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Plus, Stethoscope } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import type { DiagnosisRecord } from '@/lib/mechanic-jobs-service';

interface DiagnosisFormProps {
  /** Diagnosis đã tạo (cached) - nếu có thì hiển thị read-only. */
  existing: DiagnosisRecord | null;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (input: {
    summary: string;
    root_cause?: string;
    recommended_action?: string;
  }) => Promise<void>;
}

/**
 * Form tạo chẩn đoán cho assignment.
 *
 *  - Nếu đã có diagnosis → hiển thị read-only (BE chỉ cho phép tạo 1 diagnosis đầu).
 *  - Nếu chưa có → form với 3 field: `summary` (bắt buộc), `root_cause`,
 *    `recommended_action`.
 *
 * Validation client-side:
 *  - `summary` tối thiểu 5 ký tự.
 */
export function DiagnosisForm({
  existing,
  submitting,
  errorMessage,
  onSubmit,
}: DiagnosisFormProps) {
  const [summary, setSummary] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (existing) {
    return (
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Stethoscope size={16} color="#1974f7" />
          <Text className="text-sm font-semibold text-foreground">Chẩn đoán</Text>
          <View className="ml-auto rounded-full bg-green/10 px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-green">Đã ghi nhận</Text>
          </View>
        </View>
        <View className="rounded-2xl bg-secondary p-3">
          <Text className="text-sm font-semibold text-foreground">{existing.summary}</Text>
          {existing.root_cause ? (
            <Text className="mt-1 text-xs text-muted-foreground">
              Nguyên nhân: {existing.root_cause}
            </Text>
          ) : null}
          {existing.recommended_action ? (
            <Text className="mt-1 text-xs text-muted-foreground">
              Xử lý đề xuất: {existing.recommended_action}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  const handleSubmit = async () => {
    setLocalError(null);
    if (summary.trim().length < 5) {
      setLocalError('Mô tả chẩn đoán tối thiểu 5 ký tự.');
      return;
    }
    await onSubmit({
      summary: summary.trim(),
      ...(rootCause.trim() ? { root_cause: rootCause.trim() } : {}),
      ...(recommendedAction.trim()
        ? { recommended_action: recommendedAction.trim() }
        : {}),
    });
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Stethoscope size={16} color="#1974f7" />
        <Text className="text-sm font-semibold text-foreground">Tạo chẩn đoán</Text>
      </View>
      <Text className="text-xs text-muted-foreground">
        Chẩn đoán giúp rider và BE hiểu nguyên nhân trước khi báo giá.
      </Text>

      <Field label="Mô tả chẩn đoán *">
        <FormTextInput
          multiline
          value={summary}
          onChangeText={setSummary}
          placeholder="VD: Bình xăng bị tắc do bụi bẩn tích tụ lâu ngày"
          className="min-h-[80px]"
        />
      </Field>

      <Field label="Nguyên nhân (tùy chọn)">
        <FormTextInput
          value={rootCause}
          onChangeText={setRootCause}
          placeholder="VD: Không vệ sinh bình xăng định kỳ"
        />
      </Field>

      <Field label="Hướng xử lý đề xuất (tùy chọn)">
        <FormTextInput
          value={recommendedAction}
          onChangeText={setRecommendedAction}
          placeholder="VD: Vệ sinh bình xăng, thay bộ lọc nhiên liệu"
        />
      </Field>

      {(localError || errorMessage) && (
        <Banner
          tone="error"
          title="Không thể tạo chẩn đoán"
          description={localError ?? errorMessage ?? ''}
        />
      )}

      <ActionButton
        fullWidth
        onPress={() => void handleSubmit()}
        disabled={submitting}
        className="mt-1"
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Plus size={16} color="#ffffff" />
            <Text className="ml-1 text-sm font-semibold text-primary-foreground">
              Tạo chẩn đoán
            </Text>
          </>
        )}
      </ActionButton>
    </View>
  );
}
