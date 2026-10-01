import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
import { Field, FormTextInput, SectionHeader } from '@/components/ui/form';
import {
  DateTimePickerField,
  combineDateTime,
  dateToIsoDate,
  dateToIsoTime,
} from '@/components/ui/datetime-picker-field';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { formatVND, isPastDateTime } from '@/lib/format';
import { serviceTypes } from '@/lib/ui-catalog';
import { cn } from '@/lib/utils';
import { createServiceRequest } from '@/lib/service-requests-service';
import {
  createReminder,
  type ReminderRecurrence,
} from '@/lib/reminders-service';

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

/** Khung giờ gợi ý nhanh cho maintenance. */
const QUICK_TIME_PRESETS: { label: string; hour: number; minute: number }[] = [
  { label: 'Sáng', hour: 7, minute: 0 },
  { label: 'Trưa', hour: 12, minute: 0 },
  { label: 'Chiều', hour: 17, minute: 0 },
  { label: 'Tối', hour: 19, minute: 0 },
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
 *    3. Chọn ngày (DateTimePickerField)
 *    4. Chọn giờ (DateTimePickerField + chip gợi ý)
 *  Reminder (3 bước):
 *    1. Tiêu đề + mô tả
 *    2. Ngày/giờ (2 picker)
 *    3. Tần suất lặp lại
 *
 * Validation client-side: tất cả trường phải được điền + không cho phép ngày/giờ trong quá khứ.
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
  const [maintenanceDate, setMaintenanceDate] = useState<Date | null>(null);
  const [maintenanceTime, setMaintenanceTime] = useState<Date | null>(null);

  // Reminder fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reminderDate, setReminderDate] = useState<Date | null>(null);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('none');
  const [reminderVehicleId, setReminderVehicleId] = useState<string>(vehicles[0]?.id ?? '');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const maintenanceIsoDate = dateToIsoDate(maintenanceDate);
  const maintenanceIsoTime = dateToIsoTime(maintenanceTime);
  const reminderIsoDate = dateToIsoDate(reminderDate);
  const reminderIsoTime = dateToIsoTime(reminderTime);

  const maintenanceScheduledAt = combineDateTime(maintenanceIsoDate, maintenanceIsoTime);
  const reminderScheduledAt = combineDateTime(reminderIsoDate, reminderIsoTime);

  const maintenancePast = maintenanceScheduledAt
    ? isPastDateTime(maintenanceScheduledAt)
    : false;
  const reminderPast = reminderScheduledAt
    ? isPastDateTime(reminderScheduledAt)
    : false;

  const selectedService = serviceTypes.find((s) => s.id === service);
  const maintenanceValid =
    !!vehicleId && !!service && !!maintenanceIsoDate && !!maintenanceIsoTime && !maintenancePast;
  const reminderValid =
    !!title.trim() &&
    !!reminderIsoDate &&
    !!reminderIsoTime &&
    !!reminderVehicleId &&
    !reminderPast;

  const submit = async () => {
    setError(null);

    if (mode === 'maintenance') {
      if (!maintenanceScheduledAt) {
        setError('Vui lòng chọn ngày và giờ bảo dưỡng.');
        return;
      }
      if (maintenancePast) {
        setError('Ngày giờ đã qua. Vui lòng chọn lại.');
        return;
      }
      if (!vehicleId || !service) {
        setError('Vui lòng điền đầy đủ các trường để tiếp tục.');
        return;
      }
      setSubmitting(true);
      try {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        const scheduledAt = `${maintenanceIsoDate}T${maintenanceIsoTime}:00+07:00`;
        // BE: `periodic_maintenance` thuộc nhóm fixed-mode (chỉ `other` mới nhận
        // `fulfillment_mode`). Lịch hẹn được xác định bằng `scheduled_start_at`.
        // Gửi `fulfillment_mode` sẽ bị BE trả 400 INVALID_INPUT.
        const created = await createServiceRequest({
          motorcycle_id: vehicleId,
          service_type: 'periodic_maintenance',
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
    if (!reminderScheduledAt) {
      setError('Vui lòng chọn ngày và giờ nhắc nhở.');
      return;
    }
    if (reminderPast) {
      setError('Ngày giờ nhắc nhở đã qua. Vui lòng chọn lại.');
      return;
    }
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề nhắc nhở.');
      return;
    }
    if (!reminderVehicleId) {
      setError('Vui lòng chọn xe cho nhắc nhở.');
      return;
    }
    setSubmitting(true);
    try {
      const scheduledAt = `${reminderIsoDate}T${reminderIsoTime}:00+07:00`;
      const payload: Parameters<typeof createReminder>[0] = {
        motorcycle_id: reminderVehicleId,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        recurrence,
        next_due_at: scheduledAt,
      };
      await createReminder(payload);
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
      <ScreenScroll>
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
            date={maintenanceDate}
            onChangeDate={setMaintenanceDate}
            time={maintenanceTime}
            onChangeTime={setMaintenanceTime}
            today={today}
            dateError={maintenancePast}
          />
        ) : (
          <>
            {vehicles.length === 0 && (
              <View className="mt-3">
                <Banner
                  tone="warning"
                  title="Chưa có xe nào"
                  description="Vui lòng thêm xe trước khi tạo nhắc nhở."
                />
              </View>
            )}
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
              today={today}
              dateError={reminderPast}
            />
          </>
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
            {maintenanceIsoDate && <RowLine label="Ngày" value={maintenanceIsoDate} />}
            {maintenanceIsoTime && <RowLine label="Giờ" value={maintenanceIsoTime} />}
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
      </ScreenScroll>
    </SafeAreaView>
  );
}

function ModeTab({
  id: _id,
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
  onChangeTime,
  today,
  dateError,
}: {
  vehicles: ReturnType<typeof useApp>['vehicles'];
  vehicleId: string;
  onSelectVehicle: (id: string) => void;
  service: string | null;
  onSelectService: (id: string | null) => void;
  date: Date | null;
  onChangeDate: (d: Date) => void;
  time: Date | null;
  onChangeTime: (d: Date) => void;
  today: Date;
  dateError: boolean;
}) {
  return (
    <>
      <SectionHeader title="Bước 1 · Chọn xe" />
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

      <SectionHeader className="mt-6" title="Bước 2 · Chọn dịch vụ" />
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

      <SectionHeader className="mt-6" title="Bước 3 · Chọn ngày" />
      <View className="mt-3">
        <Field
          label="Ngày bảo dưỡng"
          hint="Chọn ngày trong tương lai"
          error={dateError ? 'Ngày giờ đã qua, vui lòng chọn lại.' : undefined}
          required
        >
          <DateTimePickerField
            mode="date"
            value={date}
            onChange={onChangeDate}
            minimumDate={today}
            placeholder="Chọn ngày (dd/mm/yyyy)"
            error={dateError}
            accessibilityLabel="Ngày bảo dưỡng"
          />
        </Field>
      </View>

      <SectionHeader className="mt-6" title="Bước 4 · Chọn giờ" />
      <View className="mt-3 gap-3">
        <Field
          label="Giờ bảo dưỡng"
          hint="Hoặc chọn nhanh khung giờ phổ biến bên dưới"
          required
        >
          <DateTimePickerField
            mode="time"
            value={time}
            onChange={onChangeTime}
            placeholder="Chọn giờ (HH:mm)"
            minuteInterval={15}
            accessibilityLabel="Giờ bảo dưỡng"
          />
        </Field>
        <View className="flex-row flex-wrap gap-2">
          {QUICK_TIME_PRESETS.map((preset) => {
            const active =
              !!time &&
              time.getHours() === preset.hour &&
              time.getMinutes() === preset.minute;
            return (
              <Pressable
                key={preset.label}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Chọn nhanh khung giờ ${preset.label}`}
                onPress={() => {
                  const t = new Date();
                  t.setHours(preset.hour, preset.minute, 0, 0);
                  onChangeTime(t);
                }}
                className={cn(
                  'min-w-[80px] rounded-xl border px-4 py-2.5 active:scale-95',
                  active ? 'border-primary bg-primary' : 'border-border bg-card',
                )}
              >
                <Text
                  className={cn(
                    'text-center text-sm font-semibold',
                    active ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
  today,
  dateError,
}: {
  vehicles: ReturnType<typeof useApp>['vehicles'];
  title: string;
  onChangeTitle: (v: string) => void;
  description: string;
  onChangeDescription: (v: string) => void;
  date: Date | null;
  onChangeDate: (d: Date) => void;
  time: Date | null;
  onChangeTime: (d: Date) => void;
  recurrence: ReminderRecurrence;
  onSelectRecurrence: (r: ReminderRecurrence) => void;
  vehicleId: string;
  onSelectVehicle: (id: string) => void;
  today: Date;
  dateError: boolean;
}) {
  return (
    <>
      <SectionHeader title="Bước 1 · Tiêu đề & mô tả" />
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
          <Field label="Gắn với xe" required>
            <View className="flex-row flex-wrap gap-2">
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

      <SectionHeader className="mt-6" title="Bước 2 · Thời gian" />
      <View className="mt-3 gap-3">
        <Field
          label="Ngày"
          hint="Chọn ngày trong tương lai"
          error={dateError ? 'Ngày giờ đã qua, vui lòng chọn lại.' : undefined}
          required
        >
          <DateTimePickerField
            mode="date"
            value={date}
            onChange={onChangeDate}
            minimumDate={today}
            placeholder="Chọn ngày (dd/mm/yyyy)"
            error={dateError}
            accessibilityLabel="Ngày nhắc nhở"
          />
        </Field>
        <Field label="Giờ" required>
          <DateTimePickerField
            mode="time"
            value={time}
            onChange={onChangeTime}
            placeholder="Chọn giờ (HH:mm)"
            minuteInterval={15}
            accessibilityLabel="Giờ nhắc nhở"
          />
        </Field>
      </View>

      <SectionHeader className="mt-6" title="Bước 3 · Lặp lại" />
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

function RowLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
