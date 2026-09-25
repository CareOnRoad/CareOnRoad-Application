import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  AlarmClock,
  Bell,
  Bike,
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
import { CancelAppointmentModal } from '@/components/cancel-appointment-modal';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatVND } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { updateReminder, snoozeReminder } from '@/lib/reminders-service';
import type { Appointment, CanceledAppointment } from '@/lib/types';
import type { ServiceRequestResponse } from '@/lib/service-requests-service';
import {
  listReminders,
  recurrenceLabel,
  type Reminder,
  type ReminderRecurrence,
} from '@/lib/reminders-service';

type HistoryTab = 'maintenance' | 'reminders' | 'emergency';
type MaintenanceFilter = 'upcoming' | 'canceled' | 'completed';

const SERVICE_LABELS: Record<string, string> = {
  periodic_maintenance: 'Bảo dưỡng định kỳ',
  emergency_rescue: 'Cứu hộ khẩn cấp',
  mobile_repair: 'Sửa chữa lưu động',
  at_home_service: 'Dịch vụ tại nhà',
  other: 'Khác',
};

const UPCOMING_STATUSES = new Set([
  'submitted',
  'dispatching',
  'offered',
  'assigned',
  'mechanic_en_route',
  'in_service',
  'awaiting_quote_approval',
  'awaiting_payment',
]);

/**
 * Map BE ServiceRequestResponse → Appointment UI shape.
 * Dùng cho scheduled maintenance (periodic_maintenance + scheduled_visit).
 */
function requestToAppointment(
  req: ServiceRequestResponse,
  vehicleName: string,
): Appointment {
  const dt = req.scheduled_start_at ? new Date(req.scheduled_start_at) : new Date(req.created_at);
  const date = dt.toISOString().slice(0, 10);
  const time = dt.toTimeString().slice(0, 5);
  return {
    id: req.id,
    vehicleId: req.motorcycle_id,
    vehicleName,
    service: SERVICE_LABELS[req.service_type] ?? req.service_type,
    date,
    time,
    status: 'confirmed',
  };
}

