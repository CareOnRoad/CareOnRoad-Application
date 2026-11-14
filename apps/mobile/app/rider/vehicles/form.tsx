import React, { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Sparkles } from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { useAuth } from '@/contexts/auth-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { DateTimePickerField, dateToIsoDate } from '@/components/ui/datetime-picker-field';
import { Field, FormTextInput, SectionHeader } from '@/components/ui/form';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { ApiError } from '@/lib/api';
import { hasVipPlan, planRequiredMessageFor } from '@/lib/plan-gate';
import {
  VEHICLE_DETAIL_FIELDS,
  detailsToFormState,
  formStateToDetailsPatch,
  isFutureIsoDate,
  isValidPurchasePrice,
  type VehicleDetailsFormState,
} from '@/lib/vehicle-details';

/**
 * VehicleFormScreen - thêm mới / chỉnh sửa thông tin xe.
 *
 * - Create: gửi POST /api/v1/motorcycles qua AppContext.addVehicle().
 * - Update: gửi PATCH /api/v1/motorcycles/[id] qua AppContext.updateVehicle().
 *
 * Hồ sơ xe đầy đủ (gói VIP) — section "Hồ sơ xe đầy đủ":
 *  - Ghi qua `PATCH /api/v1/motorcycles/[id]/details` (endpoint riêng, D13).
 *  - Gửi giá trị MỚI cần gói VIP → không có gói thì khoá nhập, chỉ cho XOÁ
 *    (gửi `null`, luôn được phép — D14).
 *  - Đọc (hiển thị) luôn được phép, kể cả khi gói đã hết hạn (D7).
 */
