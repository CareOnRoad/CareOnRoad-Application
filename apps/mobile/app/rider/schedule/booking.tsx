import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarCheck, CircleDot, Disc, Droplet, LucideIcon, Wrench } from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { Field, FormTextInput } from '@/components/ui/form';
import { formatVND, serviceTypes, timeSlots } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

const serviceIcons: Record<string, LucideIcon> = {
  oil: Droplet,
  brake: Disc,
  tire: CircleDot,
  general: Wrench,
};

/**
 * BookingScreen - đặt lịch bảo dưỡng (4 bước).
 *
 * Form flow:
 *  1. Chọn xe
 *  2. Chọn dịch vụ (icon + giá + thời lượng)
 *  3. Nhập ngày (YYYY-MM-DD)
 *  4. Chọn giờ (chip grid)
 *
 * Validation client-side: tất cả trường phải được điền.
 */
export default function BookingScreen() {
  const { vehicles, addAppointment } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [service, setService] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedService = serviceTypes.find((s) => s.id === service);
  const valid = vehicleId && service && date && time;

  const submit = () => {
    if (!valid) {
      setError('Vui lòng điền đầy đủ các trường để tiếp tục.');
      return;
    }
    setError(null);
    setSubmitting(true);
    setTimeout(() => {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      const appt = addAppointment({
        vehicleId,
        vehicleName: vehicle?.name ?? 'Vehicle',
        service: selectedService?.label ?? 'Service',
        date,
        time: time!,
        status: 'confirmed',
      });
      setSubmitting(false);
      router.replace({ pathname: '/rider/schedule/confirmed', params: { id: appt.id } });
    }, 600);
  };

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Đặt lịch bảo dưỡng" subtitle="Chọn xe và dịch vụ bên dưới" onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Vehicle */}
        <SectionLabel>Bước 1 · Chọn xe</SectionLabel>
        {vehicles.length === 0 ? (
          <Banner
            tone="warning"
            title="Chưa có xe nào"
            description="Vui lòng thêm xe trước khi đặt lịch."
          />
        ) : (
          <View className="mt-3 gap-2">
            {vehicles.map((v) => {
              const selected = vehicleId === v.id;
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Chọn xe ${v.name}`}
                  onPress={() => setVehicleId(v.id)}
                  className={cn(
                    'flex-row items-center gap-3 rounded-2xl border p-3 active:scale-[0.99]',
                    selected ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  )}
                >
                  <View
                    className={cn(
                      'size-9 items-center justify-center rounded-xl',
                      selected ? 'bg-primary' : 'bg-secondary',
                    )}
                  >
                    <Wrench size={16} color={selected ? '#ffffff' : '#16202f'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{v.name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {v.plate} · {v.brand}
                    </Text>
                  </View>
                  {selected && (
                    <View className="size-5 items-center justify-center rounded-full bg-primary">
                      <Text className="text-[10px] font-bold text-white">✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Step 2: Service */}
        <SectionLabel className="mt-6">Bước 2 · Chọn dịch vụ</SectionLabel>
        <View className="mt-3 flex-row flex-wrap gap-3">
          {serviceTypes.map((s) => {
            const Icon = serviceIcons[s.id];
            const selected = service === s.id;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Chọn dịch vụ ${s.label}`}
                onPress={() => setService(s.id)}
                className={cn(
                  'w-[48%] rounded-2xl border p-4 active:scale-[0.97]',
                  selected ? 'border-primary bg-primary/5' : 'border-border bg-card',
                )}
              >
                <View
                  className={cn(
                    'mb-2 size-10 items-center justify-center rounded-xl',
                    selected ? 'bg-primary' : 'bg-secondary',
                  )}
                >
                  <Icon size={20} color={selected ? '#ffffff' : '#16202f'} />
                </View>
                <Text className="text-sm font-semibold leading-tight text-foreground">
                  {s.label}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  {formatVND(s.price)} · {s.duration}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Step 3: Date */}
        <SectionLabel className="mt-6">Bước 3 · Chọn ngày</SectionLabel>
        <View className="mt-3">
          <Field label="Ngày bảo dưỡng" hint="Định dạng YYYY-MM-DD, ví dụ: 2026-10-15" required>
            <FormTextInput
              placeholder="2026-10-15"
              value={date}
              onChangeText={setDate}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Ngày bảo dưỡng"
            />
          </Field>
        </View>

        {/* Step 4: Time */}
        <SectionLabel className="mt-6">Bước 4 · Chọn giờ</SectionLabel>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {timeSlots.map((t) => {
            const selected = time === t;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Chọn giờ ${t}`}
                onPress={() => setTime(t)}
                className={cn(
                  'min-w-[80px] rounded-xl border px-4 py-2.5 active:scale-95',
                  selected ? 'border-primary bg-primary' : 'border-border bg-card',
                )}
              >
                <Text
                  className={cn(
                    'text-center text-sm font-semibold',
                    selected ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Summary */}
        {selectedVehicle && selectedService && (
          <Card className="mt-6 border-primary/30 bg-primary/5 p-4">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
              Tóm tắt
            </Text>
            <RowLine label="Xe" value={`${selectedVehicle.name} · ${selectedVehicle.plate}`} />
            <RowLine label="Dịch vụ" value={selectedService.label} />
            <RowLine label="Chi phí" value={formatVND(selectedService.price)} />
            {date && <RowLine label="Ngày" value={date} />}
            {time && <RowLine label="Giờ" value={time} />}
          </Card>
        )}

        {error && (
          <View className="mt-4">
            <Banner tone="error" description={error} />
          </View>
        )}

        <ActionButton
          fullWidth
          className="mt-6 py-4"
          disabled={!valid || submitting}
          onPress={submit}
          accessibilityLabel="Xác nhận đặt lịch"
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <CalendarCheck size={20} color="#ffffff" />
          )}
          <Text className="text-base font-semibold text-primary-foreground">
            {submitting ? 'Đang đặt lịch…' : 'Xác nhận đặt lịch'}
          </Text>
        </ActionButton>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={`text-xs font-bold uppercase tracking-wider text-muted-foreground ${className ?? ''}`}>
      {children}
    </Text>
  );
}

function RowLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