function requestToCanceled(req: ServiceRequestResponse, vehicleName: string): CanceledAppointment {
  const dt = req.scheduled_start_at ? new Date(req.scheduled_start_at) : new Date(req.created_at);
  return {
    id: req.id,
    vehicleName,
    service: SERVICE_LABELS[req.service_type] ?? req.service_type,
    date: dt.toISOString().slice(0, 10),
    time: dt.toTimeString().slice(0, 5),
    canceledAt: req.updated_at,
    reason: req.canceled_reason ?? 'Không có lý do',
  };
}

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
  const { vehicles, canceledAppointments, emergencyCalls, services, cancelAppointmentLocal } =
    useApp();
  const sr = useServiceRequests();
  const [tab, setTab] = useState<HistoryTab>('maintenance');
  const [maintenanceFilter, setMaintenanceFilter] = useState<MaintenanceFilter>('upcoming');
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  // =========================================================
  // Maintenance từ BE: filter theo service_type === periodic_maintenance.
  // =========================================================
  const maintenanceFromBE = sr.list.filter(
    (r) => r.service_type === 'periodic_maintenance',
  );
  const vehicleNameById = useMemo(() => {
    const map = new Map<string, string>();
    vehicles.forEach((v) => map.set(v.id, v.name));
    return map;
  }, [vehicles]);

  const upcomingMaintenance: Appointment[] = maintenanceFromBE
    .filter((r) => UPCOMING_STATUSES.has(r.status))
    .map((r) => requestToAppointment(r, vehicleNameById.get(r.motorcycle_id) ?? 'Xe'))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  const canceledMaintenance: CanceledAppointment[] = [
    ...maintenanceFromBE
      .filter((r) => r.status === 'canceled')
      .map((r) => requestToCanceled(r, vehicleNameById.get(r.motorcycle_id) ?? 'Xe')),
    ...canceledAppointments,
  ];

  const completedCount = services.length + maintenanceFromBE.filter((r) => r.status === 'completed').length;
  const activeReminders = reminders.filter((r) => r.status === 'active' || r.status === 'snoozed');
  const totalMaintenance = upcomingMaintenance.length + canceledMaintenance.length;
  const totalEmergency = emergencyCalls.length;

  const handleCancelMaintenance = async (reason: string) => {
    if (!cancelling) return;
    setCancelError(null);
    try {
      await sr.cancelById(cancelling.id, reason);
      cancelAppointmentLocal(cancelling.id, reason);
      setCancelling(null);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Không thể huỷ lịch');
    }
  };

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
          />          <TabButton
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

            {sr.listError && (
              <View className="mb-3">
                <Banner
                  tone="error"
                  title="Không thể tải lịch bảo dưỡng"
                  description={sr.listError}
                />
              </View>
            )}

            {sr.listLoading && (
              <View className="items-center py-4">
                <ActivityIndicator color="#1974f7" />
              </View>
            )}

            {/* Filter cấp 2 */}
            <View className="mb-3 flex-row gap-2 rounded-2xl bg-secondary/40 p-1">
              {(
                [
                  { id: 'upcoming', label: 'Sắp tới', count: upcomingMaintenance.length },
                  { id: 'canceled', label: 'Đã huỷ', count: canceledMaintenance.length },
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
                {upcomingMaintenance.length === 0 ? (
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
                  upcomingMaintenance.map((a) => (
                    <UpcomingMaintenanceCard
                      key={a.id}
                      appointment={a}
                      onCancel={() => setCancelling(a)}
                    />
                  ))
                )}
              </View>
            )}

            {maintenanceFilter === 'canceled' && (
              <View className="gap-3">
                {canceledMaintenance.length === 0 ? (
                  <EmptyState
                    icon={XCircle}
                    title="Chưa có lịch bị huỷ"
                    description="Các lịch bị huỷ kèm lý do sẽ hiển thị tại đây."
                  />
                ) : (
                  canceledMaintenance.map((c) => <CanceledBookingCard key={c.id} canceled={c} />)
                )}
              </View>
            )}

            {maintenanceFilter === 'completed' && (
              <View className="gap-3">
                {services.length === 0 && maintenanceFromBE.filter((r) => r.status === 'completed').length === 0 ? (
                  <EmptyState
                    icon={Check}
                    tone="success"
                    title="Chưa có dịch vụ hoàn tất"
                    description="Các lần bảo dưỡng đã hoàn thành sẽ hiển thị tại đây."
                  />
                ) : (
                  <>
                    {maintenanceFromBE
                      .filter((r) => r.status === 'completed')
                      .map((r) => (
                        <CompletedMaintenanceCard
                          key={r.id}
                          request={r}
                          vehicleName={vehicleNameById.get(r.motorcycle_id) ?? 'Xe'}
                        />
                      ))}
                    {services.map((s) => (
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
                    ))}
                  </>
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
        onClose={() => {
          setCancelling(null);
          setCancelError(null);
        }}
        onConfirm={handleCancelMaintenance}
      />
      {cancelError && (
        <View className="px-5 pb-3">
          <Banner tone="error" description={cancelError} />
        </View>
      )}
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

function UpcomingMaintenanceCard({
  appointment,
  onCancel,
}: {
  appointment: Appointment;
  onCancel: () => void;
}) {
  const isUpcomingSoon = isWithinDays(appointment.date, 14);
  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center justify-between bg-navy px-4 py-3">
        <View className="flex-row items-center gap-2">
          <CalendarClock size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-white">{appointment.service}</Text>
        </View>
        <View className="rounded-full bg-white/15 px-2.5 py-1">
          <Text className="text-xs font-semibold text-white">
            {appointment.status === 'confirmed' ? 'Đã đặt' : 'Chờ xác nhận'}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2 p-4">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <Bike size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Xe</Text>
          </View>
          <Text className="text-sm font-semibold leading-tight text-foreground" numberOfLines={1}>
            {appointment.vehicleName}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <CalendarClock size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Ngày</Text>
          </View>
          <Text className="text-sm font-semibold text-foreground">
            {appointment.date} · {appointment.time}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <FileText size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Trạng thái</Text>
          </View>
          <Text
            className={cn(
              'text-xs font-semibold',
              isUpcomingSoon ? 'text-amber-600' : 'text-foreground',
            )}
          >
            {isUpcomingSoon ? 'Sắp đến hạn' : 'Đang chờ'}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2 border-t border-border px-4 py-3">
        <ActionButton
          variant="destructive"
          fullWidth
          onPress={onCancel}
          accessibilityLabel="Huỷ lịch bảo dưỡng"
        >
          <XCircle size={16} color="#ffffff" />
          <Text className="text-xs font-semibold text-destructive-foreground">Huỷ lịch</Text>
        </ActionButton>
      </View>
    </Card>
  );
}

function CompletedMaintenanceCard({
  request,
  vehicleName,
}: {
  request: ServiceRequestResponse;
  vehicleName: string;
}) {
  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Wrench size={20} color="#1974f7" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 truncate font-semibold leading-tight text-foreground">
              {SERVICE_LABELS[request.service_type] ?? request.service_type}
            </Text>
            <Badge tone="green">
              <Text className="text-xs font-semibold text-green">Hoàn tất</Text>
            </Badge>
          </View>
          <Text className="truncate text-xs text-muted-foreground">
            {request.request_code} · {vehicleName}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
              <CalendarClock size={12} color="#64748b" />
              <Text className="text-xs font-semibold text-secondary-foreground">
                {new Date(request.created_at).toLocaleDateString('vi-VN')}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {request.problem_description && (
        <View className="mt-2 rounded-xl bg-secondary px-3 py-2">
          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
            {request.problem_description}
          </Text>
        </View>
      )}
    </Card>
  );
}

function isWithinDays(isoDate: string, days: number): boolean {
  const target = new Date(isoDate).getTime();
  const today = Date.now();
  const diffDays = (target - today) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
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
  /**
   * Mở Alert chọn 1 trong 4 mốc: 15 phút / 1 giờ / tới sáng / 1 ngày.
   * BE nhận ISO datetime, mình set offset tương ứng từ now().
   */
  const handleSnooze = () => {
    const options: { label: string; ms: number }[] = [
      { label: '15 phút', ms: 15 * 60 * 1000 },
      { label: '1 giờ', ms: 60 * 60 * 1000 },
      { label: 'Tới sáng mai (08:00)', ms: 0 }, // calculated dynamically
      { label: '1 ngày', ms: 24 * 60 * 60 * 1000 },
    ];
    Alert.alert(
      'Tạm hoãn nhắc nhở',
      'Chọn khoảng thời gian bạn muốn nhắc lại:',
      [
        ...options.map((opt) => {
          const until = new Date(
            opt.ms === 0
              ? (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(8, 0, 0, 0);
                  return d.getTime();
                })()
              : Date.now() + opt.ms,
          );
          const labelWithTime = `${opt.label} (${until.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })})`;
          return {
            text: labelWithTime,
            onPress: async () => {
              setBusy(true);
              try {
                await snoozeReminder(reminder.id, until.toISOString());
                await onChanged();
              } finally {
                setBusy(false);
              }
            },
          } as const;
        }),
        {
          text: 'Huỷ',
          style: 'cancel' as const,
        },
      ],
    );
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
        {reminder.status !== 'disabled' && (
          <ActionButton
            variant="secondary"
            fullWidth
            onPress={handleSnooze}
            disabled={busy}
            accessibilityLabel="Tạm hoãn nhắc nhở"
          >
            <Bell size={14} color="#16202f" />
            <Text className="text-sm font-semibold text-foreground">Snooze</Text>
          </ActionButton>
        )}
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
