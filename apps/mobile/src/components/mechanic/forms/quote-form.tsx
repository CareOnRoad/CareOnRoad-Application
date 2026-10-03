import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Trash2, Plus, FileText } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import { formatVnd } from '@/lib/quotes-service';
import type { Quote } from '@/lib/quotes-service';
import type { QuoteLineInput } from '@/lib/mechanic-quotes-service';
import { cn } from '@/lib/utils';

interface QuoteFormProps {
  /** Quote pending mới nhất (nếu đã tạo) - hiển thị read-only. */
  existing: Quote | null;
  /** Quote purpose auto-fill (read-only display). */
  purposeLabel: string;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (input: {
    lines: QuoteLineInput[];
    discount_amount?: number;
    notes?: string;
  }) => Promise<void>;
}

const lineTypeOptions: { id: QuoteLineInput['line_type']; label: string }[] = [
  { id: 'labor', label: 'Nhân công' },
  { id: 'part', label: 'Phụ tùng' },
  { id: 'other', label: 'Khác' },
];

interface DraftLine extends QuoteLineInput {
  /** Stable local id (cho React key). */
  uid: string;
}

function newDraftLine(): DraftLine {
  return {
    uid: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    line_type: 'labor',
    description: '',
    quantity: 1,
    unit_amount: 0,
  };
}

/**
 * Form tạo báo giá cho service request.
 *
 * - Nếu đã có quote pending → hiển thị read-only (rider chưa approve/reject).
 * - Nếu chưa có → form động với danh sách line items (thêm/xoá/sửa),
 *   optional `discount_amount` và `notes`.
 *
 * Subtotal được tính live = Σ (quantity × unit_amount). UI cảnh báo nếu có
 * line chưa nhập description hoặc unit_amount = 0.
 */
export function QuoteForm({
  existing,
  purposeLabel,
  submitting,
  errorMessage,
  onSubmit,
}: QuoteFormProps) {
  const [lines, setLines] = useState<DraftLine[]>([newDraftLine()]);
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_amount) || 0), 0),
    [lines],
  );
  const discountNum = Math.max(0, Math.round(Number(discount) || 0));
  const total = Math.max(0, subtotal - discountNum);

  if (existing) {
    return (
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <FileText size={16} color="#1974f7" />
          <Text className="text-sm font-semibold text-foreground">Báo giá</Text>
          <View className="ml-auto rounded-full bg-primary/10 px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-primary">v{existing.version} · Chờ duyệt</Text>
          </View>
        </View>
        <View className="rounded-2xl bg-secondary p-3">
          {existing.lines.map((line) => (
            <View key={line.id} className="flex-row items-center justify-between py-1">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-semibold text-foreground">
                  {line.description}
                </Text>
                <Text className="text-[10px] uppercase text-muted-foreground">
                  {line.line_type === 'labor' ? 'Nhân công' : line.line_type === 'part' ? 'Phụ tùng' : 'Khác'} · x{line.quantity}
                </Text>
              </View>
              <Text className="text-sm font-bold text-foreground">
                {formatVnd(line.line_total_amount)}
              </Text>
            </View>
          ))}
          <View className="mt-2 border-t border-border pt-2">
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">Tạm tính</Text>
              <Text className="text-xs font-semibold text-foreground">
                {formatVnd(existing.subtotal_amount)}
              </Text>
            </View>
            {existing.discount_amount > 0 && (
              <View className="mt-1 flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Giảm giá</Text>
                <Text className="text-xs font-semibold text-foreground">
                  -{formatVnd(existing.discount_amount)}
                </Text>
              </View>
            )}
            <View className="mt-1 flex-row justify-between">
              <Text className="text-sm font-bold text-foreground">Tổng</Text>
              <Text className="text-base font-bold text-primary">
                {formatVnd(existing.total_amount)}
              </Text>
            </View>
          </View>
          {existing.notes ? (
            <Text className="mt-2 text-xs italic text-muted-foreground">{existing.notes}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  const updateLine = (uid: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  };
  const removeLine = (uid: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.uid !== uid)));
  };
  const addLine = () => setLines((prev) => [...prev, newDraftLine()]);

  const handleSubmit = async () => {
    setLocalError(null);
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
    }
    if (total <= 0) {
      setLocalError('Tổng báo giá phải lớn hơn 0.');
      return;
    }
    await onSubmit({
      lines: lines.map((l) => ({
        line_type: l.line_type,
        description: l.description.trim(),
        quantity: l.quantity,
        unit_amount: l.unit_amount,
      })),
      ...(discountNum > 0 ? { discount_amount: discountNum } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <FileText size={16} color="#1974f7" />
        <Text className="text-sm font-semibold text-foreground">Tạo báo giá</Text>
        <View className="ml-auto rounded-full bg-secondary px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-muted-foreground">{purposeLabel}</Text>
        </View>
      </View>

      <View className="gap-3">
        {lines.map((line, idx) => (
          <View key={line.uid} className="rounded-2xl border border-border bg-background p-3">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase text-muted-foreground">
                Dòng #{idx + 1}
              </Text>
              {lines.length > 1 && (
                <Pressable
                  onPress={() => removeLine(line.uid)}
                  accessibilityRole="button"
                  accessibilityLabel="Xoá dòng"
                  className="rounded-full p-1 active:bg-destructive/10"
                >
                  <Trash2 size={14} color="#ed3f3a" />
                </Pressable>
              )}
            </View>
            <View className="mb-2 flex-row flex-wrap gap-1.5">
              {lineTypeOptions.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => updateLine(line.uid, { line_type: opt.id })}
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
                  updateLine(line.uid, { unit_amount: Math.max(0, Math.round(Number(v) || 0)) })
                }
                keyboardType="numeric"
                placeholder="Đơn giá (VND)"
                className="flex-[2]"
              />
            </View>
            <Text className="mt-1.5 text-right text-xs text-muted-foreground">
              = {formatVnd((Number(line.quantity) || 0) * (Number(line.unit_amount) || 0))}
            </Text>
          </View>
        ))}
      </View>

      <ActionButton variant="secondary" fullWidth onPress={addLine} className="py-2">
        <Plus size={14} color="#0f172a" />
        <Text className="ml-1 text-xs font-semibold text-foreground">Thêm dòng</Text>
      </ActionButton>

      <Field label="Giảm giá (VND, tùy chọn)">
        <FormTextInput
          value={discount}
          onChangeText={setDiscount}
          keyboardType="numeric"
          placeholder="0"
        />
      </Field>

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
          <Text className="text-sm font-semibold text-foreground">{formatVnd(subtotal)}</Text>
        </View>
        {discountNum > 0 && (
          <View className="mt-1 flex-row justify-between">
            <Text className="text-xs text-muted-foreground">Giảm giá</Text>
            <Text className="text-sm font-semibold text-foreground">
              -{formatVnd(discountNum)}
            </Text>
          </View>
        )}
        <View className="mt-1 flex-row justify-between border-t border-border pt-1">
          <Text className="text-sm font-bold text-foreground">Tổng cộng</Text>
          <Text className="text-lg font-bold text-primary">{formatVnd(total)}</Text>
        </View>
      </View>

      {(localError || errorMessage) && (
        <Banner
          tone="error"
          title="Không thể tạo báo giá"
          description={localError ?? errorMessage ?? ''}
        />
      )}

      <ActionButton
        fullWidth
        onPress={() => void handleSubmit()}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <FileText size={16} color="#ffffff" />
            <Text className="ml-1 text-sm font-semibold text-primary-foreground">
              Gửi báo giá cho khách
            </Text>
          </>
        )}
      </ActionButton>
    </View>
  );
}
