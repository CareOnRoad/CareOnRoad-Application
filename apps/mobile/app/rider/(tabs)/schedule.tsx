import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  Check,
  LucideIcon,
  Plus,
  Wrench,
  XCircle,
  FileText,
  Pause,
  Play,
} from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { useServiceRequests } from '@/hooks/use-service-requests';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { BookingCard } from '@/components/booking-card';
import { CancelAppointmentModal } from '@/components/cancel-appointment-modal';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatVND } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { updateReminder } from '@/lib/reminders-service';
import type { Appointment } from '@/lib/types';
import {
  listReminders,
  recurrenceLabel,
  type Reminder,
  type ReminderRecurrence,
} from '@/lib/reminders-service';

type HistoryTab = 'maintenance' | 'reminders' | 'emergency';
type MaintenanceFilter = 'upcoming' | 'canceled' | 'completed';

/**
 * ScheduleScreen - đặt lịch bảo dưỡng + xem lịch sử + reminders.
 *
 * Layout 2 cấp:
 *  - Cấp 1: tab Maintenance / Reminders / Emergency với badge count.
 *  - Cấp 2 (chỉ Maintenance): filter Upcoming / Canceled / Completed.
 *  - Tab Reminders: list reminders BE (active/snoozed/disabled) + nút tạo mới.
 *
 * Mỗi filter có EmptyState riêng để hướng dẫn user.
 */
