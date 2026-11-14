import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FileText, Plus, Stethoscope, Trash2 } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import { formatVnd } from '@/lib/quotes-service';
import type {
  QuoteLineInput,
  QuotePurposePlan,
  RescueLaborPricingInput,
} from '@/lib/mechanic-quotes-service';
import { cn } from '@/lib/utils';

interface DiagnosisQuoteFormProps {
  /** Kế hoạch báo giá hiện tại (quyết định form nào hiển thị). */
  plan: QuotePurposePlan;
  submitting: boolean;
  errorMessage: string | null;
  /** Chẩn đoán đã tồn tại (đã lưu ở BE) → hiển thị read-only. */
  existingDiagnosisText?: string | null;
  onSubmit: (input: {
    diagnosis?: {
      diagnosis_text: string;
      safety_notes?: string;
      recommended_work_text?: string;
    };
    lines: QuoteLineInput[];
    discount_amount?: number;
    notes?: string;
    purpose: QuotePurposePlan['purpose'];
    labor_pricing?: RescueLaborPricingInput;
    basis_quote_id?: string;
  }) => Promise<void>;
}

const lineTypeOptions: { id: QuoteLineInput['line_type']; label: string }[] = [
  { id: 'labor', label: 'Nhân công' },
  { id: 'part', label: 'Phụ tùng' },
  { id: 'other', label: 'Khác' },
];

interface DraftLine extends QuoteLineInput {
  uid: string;
}

function newDraftLine(lineType: QuoteLineInput['line_type'] = 'labor'): DraftLine {
  return {
    uid: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    line_type: lineType,
    description: '',
    quantity: 1,
    unit_amount: 0,
  };
}

/**
 * Form GỘP chẩn đoán + báo giá (luồng rút gọn).
 *
 * Mục đích: mechanic nhập chẩn đoán VÀ báo giá trong 1 form, bấm 1 nút
 * → FE gọi tuần tự 2 API:
 *   1. `POST /api/v1/assignments/{id}/diagnoses`
 *   2. `POST /api/v1/service-requests/{requestId}/quotes` (kèm `diagnosis_id`)
 *
 * Rider nhận 1 yêu cầu duyệt thay vì 2 (chẩn đoán không cần rider duyệt
 * riêng — BE chỉ yêu cầu mechanic duyệt báo giá).
 *
 * Ràng buộc BE (xem `apps/api/src/features/quotes/quote.schemas.ts`):
 * - Báo giá tiền công TRƯỚC khi đi (`rescue_labor` / `maintenance_labor`)
 *   KHÔNG được kèm `diagnosis_id` → form này chỉ dùng cho bước SAU khi
 *   tới nơi (`rescue_final` / `maintenance_work` / `standard`).
 * - `rescue_final` / `maintenance_work` chỉ nhận line `part` (BE tự cộng
 *   phần công đã thống nhất) → `plan.allowedLineTypes` quyết định.
 *
 * BE KHÔNG cần sửa cho luồng này.
 */
