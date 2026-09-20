import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  AlarmClock,
  CalendarCheck,
  CircleDot,
  Disc,
  Droplet,
  LucideIcon,
  Wrench,
} from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { Field, FormTextInput } from '@/components/ui/form';
import { formatVND, serviceTypes, timeSlots } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { createServiceRequest } from '@/lib/service-requests-service';
import { createReminder, type ReminderRecurrence } from '@/lib/reminders-service';

const serviceIcons: Record<string, LucideIcon> = {
  oil: Droplet,
  brake: Disc,
  tire: CircleDot,
  general: Wrench,
};

const recurrenceOptions: { id: ReminderRecurrence; label: string }[] = [
  { id: 'none', label: 'Một lần' },
  { id: 'weekly', label: 'Mỗi tuần' },
  { id: 'monthly', label: 'Mỗi tháng' },
  { id: 'quarterly', label: 'Mỗi quý' },
];

type Mode = 'maintenance' | 'reminder';

/**
 * BookingScreen - đặt lịch bảo dưỡng hoặc tạo reminder.
 *
 * Form flow:
 *  - Tab đầu: chọn Maintenance (đặt lịch sửa chữa thật qua BE) hoặc Reminder (BE reminder).
 *  Maintenance (4 bước):
 *    1. Chọn xe
 *    2. Chọn dịch vụ (icon + giá + thời lượng)
 *    3. Nhập ngày (YYYY-MM-DD)
 *    4. Chọn giờ (chip grid)
 *  Reminder (3 bước):
 *    1. Tiêu đề + mô tả
 *    2. Ngày/giờ
 *    3. Tần suất lặp lại
 *
 * Validation client-side: tất cả trường phải được điền.
 * BE: maintenance → POST /api/v1/service-requests (periodic_maintenance, scheduled_visit).
 *      reminder   → POST /api/v1/reminders.
 */
