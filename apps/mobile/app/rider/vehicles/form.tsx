import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput, SectionHeader } from '@/components/ui/form';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { ApiError } from '@/lib/api';

/**
 * VehicleFormScreen - thêm mới / chỉnh sửa thông tin xe.
 *
 * - Create: gửi POST /api/v1/motorcycles qua AppContext.addVehicle().
 * - Update: gửi PATCH /api/v1/motorcycles/[id] qua AppContext.updateVehicle().
 * - Demo mode: lưu local không qua API.
 *
 * UI validation client-side giữ cho UX nhất quán với form cũ.
 */
export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { vehicles, addVehicle, updateVehicle } = useApp();
  const existing = id ? vehicles.find((v) => v.id === id) : undefined;

  const [form, setForm] = useState({
    brand: existing?.brand ?? '',
    model: existing?.name.replace(existing?.brand ?? '', '').trim() ?? '',
    plate: existing?.plate ?? '',
    year: existing?.year?.toString() ?? '',
    notes: '',
  });
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

  const handleSubmit = async () => {
    if (!valid) {
      if (yearError) {
        setError(yearError);
        return;
      }
      setError('Vui lòng nhập đầy đủ hãng, model và biển số');
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
        // Local update for mileage/color/maintenance (backend chưa lưu các field này).
        const result = await updateVehicle({
          ...existing,
          brand: payload.brand,
          name: `${payload.brand} ${payload.model}`,
          plate: payload.plate,
          year: payload.year ?? existing.year,
        });
        if (!result) throw new Error('Không thể cập nhật xe');
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

