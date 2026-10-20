import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, History, Plus, Stethoscope } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import { formatDate } from '@/lib/format';
import type { DiagnosisRecord } from '@/lib/mechanic-jobs-service';

interface DiagnosisFormProps {
  /**
   * Lịch sử diagnosis (mới nhất trước). Khi `length > 0` → hiển thị read-only
   * latest + nút "Xem các phiên trước" expand list. Backend hiện chỉ giữ 1
   * row / assignment (upsert) nhưng endpoint trả mảng để tương thích.
   */
  history: DiagnosisRecord[];
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (input: {
    diagnosis_text: string;
    recommended_work_text?: string;
    safety_notes?: string;
  }) => Promise<void>;
}

/**
 * Form tạo / xem lịch sử chẩn đoán cho assignment.
 *
 *  - Nếu `history.length > 0` → hiển thị read-only latest (mặc định) + button
 *    "Xem các phiên trước" expand ra toàn bộ versions.
 *  - Nếu `history.length === 0` → form với 3 field: `summary` (bắt buộc),
 *    `root_cause`, `recommended_action`.
 *
 * Validation client-side:
 *  - `summary` tối thiểu 5 ký tự.
 *
 * Guard chống crash UI:
 *  - `history` undefined → coi như `[]`.
 *  - Mỗi item render dùng `record.id` làm stable key.
 *  - Style động (opacity) qua `style={({ pressed }) => [...]}`, không nhồi className.
 *  - Không nhét <View> trong <Text>.
 */
export function DiagnosisForm({
  history,
  submitting,
  errorMessage,
  onSubmit,
}: DiagnosisFormProps) {
  const items = Array.isArray(history) ? history : [];
  const latest = items[0] ?? null;

  if (latest) {
    return (
      <HistoryView
        items={items}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <CreateView
      submitting={submitting}
      errorMessage={errorMessage}
      onSubmit={onSubmit}
    />
  );
}

function HistoryView({
  items,
  submitting,
  errorMessage,
  onSubmit,
}: {
  items: DiagnosisRecord[];
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: DiagnosisFormProps['onSubmit'];
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const latest = items[0]!; // items.length >= 1 ensured by parent
  const hasMore = items.length > 1;

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
        <Text className="text-sm font-semibold text-foreground">{latest.diagnosis_text}</Text>
        {latest.safety_notes ? (
          <Text className="mt-1 text-xs text-muted-foreground">
            Ghi chú an toàn: {latest.safety_notes}
          </Text>
        ) : null}
        {latest.recommended_work_text ? (
          <Text className="mt-1 text-xs text-muted-foreground">
            Xử lý đề xuất: {latest.recommended_work_text}
          </Text>
        ) : null}
        <Text className="mt-1.5 text-[10px] text-muted-foreground">
          {formatDate(latest.created_at)}
        </Text>
      </View>

      {hasMore ? (
        <View className="gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Ẩn các phiên trước' : 'Xem các phiên trước'}
            onPress={() => setExpanded((v) => !v)}
            className="flex-row items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1.5"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <History size={12} color="#1974f7" />
            <Text className="text-xs font-semibold text-primary">
              {expanded ? 'Ẩn các phiên trước' : 'Xem các phiên trước'} ({items.length - 1})
            </Text>
            {expanded ? (
              <ChevronUp size={12} color="#1974f7" />
            ) : (
              <ChevronDown size={12} color="#1974f7" />
            )}
          </Pressable>

          {expanded
            ? items.slice(1).map((rec) => (
                <View
                  key={rec.id}
                  className="rounded-2xl border border-border bg-background p-3"
                >
                  <Text className="text-sm font-medium text-foreground">{rec.diagnosis_text}</Text>
                  {rec.safety_notes ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      Ghi chú an toàn: {rec.safety_notes}
                    </Text>
                  ) : null}
                  {rec.recommended_work_text ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      Xử lý đề xuất: {rec.recommended_work_text}
                    </Text>
                  ) : null}
                  <Text className="mt-1 text-[10px] text-muted-foreground">
                    {formatDate(rec.created_at)}
                  </Text>
                </View>
              ))
            : null}
        </View>
      ) : null}

      {/* Cho phép thêm phiên mới (BE cho phép nhiều versions, latest wins). */}
      {!addingNew ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cập nhật chẩn đoán mới"
          onPress={() => setAddingNew(true)}
          className="mt-1 self-start rounded-full border border-primary px-3 py-1.5"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <Text className="text-xs font-semibold text-primary">+ Cập nhật chẩn đoán mới</Text>
        </Pressable>
      ) : (
        <CreateView
          submitting={submitting}
          errorMessage={errorMessage}
          onSubmit={async (input) => {
            await onSubmit(input);
            setAddingNew(false);
          }}
          onCancel={() => setAddingNew(false)}
        />
      )}
    </View>
  );
}

function CreateView({
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: DiagnosisFormProps['onSubmit'];
  onCancel?: () => void;
}) {
  const [diagnosisText, setDiagnosisText] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [recommendedWorkText, setRecommendedWorkText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    if (diagnosisText.trim().length < 5) {
      setLocalError('Mô tả chẩn đoán tối thiểu 5 ký tự.');
      return;
    }
    await onSubmit({
      diagnosis_text: diagnosisText.trim(),
      ...(safetyNotes.trim() ? { safety_notes: safetyNotes.trim() } : {}),
      ...(recommendedWorkText.trim()
        ? { recommended_work_text: recommendedWorkText.trim() }
        : {}),
    });
    // Reset form khi submit thành công - parent sẽ unmount component này
    // khi BE trả về record mới, nhưng reset để defensive.
    setDiagnosisText('');
    setSafetyNotes('');
    setRecommendedWorkText('');
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
          value={diagnosisText}
          onChangeText={setDiagnosisText}
          placeholder="VD: Bình xăng bị tắc do bụi bẩn tích tụ lâu ngày"
          className="min-h-[80px]"
        />
      </Field>

      <Field label="Ghi chú an toàn (tùy chọn)">
        <FormTextInput
          value={safetyNotes}
          onChangeText={setSafetyNotes}
          placeholder="VD: Không tự ý tháo ráp khi chưa khoá bình ắc quy"
        />
      </Field>

      <Field label="Hướng xử lý đề xuất (tùy chọn)">
        <FormTextInput
          value={recommendedWorkText}
          onChangeText={setRecommendedWorkText}
          placeholder="VD: Vệ sinh bình xăng, thay bộ lọc nhiên liệu"
        />
      </Field>

      {(localError || errorMessage) ? (
        <Banner
          tone="error"
          title="Không thể tạo chẩn đoán"
          description={localError ?? errorMessage ?? ''}
        />
      ) : null}

      <View className="flex-row gap-2">
        {onCancel ? (
          <ActionButton
            fullWidth={false}
            variant="secondary"
            onPress={onCancel}
            className="flex-1"
          >
            <Text className="text-sm font-semibold text-foreground">Huỷ</Text>
          </ActionButton>
        ) : null}
        <ActionButton
          fullWidth={!onCancel}
          onPress={() => void handleSubmit()}
          disabled={submitting}
          className="flex-1 mt-1"
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
    </View>
  );
}