export default function BookingScreen() {
  const { vehicles } = useApp();
  const [mode, setMode] = useState<Mode>('maintenance');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Maintenance fields
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [service, setService] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState<string | null>(null);

  // Reminder fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('none');
  const [reminderVehicleId, setReminderVehicleId] = useState<string | null>(null);

  const selectedService = serviceTypes.find((s) => s.id === service);
  const maintenanceValid = vehicleId && service && date && time;
  const reminderValid = title.trim() && reminderDate && reminderTime;

  const submit = async () => {
    setError(null);

    if (mode === 'maintenance') {
      if (!maintenanceValid) {
        setError('Vui lòng điền đầy đủ các trường để tiếp tục.');
        return;
      }
      setSubmitting(true);
      try {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        const scheduledAt = `${date}T${time}:00+07:00`;
        const created = await createServiceRequest({
          motorcycle_id: vehicleId,
          service_type: 'periodic_maintenance',
          fulfillment_mode: 'scheduled_visit',
          problem_description: `Đặt lịch bảo dưỡng ${selectedService?.label ?? ''} cho xe ${
            vehicle?.name ?? ''
          }`,
          scheduled_start_at: scheduledAt,
          ...(vehicle?.name ? { maintenance_notes: `Xe: ${vehicle.name}` } : {}),
        });
        router.replace({
          pathname: '/rider/schedule/confirmed',
          params: { id: created.id, code: created.request_code },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể đặt lịch');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Reminder
    if (!reminderValid) {
      setError('Vui lòng điền tiêu đề, ngày và giờ.');
      return;
    }
    setSubmitting(true);
    try {
      const scheduledAt = `${reminderDate}T${reminderTime}:00+07:00`;
      await createReminder({
        ...(reminderVehicleId ? { motorcycle_id: reminderVehicleId } : {}),
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        scheduled_at: scheduledAt,
        recurrence,
      });
      router.replace('/rider/(tabs)/schedule');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo nhắc nhở');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title="Đặt lịch & Nhắc nhở"
        subtitle="Chọn loại lịch muốn tạo"
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Mode selector */}
        <View className="mb-4 flex-row gap-2 rounded-2xl border border-border bg-secondary/40 p-1">
          <ModeTab
            id="maintenance"
            label="Bảo dưỡng"
            icon={Wrench}
            active={mode === 'maintenance'}
            onPress={() => setMode('maintenance')}
          />
          <ModeTab
            id="reminder"
            label="Nhắc nhở"
            icon={AlarmClock}
            active={mode === 'reminder'}
            onPress={() => setMode('reminder')}
          />
        </View>

        {mode === 'maintenance' ? (
          <MaintenanceForm
            vehicles={vehicles}
            vehicleId={vehicleId}
            onSelectVehicle={setVehicleId}
            service={service}
            onSelectService={setService}
            date={date}
            onChangeDate={setDate}
            time={time}
            onSelectTime={setTime}
          />
        ) : (
          <ReminderForm
            vehicles={vehicles}
            title={title}
            onChangeTitle={setTitle}
            description={description}
            onChangeDescription={setDescription}
            date={reminderDate}
            onChangeDate={setReminderDate}
            time={reminderTime}
            onChangeTime={setReminderTime}
            recurrence={recurrence}
            onSelectRecurrence={setRecurrence}
            vehicleId={reminderVehicleId}
            onSelectVehicle={setReminderVehicleId}
          />
        )}

        {/* Summary */}
        {mode === 'maintenance' && selectedVehicle && selectedService && (
          <Card className="mt-6 border-primary/30 bg-primary/5 p-4">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
              Tóm tắt
            </Text>
            <RowLine label="Xe" value={`${selectedVehicle.name} · ${selectedVehicle.plate}`} />
            <RowLine label="Dịch vụ" value={selectedService.label} />
            <RowLine label="Chi phí ước tính" value={formatVND(selectedService.price)} />
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
          disabled={(mode === 'maintenance' ? !maintenanceValid : !reminderValid) || submitting}
          onPress={submit}
          accessibilityLabel="Xác nhận"
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <CalendarCheck size={20} color="#ffffff" />
          )}
          <Text className="text-base font-semibold text-primary-foreground">
            {submitting
              ? mode === 'maintenance'
                ? 'Đang đặt lịch…'
                : 'Đang tạo nhắc nhở…'
              : mode === 'maintenance'
                ? 'Xác nhận đặt lịch'
                : 'Tạo nhắc nhở'}
          </Text>
        </ActionButton>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeTab({
  id,
  label,
  icon: Icon,
  active,
  onPress,
}: {
  id: Mode;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 active:scale-[0.97]',
        active && 'bg-card shadow-sm',
      )}
    >
      <Icon size={16} color={active ? '#1974f7' : '#64748b'} />
      <Text
        className={cn(
          'text-sm font-semibold',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MaintenanceForm({
  vehicles,
  vehicleId,
  onSelectVehicle,
  service,
  onSelectService,
  date,
  onChangeDate,
  time,
  onSelectTime,
}: {
  vehicles: ReturnType<typeof useApp>['vehicles'];
  vehicleId: string;
  onSelectVehicle: (id: string) => void;
  service: string | null;
  onSelectService: (id: string | null) => void;
  date: string;
  onChangeDate: (v: string) => void;
  time: string | null;
  onSelectTime: (v: string | null) => void;
}) {
  return (
    <>
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
                onPress={() => onSelectVehicle(v.id)}
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
              onPress={() => onSelectService(s.id)}
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

      <SectionLabel className="mt-6">Bước 3 · Chọn ngày</SectionLabel>
      <View className="mt-3">
        <Field label="Ngày bảo dưỡng" hint="Định dạng YYYY-MM-DD, ví dụ: 2026-10-15" required>
          <FormTextInput
            placeholder="2026-10-15"
            value={date}
            onChangeText={onChangeDate}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Ngày bảo dưỡng"
          />
        </Field>
      </View>

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
              onPress={() => onSelectTime(t)}
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
    </>
  );
}

function ReminderForm({
  vehicles,
  title,
  onChangeTitle,
  description,
  onChangeDescription,
  date,
  onChangeDate,
  time,
  onChangeTime,
  recurrence,
  onSelectRecurrence,
  vehicleId,
  onSelectVehicle,
}: {
  vehicles: ReturnType<typeof useApp>['vehicles'];
  title: string;
  onChangeTitle: (v: string) => void;
  description: string;
  onChangeDescription: (v: string) => void;
  date: string;
  onChangeDate: (v: string) => void;
  time: string;
  onChangeTime: (v: string) => void;
  recurrence: ReminderRecurrence;
  onSelectRecurrence: (r: ReminderRecurrence) => void;
  vehicleId: string | null;
  onSelectVehicle: (id: string | null) => void;
}) {
  return (
    <>
      <SectionLabel>Bước 1 · Tiêu đề & mô tả</SectionLabel>
      <View className="mt-3 gap-3">
        <Field label="Tiêu đề" required>
          <FormTextInput
            value={title}
            onChangeText={onChangeTitle}
            placeholder="Ví dụ: Thay nhớt xe Vision"
            accessibilityLabel="Tiêu đề nhắc nhở"
          />
        </Field>
        <Field label="Mô tả (không bắt buộc)">
          <FormTextInput
            value={description}
            onChangeText={onChangeDescription}
            placeholder="Chi tiết công việc cần làm..."
            multiline
            numberOfLines={3}
            className="min-h-[80px] py-2.5"
          />
        </Field>
        {vehicles.length > 0 && (
          <Field label="Gắn với xe (không bắt buộc)">
            <View className="flex-row flex-wrap gap-2">
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: vehicleId === null }}
                onPress={() => onSelectVehicle(null)}
                className={cn(
                  'rounded-xl border px-4 py-2.5 active:scale-95',
                  vehicleId === null ? 'border-primary bg-primary' : 'border-border bg-card',
                )}
              >
                <Text
                  className={cn(
                    'text-sm font-semibold',
                    vehicleId === null ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  Không gắn xe
                </Text>
              </Pressable>
              {vehicles.map((v) => {
                const selected = vehicleId === v.id;
                return (
                  <Pressable
                    key={v.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => onSelectVehicle(v.id)}
                    className={cn(
                      'rounded-xl border px-4 py-2.5 active:scale-95',
                      selected ? 'border-primary bg-primary' : 'border-border bg-card',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-sm font-semibold',
                        selected ? 'text-primary-foreground' : 'text-foreground',
                      )}
                    >
                      {v.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        )}
      </View>

      <SectionLabel className="mt-6">Bước 2 · Thời gian</SectionLabel>
      <View className="mt-3 gap-3">
        <Field label="Ngày" hint="YYYY-MM-DD, ví dụ: 2026-10-15" required>
          <FormTextInput
            value={date}
            onChangeText={onChangeDate}
            placeholder="2026-10-15"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Ngày nhắc nhở"
          />
        </Field>
        <Field label="Giờ" hint="HH:MM, ví dụ: 09:00" required>
          <FormTextInput
            value={time}
            onChangeText={onChangeTime}
            placeholder="09:00"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Giờ nhắc nhở"
          />
        </Field>
      </View>

      <SectionLabel className="mt-6">Bước 3 · Lặp lại</SectionLabel>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {recurrenceOptions.map((r) => {
          const selected = recurrence === r.id;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onSelectRecurrence(r.id)}
              className={cn(
                'rounded-xl border px-4 py-2.5 active:scale-95',
                selected ? 'border-primary bg-primary' : 'border-border bg-card',
              )}
            >
              <Text
                className={cn(
                  'text-sm font-semibold',
                  selected ? 'text-primary-foreground' : 'text-foreground',
                )}
              >
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
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
