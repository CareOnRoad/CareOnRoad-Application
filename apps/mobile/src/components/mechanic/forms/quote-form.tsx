import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Trash2, Plus, FileText } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import { formatVnd } from '@/lib/quotes-service';
import type { Quote } from '@/lib/quotes-service';
import type {
  QuoteLineInput,
  QuotePurposePlan,
  RescueLaborPricingInput,
} from '@/lib/mechanic-quotes-service';
import { cn } from '@/lib/utils';

interface QuoteFormProps {
  /** Quote pending mới nhất (nếu đã tạo) - hiển thị read-only. */
  existing: Quote | null;
  /** Kế hoạch báo giá hiện tại (quyết định form nào hiển thị). */
  plan: QuotePurposePlan;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (input: {
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
  /** Stable local id (cho React key). */
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

const WEATHER_OPTIONS: { id: RescueLaborPricingInput['weather']; label: string }[] = [
  { id: 'sunny', label: 'Nắng' },
  { id: 'rain', label: 'Mưa' },
];

/**
 * Nhãn trạng thái báo giá — hiển thị read-only khi quote đã gửi.
 *
 * Quote `approved` = rider đã duyệt → thợ thấy "Đã duyệt" (không còn
 * "Chờ duyệt" như trước, gây nhầm lẫn khi mở lại màn chi tiết).
 */
const EXISTING_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  superseded: 'Đã thay thế',
  expired: 'Đã hết hạn',
};

/**
 * Form tạo báo giá cho service request.
 *
 * - Nếu đã có quote pending → hiển thị read-only (rider chưa approve/reject).
 * - Nếu chưa có → form động theo `plan`:
 *   - `standard`        : danh sách line items (labor/part/other) + discount.
 *   - `rescue_labor`    : bảng giá công cứu hộ (base/distance/weather/time +
 *                         chọn thời tiết). KHÔNG có line items, KHÔNG discount.
 *   - `parts_only`      : chỉ nhập phụ tùng (BE tự cộng phần công đã thống nhất).
 *
 * Subtotal được tính live = Σ (quantity × unit_amount). UI cảnh báo nếu có
 * line chưa nhập description hoặc unit_amount = 0.
 */
export function QuoteForm({
  existing,
  plan,
  submitting,
  errorMessage,
  onSubmit,
}: QuoteFormProps) {
  const defaultLineType = plan.allowedLineTypes[0] ?? 'labor';
  const [lines, setLines] = useState<DraftLine[]>([newDraftLine(defaultLineType)]);
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  // Bảng giá công cứu hộ.
  const [baseAmount, setBaseAmount] = useState('0');
  const [distanceAmount, setDistanceAmount] = useState('0');
  const [weatherAmount, setWeatherAmount] = useState('0');
  const [timeAmount, setTimeAmount] = useState('0');
  const [weather, setWeather] = useState<RescueLaborPricingInput['weather']>('sunny');

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_amount) || 0), 0),
    [lines],
  );
  const discountNum = plan.allowDiscount ? Math.max(0, Math.round(Number(discount) || 0)) : 0;
  const total = Math.max(0, subtotal - discountNum);

  const laborPricing = useMemo<RescueLaborPricingInput | null>(() => {
    if (!plan.requiresLaborPricing) return null;
    return {
      base_amount: Math.max(0, Math.round(Number(baseAmount) || 0)),
      distance_amount: Math.max(0, Math.round(Number(distanceAmount) || 0)),
      weather_amount: Math.max(0, Math.round(Number(weatherAmount) || 0)),
      time_amount: Math.max(0, Math.round(Number(timeAmount) || 0)),
      weather,
    };
  }, [plan.requiresLaborPricing, baseAmount, distanceAmount, weatherAmount, timeAmount, weather]);

  const laborTotal = laborPricing
    ? laborPricing.base_amount +
      laborPricing.distance_amount +
      laborPricing.weather_amount +
      laborPricing.time_amount
    : 0;

  if (existing) {
    return (
      <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <FileText size={16} color="#1974f7" />
        <Text className="text-sm font-semibold text-foreground">Báo giá</Text>
        <View className="ml-auto rounded-full bg-primary/10 px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-primary">
            v{existing.version} · {EXISTING_STATUS_LABEL[existing.status] ?? 'Chờ duyệt'}
          </Text>
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
  const addLine = () => setLines((prev) => [...prev, newDraftLine(defaultLineType)]);

  const handleSubmit = async () => {
    setLocalError(null);

    // Chế độ bảng giá công cứu hộ — không có line items.
    if (plan.requiresLaborPricing) {
      if (!laborPricing || laborPricing.base_amount <= 0) {
        setLocalError('Tiền công cơ bản phải lớn hơn 0.');
        return;
      }
      try {
        await onSubmit({
          lines: [],
          purpose: plan.purpose,
          labor_pricing: laborPricing,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      } catch (e) {
        // BE từ chối → giữ nguyên form + hiển thị lỗi tại chỗ.
        setLocalError(e instanceof Error ? e.message : 'Không thể tạo báo giá');
      }
      return;
    }

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
      setLocalError(e instanceof Error ? e.message : 'Không thể tạo báo giá');
    }
  };
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <FileText size={16} color="#1974f7" />
        <Text className="text-sm font-semibold text-foreground">Tạo báo giá</Text>
        <View className="ml-auto rounded-full bg-secondary px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-muted-foreground">{plan.label}</Text>
        </View>
      </View>

      <Text className="text-xs leading-relaxed text-muted-foreground">{plan.hint}</Text>

      {plan.requiresLaborPricing && laborPricing ? (
        /* Chế độ bảng giá công cứu hộ */
        <View className="gap-3 rounded-2xl border border-border bg-background p-3">
          <Field label="Tiền công cơ bản (VND)">
            <FormTextInput
              value={baseAmount}
              onChangeText={(v) => setBaseAmount(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="100000"
            />
          </Field>
          <Field label="Phí khoảng cách (VND)">
            <FormTextInput
              value={distanceAmount}
              onChangeText={(v) => setDistanceAmount(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="20000"
            />
          </Field>
          <Field label="Phí thời tiết (VND)">
            <FormTextInput
              value={weatherAmount}
              onChangeText={(v) => setWeatherAmount(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="10000"
            />
          </Field>
          <Field label="Phí thời điểm (VND)">
            <FormTextInput
              value={timeAmount}
              onChangeText={(v) => setTimeAmount(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="30000"
            />
          </Field>
          <View>
            <Text className="mb-1.5 block text-sm font-semibold text-foreground">Thời tiết</Text>
            <View className="flex-row gap-2">
              {WEATHER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setWeather(opt.id)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  className={cn(
                    'flex-1 items-center rounded-2xl border px-3 py-2.5 active:scale-[0.98]',
                    weather === opt.id
                      ? 'border-primary bg-primary'
                      : 'border-border bg-background',
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      weather === opt.id ? 'text-primary-foreground' : 'text-foreground',
                    )}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Text className="text-[11px] leading-relaxed text-muted-foreground">
            Khoảng cách và khung giờ điểm sẽ được hệ thống tự tính và ghi vào báo giá.
          </Text>
        </View>
      ) : (
        /* Chế độ line items */
        <>
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
                {plan.allowedLineTypes.length > 1 && (
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
                )}
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
        </>
      )}

      {plan.allowDiscount && (
        <Field label="Giảm giá (VND, tùy chọn)">
          <FormTextInput
            value={discount}
            onChangeText={setDiscount}
            keyboardType="numeric"
            placeholder="0"
          />
        </Field>
      )}

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
          <Text className="text-xs text-muted-foreground">
            {plan.requiresLaborPricing ? 'Tạm tính công cứu hộ' : 'Tạm tính'}
          </Text>
          <Text className="text-sm font-semibold text-foreground">
            {formatVnd(plan.requiresLaborPricing ? laborTotal : subtotal)}
          </Text>
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
          <Text className="text-lg font-bold text-primary">
            {formatVnd(plan.requiresLaborPricing ? laborTotal : total)}
          </Text>
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