export function DiagnosisQuoteForm({
  plan,
  submitting,
  errorMessage,
  existingDiagnosisText,
  onSubmit,
}: DiagnosisQuoteFormProps) {
  const defaultLineType = plan.allowedLineTypes[0] ?? 'labor';
  const [lines, setLines] = useState<DraftLine[]>([newDraftLine(defaultLineType)]);
  const [diagnosisText, setDiagnosisText] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [recommendedWorkText, setRecommendedWorkText] = useState('');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_amount) || 0),
        0,
      ),
    [lines],
  );
  const discountNum = plan.allowDiscount
    ? Math.max(0, Math.round(Number(discount) || 0))
    : 0;
  const total = Math.max(0, subtotal - discountNum);

  // Đã có chẩn đoán ở BE → không gửi lại (BE upsert, sẽ đè nội dung cũ).
  const diagnosisLocked = Boolean(existingDiagnosisText);

  const updateLine = (uid: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  };
  const removeLine = (uid: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.uid !== uid)));
  };
  const addLine = () => setLines((prev) => [...prev, newDraftLine(defaultLineType)]);

  const handleSubmit = async () => {
    setLocalError(null);

    // Chẩn đoán (nếu có và chưa bị khoá).
    let diagnosis:
      | { diagnosis_text: string; safety_notes?: string; recommended_work_text?: string }
      | undefined;
    if (!diagnosisLocked) {
      if (diagnosisText.trim().length < 5) {
        setLocalError('Mô tả chẩn đoán tối thiểu 5 ký tự.');
        return;
      }
      diagnosis = {
        diagnosis_text: diagnosisText.trim(),
        ...(safetyNotes.trim() ? { safety_notes: safetyNotes.trim() } : {}),
        ...(recommendedWorkText.trim()
          ? { recommended_work_text: recommendedWorkText.trim() }
          : {}),
      };
    }

    // Báo giá.
    if (lines.length === 0) {
      setLocalError('Cần ít nhất 1 dòng báo giá.');
      return;
    }
    for (const line of lines) {
      if (!line.description.trim()) {
        setLocalError('Mô tả dòng báo giá không được để trống.');
        return;
      }
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        setLocalError('Số lượng phải lớn hơn 0.');
        return;
      }
      if (!Number.isFinite(line.unit_amount) || line.unit_amount < 0) {
        setLocalError('Đơn giá phải ≥ 0.');
        return;
      }
      if (!plan.allowedLineTypes.includes(line.line_type)) {
        setLocalError('Loại hàng mục này không được phép trong bước hiện tại.');
        return;
      }
    }
    if (total <= 0) {
      setLocalError('Tổng báo giá phải lớn hơn 0.');
      return;
    }

    try {
      await onSubmit({
        ...(diagnosis ? { diagnosis } : {}),
        lines: lines.map((l) => ({
          line_type: l.line_type,
          description: l.description.trim(),
          quantity: l.quantity,
          unit_amount: l.unit_amount,
        })),
        purpose: plan.purpose,
        ...(discountNum > 0 ? { discount_amount: discountNum } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    } catch (e) {
      // BE từ chối → giữ nguyên form + hiển thị lỗi tại chỗ.
      setLocalError(e instanceof Error ? e.message : 'Không thể gửi báo giá');
    }
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Stethoscope size={16} color="#1974f7" />
        <Text className="text-sm font-semibold text-foreground">
          Chẩn đoán &amp; Báo giá
        </Text>
        <View className="ml-auto rounded-full bg-secondary px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-muted-foreground">
            {plan.label}
          </Text>
        </View>
      </View>

      <Text className="text-xs leading-relaxed text-muted-foreground">
        Nhập chẩn đoán và các hạng mục cần thay. Rider sẽ nhận 1 yêu cầu duyệt
        duy nhất cho toàn bộ báo giá.
      </Text>

      {/* Chẩn đoán */}
      {diagnosisLocked ? (
        <View className="rounded-2xl bg-secondary p-3">
          <Text className="text-xs font-semibold text-foreground">
            Chẩn đoán đã ghi nhận
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            {existingDiagnosisText}
          </Text>
        </View>
      ) : (
        <>
          <Field label="Mô tả chẩn đoán *">
            <FormTextInput
              multiline
              value={diagnosisText}
              onChangeText={setDiagnosisText}
              placeholder="VD: Bình xăng bị tắc do bụi bẩn tích tụ lâu ngày"
              className="min-h-[70px]"
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
        </>
      )}

      {/* Hạng mục báo giá */}
      <View className="gap-3">
        {lines.map((line, idx) => (
          <View
            key={line.uid}
            className="rounded-2xl border border-border bg-background p-3"
          >
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase text-muted-foreground">
                Dòng #{idx + 1}
              </Text>
              {lines.length > 1 ? (
                <Pressable
                  onPress={() => removeLine(line.uid)}
                  accessibilityRole="button"
                  accessibilityLabel="Xoá dòng"
                  className="rounded-full p-1 active:bg-destructive/10"
                >
                  <Trash2 size={14} color="#ed3f3a" />
                </Pressable>
              ) : null}
            </View>
            {plan.allowedLineTypes.length > 1 ? (
              <View className="mb-2 flex-row flex-wrap gap-1.5">
                {lineTypeOptions
                  .filter((opt) => plan.allowedLineTypes.includes(opt.id))
                  .map((opt) => (
                    <Pressable
                      key={opt.id}
                      onPress={() => updateLine(line.uid, { line_type: opt.id })}
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}
                      className={cn(
                        'rounded-full border px-3 py-1',
                        line.line_type === opt.id
                          ? 'border-primary bg-primary'
                          : 'border-border bg-background',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-xs font-medium',
                          line.line_type === opt.id
                            ? 'text-primary-foreground'
                            : 'text-foreground',
                        )}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            ) : null}
            <FormTextInput
              value={line.description}
              onChangeText={(v) => updateLine(line.uid, { description: v })}
              placeholder="Mô tả (VD: Thay dây curoa, công lắp đặt...)"
              className="mb-2"
            />
            <View className="flex-row gap-2">
              <FormTextInput
                value={String(line.quantity)}
                onChangeText={(v) =>
                  updateLine(line.uid, { quantity: Math.max(0, Number(v) || 0) })
                }
                keyboardType="numeric"
                placeholder="SL"
                className="flex-1"
              />
              <FormTextInput
                value={String(line.unit_amount)}
                onChangeText={(v) =>
                  updateLine(line.uid, {
                    unit_amount: Math.max(0, Math.round(Number(v) || 0)),
                  })
                }
                keyboardType="numeric"
                placeholder="Đơn giá (VND)"
                className="flex-[2]"
              />
            </View>
            <Text className="mt-1.5 text-right text-xs text-muted-foreground">
              ={' '}
              {formatVnd((Number(line.quantity) || 0) * (Number(line.unit_amount) || 0))}
            </Text>
          </View>
        ))}
      </View>

      <ActionButton variant="secondary" fullWidth onPress={addLine} className="py-2">
        <Plus size={14} color="#0f172a" />
        <Text className="ml-1 text-xs font-semibold text-foreground">Thêm dòng</Text>
      </ActionButton>

      {plan.allowDiscount ? (
        <Field label="Giảm giá (VND, tùy chọn)">
          <FormTextInput
            value={discount}
            onChangeText={setDiscount}
            keyboardType="numeric"
            placeholder="0"
          />
        </Field>
      ) : null}

      <Field label="Ghi chú (tùy chọn)">
        <FormTextInput
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="VD: Báo giá có hiệu lực đến 23:59 hôm nay"
        />
      </Field>

      <View className="rounded-2xl bg-primary/5 p-3">
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">Tạm tính</Text>
          <Text className="text-sm font-semibold text-foreground">
            {formatVnd(subtotal)}
          </Text>
        </View>
        {discountNum > 0 ? (
          <View className="mt-1 flex-row justify-between">
            <Text className="text-xs text-muted-foreground">Giảm giá</Text>
            <Text className="text-xs font-semibold text-foreground">
              -{formatVnd(discountNum)}
            </Text>
          </View>
        ) : null}
        <View className="mt-1 flex-row justify-between border-t border-border pt-1">
          <Text className="text-sm font-bold text-foreground">Tổng cộng</Text>
          <Text className="text-lg font-bold text-primary">{formatVnd(total)}</Text>
        </View>
      </View>

      {localError || errorMessage ? (
        <Banner
          tone="error"
          title="Không thể gửi chẩn đoán &amp; báo giá"
          description={localError ?? errorMessage ?? ''}
        />
      ) : null}

      <ActionButton fullWidth onPress={() => void handleSubmit()} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <FileText size={16} color="#ffffff" />
            <Text className="ml-1 text-sm font-semibold text-primary-foreground">
              Gửi chẩn đoán &amp; báo giá
            </Text>
          </>
        )}
      </ActionButton>
    </View>
  );
}