export default function ScheduleScreen() {
  const {
    appointments,
    canceledAppointments,
    emergencyCalls,
    services,
    cancelAppointment,
  } = useApp();
  const sr = useServiceRequests();
  const [tab, setTab] = useState<HistoryTab>('maintenance');
  const [maintenanceFilter, setMaintenanceFilter] = useState<MaintenanceFilter>('upcoming');
  const [cancelling, setCancelling] = useState<Appointment | null>(null);

  // Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);

  const reloadReminders = async () => {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const items = await listReminders();
      setReminders(items);
    } catch (e) {
      setRemindersError(e instanceof Error ? e.message : 'Không thể tải nhắc nhở');
    } finally {
      setRemindersLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'reminders') {
      void reloadReminders();
    }
    if (tab === 'maintenance') {
      void sr.reloadList();
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const completedCount = services.length;
  const activeReminders = reminders.filter((r) => r.status === 'active' || r.status === 'snoozed');
  const totalMaintenance = appointments.length + canceledAppointments.length;
  const totalEmergency = emergencyCalls.length;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Đặt lịch & Lịch sử" subtitle="Quản lý lịch bảo dưỡng và cứu hộ" />

      {/* Tab chính */}
      <View className="px-5 pb-3 pt-1">
        <View className="flex-row gap-2 rounded-2xl border border-border bg-secondary/40 p-1">
          <TabButton
            active={tab === 'maintenance'}
            icon={CalendarClock}
            label="Bảo dưỡng"
            count={totalMaintenance}
            tone="primary"
            onPress={() => setTab('maintenance')}
          />
          <TabButton
            active={tab === 'reminders'}
            icon={AlarmClock}
            label="Nhắc nhở"
            count={activeReminders.length}
            tone="primary"
            onPress={() => setTab('reminders')}
          />
          <TabButton
            active={tab === 'emergency'}
            icon={Wrench}
            label="Cứu hộ"
            count={totalEmergency}
            tone="destructive"
            onPress={() => setTab('emergency')}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'maintenance' && (
          <>
            <ActionButton
              fullWidth
              className="mb-5 py-3"
              onPress={() => router.push('/rider/schedule/booking')}
              accessibilityLabel="Đặt lịch bảo dưỡng mới"
            >
              <CalendarCheck size={18} color="#ffffff" />
              <Text className="text-base font-semibold text-primary-foreground">Đặt lịch bảo dưỡng mới</Text>
            </ActionButton>

            {/* Filter cấp 2 */}
            <View className="mb-3 flex-row gap-2 rounded-2xl bg-secondary/40 p-1">
              {(
                [
                  { id: 'upcoming', label: 'Sắp tới', count: appointments.length },
                  { id: 'canceled', label: 'Đã huỷ', count: canceledAppointments.length },
                  { id: 'completed', label: 'Hoàn tất', count: completedCount },
                ] as { id: MaintenanceFilter; label: string; count: number }[]
              ).map((f) => {
                const active = maintenanceFilter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setMaintenanceFilter(f.id)}
                    className={cn(
                      'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 active:opacity-70',
                      active && 'bg-card shadow-sm',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        active ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {f.label}
                    </Text>
                    <View className={cn('rounded-full px-1.5', active ? 'bg-primary/10' : 'bg-muted')}>
                      <Text
                        className={cn(
                          'text-[10px] font-bold',
                          active ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {f.count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {maintenanceFilter === 'upcoming' && (
              <View className="gap-3">
                {appointments.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    tone="primary"
                    title="Chưa có lịch bảo dưỡng"
                    description="Đặt lịch bảo dưỡng và nó sẽ hiển thị tại đây."
                    action={
                      <ActionButton onPress={() => router.push('/rider/schedule/booking')}>
                        <CalendarCheck size={16} color="#ffffff" />
                        <Text className="text-sm font-semibold text-primary-foreground">Đặt lịch ngay</Text>
                      </ActionButton>
                    }
                  />
                ) : (
                  appointments.map((a) => (
                    <BookingCard key={a.id} appointment={a} onCancel={() => setCancelling(a)} />
                  ))
                )}
              </View>
            )}

            {maintenanceFilter === 'canceled' && (
              <View className="gap-3">
                {canceledAppointments.length === 0 ? (
                  <EmptyState
                    icon={XCircle}
                    title="Chưa có lịch bị huỷ"
                    description="Các lịch bị huỷ kèm lý do sẽ hiển thị tại đây."
                  />
                ) : (
                  canceledAppointments.map((c) => <CanceledBookingCard key={c.id} canceled={c} />)
                )}
              </View>
            )}

            {maintenanceFilter === 'completed' && (
              <View className="gap-3">
                {services.length === 0 ? (
                  <EmptyState
                    icon={Check}
                    tone="success"
                    title="Chưa có dịch vụ hoàn tất"
                    description="Các lần bảo dưỡng đã hoàn thành sẽ hiển thị tại đây."
                  />
                ) : (
                  services.map((s) => (
                    <Card key={s.id} className="p-4">
                      <View className="flex-row items-center gap-3">
                        <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                          <Wrench size={20} color="#1974f7" />
                        </View>
                        <View className="min-w-0 flex-1">
                          <View className="flex-row items-center justify-between gap-2">
                            <Text className="flex-1 truncate font-semibold leading-tight text-foreground">
                              {s.type}
                            </Text>
                            <Text className="shrink-0 text-sm font-bold text-foreground">
                              {formatVND(s.price)}
                            </Text>
                          </View>
                          <Text className="truncate text-xs text-muted-foreground">
                            {s.vehicleName} · {s.mechanic}
                          </Text>
                          <Text className="mt-1 text-xs text-muted-foreground">{s.date}</Text>
                        </View>
                      </View>
                      {s.notes && (
                        <View className="mt-2 rounded-xl bg-secondary px-3 py-2">
                          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                            {s.notes}
                          </Text>
                        </View>
                      )}
                    </Card>
                  ))
                )}
              </View>
            )}
          </>
        )}

        {tab === 'reminders' && (
          <View className="gap-3">
            <ActionButton
              fullWidth
              className="mb-3 py-3"
              onPress={() => router.push('/rider/schedule/booking')}
              accessibilityLabel="Tạo nhắc nhở mới"
            >
              <Plus size={18} color="#ffffff" />
              <Text className="text-base font-semibold text-primary-foreground">Tạo nhắc nhở mới</Text>
            </ActionButton>

            {remindersError && (
              <Banner tone="error" description={remindersError} />
            )}

            {remindersLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#1974f7" />
              </View>
            ) : reminders.length === 0 ? (
              <EmptyState
                icon={AlarmClock}
                tone="primary"
                title="Chưa có nhắc nhở"
                description="Tạo nhắc nhở để được thông báo khi đến hạn thay nhớt, kiểm tra lốp, bảo dưỡng định kỳ…"
                action={
                  <ActionButton onPress={() => router.push('/rider/schedule/booking')}>
                    <Plus size={16} color="#ffffff" />
                    <Text className="text-sm font-semibold text-primary-foreground">Tạo nhắc nhở</Text>
                  </ActionButton>
                }
              />
            ) : (
              reminders.map((r) => (
                <ReminderCard key={r.id} reminder={r} onChanged={reloadReminders} />
              ))
            )}
          </View>
        )}

        {tab === 'emergency' && (
          <View className="gap-3">
            {emergencyCalls.length === 0 ? (
              <EmptyState
                icon={Wrench}
                tone="destructive"
                title="Chưa có lịch sử cứu hộ"
                description="Các yêu cầu cứu hộ đã hoàn thành kèm chi tiết hư hại/sửa chữa sẽ hiển thị tại đây."
                action={
                  <ActionButton
                    variant="destructive"
                    onPress={() => router.push('/rider/(tabs)/rescue')}
                    accessibilityLabel="Yêu cầu cứu hộ ngay"
                  >
                    <Wrench size={16} color="#ffffff" />
                    <Text className="text-sm font-semibold text-destructive-foreground">Yêu cầu cứu hộ</Text>
                  </ActionButton>
                }
              />
            ) : (
              emergencyCalls.map((call) => <EmergencyHistoryCard key={call.id} call={call} />)
            )}
            <Card className="border-dashed bg-secondary/40 p-4">
              <Text className="text-center text-xs text-muted-foreground">
                Cần hỗ trợ khẩn cấp? Mở tab{' '}
                <Text className="font-semibold text-foreground">Cứu hộ</Text> để gửi yêu cầu.
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>

      <CancelAppointmentModal
        open={!!cancelling}
        appointmentLabel={
          cancelling
            ? `${cancelling.service} · ${cancelling.vehicleName} · ${cancelling.time}`
            : undefined
        }
        onClose={() => setCancelling(null)}
        onConfirm={(reason) => {
          if (cancelling) cancelAppointment(cancelling.id, reason);
          setCancelling(null);
        }}
      />
    </View>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  count,
  tone,
  onPress,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  count: number;
  tone: 'primary' | 'destructive';
  onPress: () => void;
}) {
  const activeColor = tone === 'primary' ? '#1974f7' : '#ed3f3a';
  const inactiveColor = '#64748b';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 active:scale-[0.97]',
        active && 'bg-card shadow-sm',
      )}
    >
      <Icon size={16} color={active ? activeColor : inactiveColor} />
      <Text
        className={cn(
          'text-sm font-semibold',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
      <View
        className={cn(
          'rounded-full px-1.5 py-0.5',
          active ? (tone === 'primary' ? 'bg-primary/10' : 'bg-destructive/10') : 'bg-muted',
        )}
      >
        <Text
          className={cn(
            'text-[10px] font-bold',
            active
              ? tone === 'primary'
                ? 'text-primary'
                : 'text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function CanceledBookingCard({
  canceled,
}: {
  canceled: import('@/lib/types').CanceledAppointment;
}) {
  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center justify-between bg-destructive px-4 py-3">
        <View className="flex-row items-center gap-2">
          <XCircle size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-white">{canceled.service}</Text>
        </View>
        <View className="rounded-full bg-white/15 px-2.5 py-1">
          <Text className="text-xs font-semibold text-white">Đã huỷ</Text>
        </View>
      </View>
      <View className="flex-row gap-2 p-4">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <Wrench size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Xe</Text>
          </View>
          <Text className="text-sm font-semibold leading-tight text-foreground">
            {canceled.vehicleName}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <CalendarClock size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Ngày</Text>
          </View>
          <Text className="text-sm font-semibold text-foreground">
            {canceled.date} · {canceled.time}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <FileText size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Lý do</Text>
          </View>
          <Text className="text-xs font-medium text-foreground" numberOfLines={2}>
            {canceled.reason}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function EmergencyHistoryCard({ call }: { call: import('@/lib/types').EmergencyCall }) {
  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10">
          <Wrench size={20} color="#ed3f3a" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 truncate font-semibold leading-tight text-foreground">
              {call.issue}
            </Text>
            <Text className="shrink-0 text-sm font-bold text-foreground">{formatVND(call.price)}</Text>
          </View>
          <Text className="truncate text-xs text-muted-foreground">
            {call.vehicleName} · {call.mechanicName}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
              <CalendarClock size={12} color="#64748b" />
              <Text className="text-xs font-semibold text-secondary-foreground">
                {call.date} · {call.time}
              </Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-green/10 px-2.5 py-1">
              <Check size={12} color="#145413" />
              <Text className="text-xs font-semibold text-green">Hoàn tất</Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

function ReminderCard({
  reminder,
  onChanged,
}: {
  reminder: Reminder;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const togglePause = async () => {
    setBusy(true);
    try {
      await updateReminder(reminder.id, {
        status: reminder.status === 'disabled' ? 'active' : 'disabled',
      });
      await onChanged();
    } finally {
      setBusy(false);
    }
  };
  const fireDate = new Date(reminder.scheduled_at);
  return (
    <Card className="p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-sm font-bold text-foreground" numberOfLines={2}>
            {reminder.title}
          </Text>
          {reminder.description && (
            <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
              {reminder.description}
            </Text>
          )}
        </View>
        <Badge tone={reminder.status === 'active' ? 'blue' : reminder.status === 'snoozed' ? 'amber' : 'neutral'}>
          <Text className="text-xs font-semibold">
            {reminder.status === 'active'
              ? 'Đang bật'
              : reminder.status === 'snoozed'
                ? 'Tạm hoãn'
                : 'Tắt'}
          </Text>
        </Badge>
      </View>
      <View className="mt-2 flex-row items-center gap-2">
        <View className="flex-row items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
          <CalendarClock size={12} color="#64748b" />
          <Text className="text-xs font-semibold text-secondary-foreground">
            {fireDate.toLocaleDateString('vi-VN')} ·{' '}
            {fireDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1">
          <Text className="text-xs font-semibold text-primary">
            {recurrenceLabel(reminder.recurrence as ReminderRecurrence)}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row gap-2">
        <ActionButton
          variant="outline"
          fullWidth
          onPress={togglePause}
          disabled={busy}
          accessibilityLabel={reminder.status === 'disabled' ? 'Bật nhắc nhở' : 'Tắt nhắc nhở'}
        >
          {reminder.status === 'disabled' ? (
            <>
              <Play size={14} color="#16202f" />
              <Text className="text-sm font-semibold text-foreground">Bật</Text>
            </>
          ) : (
            <>
              <Pause size={14} color="#16202f" />
              <Text className="text-sm font-semibold text-foreground">Tắt</Text>
            </>
          )}
        </ActionButton>
      </View>
    </Card>
  );
}