export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { vehicles, addVehicle, updateVehicle, updateVehicleDetails } = useApp();
  const { user } = useAuth();
  const existing = id ? vehicles.find((v) => v.id === id) : undefined;

  const vipActive = hasVipPlan(user?.planCode);
  const originalDetails = existing?.details;

  const [form, setForm] = useState({
    brand: existing?.brand ?? '',
    model: existing?.name.replace(existing?.brand ?? '', '').trim() ?? '',
    plate: existing?.plate ?? '',
    year: existing?.year?.toString() ?? '',
    notes: '',
  });
  const [detailsForm, setDetailsForm] = useState<VehicleDetailsFormState>(() =>
    detailsToFormState(originalDetails),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const yearTrimmed = form.year.trim();
  const yearNumber = yearTrimmed ? Number(yearTrimmed) : NaN;
  const yearValid =
    !yearTrimmed || (Number.isInteger(yearNumber) && yearNumber >= 1950 && yearNumber <= currentYear + 1);
  const yearError = yearTrimmed && !yearValid
    ? `Năm sản xuất phải từ 1950 đến ${currentYear + 1}.`
    : undefined;

  const valid =
    form.brand.trim() && form.model.trim() && form.plate.trim() && yearValid;

  /**
   * Patch details đã được chuẩn hoá theo ngữ nghĩa partial-update của BE.
   * `null` = không có thay đổi nào → không gọi API.
   */
  const detailsPatch = useMemo(
    () => formStateToDetailsPatch(detailsForm, originalDetails),
    [detailsForm, originalDetails],
  );

  /** Lỗi validate client cho hồ sơ xe (trả về message tiếng Việt hoặc null). */
  const detailsError = useMemo(() => {
    for (const field of VEHICLE_DETAIL_FIELDS) {
      const raw = detailsForm[field.key] ?? '';
      if (field.kind === 'date' && raw.trim() && isFutureIsoDate(raw)) {
        return `${field.label} không được ở tương lai.`;
      }
      if (field.kind === 'number' && !isValidPurchasePrice(raw)) {
        return `${field.label} không hợp lệ.`;
      }
    }
    return null;
  }, [detailsForm]);

  /** Người dùng có đang cố nhập giá trị mới khi chưa có gói VIP không? */
  const tryingToAddWhileLocked = useMemo(() => {
    if (vipActive) return false;
    // Có thay đổi nào KHÔNG phải xoá (null) → cần gói VIP.
    if (!detailsPatch) return false;
    return Object.values(detailsPatch).some((value) => value !== null);
  }, [detailsPatch, vipActive]);

  const setDetail = (key: string, value: string) => {
    setDetailsForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!valid) {
      if (yearError) {
        setError(yearError);
        return;
      }
      setError('Vui lòng nhập đầy đủ hãng, model và biển số');
      return;
    }
    if (detailsError) {
      setError(detailsError);
      return;
    }
    if (tryingToAddWhileLocked) {
      setError('Tính năng này cần gói VIP. Bạn vẫn có thể xoá thông tin đã lưu.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        plate: form.plate.trim(),
        year: form.year ? Number(form.year) : undefined,
        notes: form.notes.trim() || undefined,
      };
      if (existing) {
        const result = await updateVehicle({
          ...existing,
          brand: payload.brand,
          name: `${payload.brand} ${payload.model}`,
          plate: payload.plate,
          year: payload.year ?? existing.year,
        });
        if (!result) throw new Error('Không thể cập nhật xe');

        // Hồ sơ xe đầy đủ: chỉ gọi khi có thay đổi thực sự.
        if (detailsPatch) {
          try {
            await updateVehicleDetails(existing.id, detailsPatch);
          } catch (detailsError) {
            const planMessage = planRequiredMessageFor(detailsError);
            throw new Error(
              planMessage ??
                (detailsError instanceof Error
                  ? detailsError.message
                  : 'Không thể cập nhật hồ sơ xe'),
            );
          }
        }
      } else {
        const created = await addVehicle(payload);
        if (!created) throw new Error('Không thể thêm xe');
      }
      router.back();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Không thể lưu xe');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title={existing ? 'Chỉnh sửa xe' : 'Thêm xe mới'}
        subtitle={existing ? `${existing.brand} · ${existing.plate}` : 'Điền thông tin bên dưới'}
        onBack={() => router.back()}
      />
      <ScreenScroll>
        {/* Thông tin cơ bản */}
        <SectionHeader title="Thông tin cơ bản" />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Hãng xe" required hint="Ví dụ: Honda, Yamaha...">
              <FormTextInput
                placeholder="Honda"
                value={form.brand}
                onChangeText={(t) => setForm({ ...form, brand: t })}
                accessibilityLabel="Hãng xe"
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Model" required hint="Ví dụ: Vision, Exciter...">
              <FormTextInput
                placeholder="Vision"
                value={form.model}
                onChangeText={(t) => setForm({ ...form, model: t })}
                accessibilityLabel="Model xe"
              />
            </Field>
          </View>
        </View>

        <View className="mt-4">
          <Field label="Biển số" required hint="Ví dụ: 59-H1 234.56">
            <FormTextInput
              placeholder="59-H1 234.56"
              value={form.plate}
              onChangeText={(t) => setForm({ ...form, plate: t })}
              autoCapitalize="characters"
              accessibilityLabel="Biển số"
            />
          </Field>
        </View>

        <View className="mt-4">
          <Field
            label="Năm sản xuất"
            hint="Để trống sẽ dùng năm hiện tại"
            error={yearError}
          >
            <FormTextInput
              placeholder={currentYear.toString()}
              keyboardType="numeric"
              maxLength={4}
              value={form.year}
              onChangeText={(t) => setForm({ ...form, year: t.replace(/[^0-9]/g, '') })}
              accessibilityLabel="Năm sản xuất"
              error={!!yearError}
            />
          </Field>
        </View>

        {/* =========================================================
            Hồ sơ xe đầy đủ (gói VIP)
            ========================================================= */}
        <View className="mt-7">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-foreground">Hồ sơ xe đầy đủ</Text>
              <Badge tone="amber">VIP</Badge>
            </View>
          </View>

          {!vipActive && (
            <View className="mb-3">
              <Banner
                tone="info"
                title="Cần gói VIP để thêm hoặc sửa"
                description={
                  originalDetails && Object.keys(originalDetails).length > 0
                    ? 'Thông tin đã lưu vẫn hiển thị bên dưới và bạn có thể xoá. Nâng cấp VIP để thêm hoặc sửa.'
                    : 'Nâng cấp VIP để lưu số khung, số máy, ngày mua, giá mua, bảo hành và bảo hiểm của xe.'
                }
              />
              <View className="mt-2">
                <ActionButton
                  fullWidth
                  variant="outline"
                  onPress={() => router.push('/rider/plans')}
                  accessibilityLabel="Nâng cấp lên gói VIP"
                >
                  <Sparkles size={16} color="#16202f" />
                  <Text className="text-sm font-semibold text-foreground">
                    Nâng cấp lên VIP
                  </Text>
                </ActionButton>
              </View>
            </View>
          )}

          {VEHICLE_DETAIL_FIELDS.map((field) => {
            const value = detailsForm[field.key] ?? '';
            const hasStoredValue = !!(originalDetails && originalDetails[field.key]);
            // Không có VIP → chỉ ĐỌC + XOÁ được (D14); không sửa/đặt giá trị mới.
            const inputDisabled = !vipActive;
            const canDelete = !vipActive && hasStoredValue;

            return (
              <View key={field.key} className="mt-3">
                <Field
                  label={field.label}
                  hint={
                    !vipActive && hasStoredValue
                      ? 'Chỉ xoá được khi chưa có gói VIP.'
                      : field.kind === 'number'
                        ? 'Nhập số (không dấu phẩy)'
                        : undefined
                  }
                >
                  {field.kind === 'date' ? (
                    <DateTimePickerField
                      mode="date"
                      value={value ? new Date(`${value}T00:00:00`) : null}
                      onChange={(d) => setDetail(field.key, dateToIsoDate(d))}
                      maximumDate={new Date()}
                      placeholder="Chọn ngày"
                      accessibilityLabel={field.label}
                      disabled={inputDisabled}
                    />
                  ) : (
                    <FormTextInput
                      placeholder={field.placeholder}
                      keyboardType={field.kind === 'number' ? 'numeric' : 'default'}
                      maxLength={field.maxLength}
                      editable={!inputDisabled}
                      value={value}
                      onChangeText={(t) => setDetail(field.key, t)}
                      accessibilityLabel={field.label}
                      className={inputDisabled ? 'opacity-50' : undefined}
                    />
                  )}
                  {canDelete ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xoá ${field.label}`}
                      onPress={() => setDetail(field.key, '')}
                      className="mt-1 self-start rounded-lg px-2 py-1 active:opacity-70"
                    >
                      <Text className="text-xs font-semibold text-destructive">
                        Xoá thông tin này
                      </Text>
                    </Pressable>
                  ) : null}
                </Field>
              </View>
            );
          })}
        </View>

        {error && (
          <View className="mt-4">
            <Banner tone="error" description={error} />
          </View>
        )}

        <ActionButton
          fullWidth
          className="mt-6 py-4"
          disabled={!valid || submitting}
          onPress={handleSubmit}
          accessibilityLabel={existing ? 'Lưu thay đổi' : 'Thêm xe'}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Check size={18} color="#ffffff" />
          )}
          <Text className="text-base font-semibold text-primary-foreground">
            {submitting
              ? existing
                ? 'Đang lưu...'
                : 'Đang thêm...'
              : existing
                ? 'Lưu thay đổi'
                : 'Thêm xe'}
          </Text>
        </ActionButton>

        <Text className="mt-3 text-center text-xs text-muted-foreground">
          Dữ liệu xe được đồng bộ với máy chủ khi đã tích hợp backend. Trong demo mode lưu cục bộ.
        </Text>
      </ScreenScroll>
    </SafeAreaView>
  );
}
