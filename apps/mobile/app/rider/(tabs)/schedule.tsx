import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  CalendarCheck,
  CalendarClock,
  Check,
  Droplet,
  Disc,
  CircleDot,
  LucideIcon,
  Wrench,
  XCircle,
  FileText,
} from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { BookingCard } from '@/components/booking-card';
import { CancelAppointmentModal } from '@/components/cancel-appointment-modal';
import { Card } from '@/components/ui/card';
import { formatVND, serviceTypes, timeSlots } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/lib/types';

const serviceIcons: Record<string, LucideIcon> = {
  oil: Droplet,
  brake: Disc,
  tire: CircleDot,
  general: Wrench,
};

type HistoryTab = 'maintenance' | 'emergency';
type MaintenanceFilter = 'upcoming' | 'canceled' | 'completed';

export default function ScheduleScreen() {
  const {
    appointments,
    canceledAppointments,
    emergencyCalls,
    services,
    cancelAppointment,
  } = useApp();
  const [tab, setTab] = useState<HistoryTab>('maintenance');
  const [maintenanceFilter, setMaintenanceFilter] = useState<MaintenanceFilter>('upcoming');
  const [cancelling, setCancelling] = useState<Appointment | null>(null);

  const completedCount = services.length;
  const totalMaintenance = appointments.length + canceledAppointments.length;
  const totalEmergency = emergencyCalls.length;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Booking & History" subtitle="Schedule and review your services" />
      <View className="px-5 pb-3 pt-1">
        <View className="flex-row gap-2 rounded-2xl border border-border bg-secondary/40 p-1">
          <Pressable
            onPress={() => setTab('maintenance')}
            className={cn(
              'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 active:scale-[0.97]',
              tab === 'maintenance' ? 'bg-card shadow-sm' : '',
            )}
          >
            <CalendarClock size={16} color={tab === 'maintenance' ? '#16202f' : '#64748b'} />
            <Text
              className={cn(
                'text-sm font-semibold',
                tab === 'maintenance' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              Maintenance
            </Text>
            <View
              className={cn(
                'rounded-full px-1.5 py-0.5',
                tab === 'maintenance' ? 'bg-primary/10' : 'bg-muted',
              )}
            >
              <Text
                className={cn(
                  'text-[10px] font-bold',
                  tab === 'maintenance' ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {totalMaintenance}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setTab('emergency')}
            className={cn(
              'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 active:scale-[0.97]',
              tab === 'emergency' ? 'bg-card shadow-sm' : '',
            )}
          >
            <Wrench size={16} color={tab === 'emergency' ? '#16202f' : '#64748b'} />
            <Text
              className={cn(
                'text-sm font-semibold',
                tab === 'emergency' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              Emergency
            </Text>
            <View
              className={cn(
                'rounded-full px-1.5 py-0.5',
                tab === 'emergency' ? 'bg-destructive/10' : 'bg-muted',
              )}
            >
              <Text
                className={cn(
                  'text-[10px] font-bold',
                  tab === 'emergency' ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {totalEmergency}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      >
        {tab === 'maintenance' && (
          <ActionButton fullWidth className="mb-5 py-3" onPress={() => router.push('/rider/schedule/booking')}>
            <CalendarCheck size={16} color="#ffffff" />
            <Text className="text-sm font-semibold text-primary-foreground">
              Book new maintenance
            </Text>
          </ActionButton>
        )}

        {tab === 'maintenance' && (
          <>
            <View className="mb-3 flex-row gap-2 rounded-2xl bg-secondary/40 p-1">
              {(
                [
                  { id: 'upcoming', label: 'Upcoming', count: appointments.length },
                  { id: 'canceled', label: 'Canceled', count: canceledAppointments.length },
                  { id: 'completed', label: 'Completed', count: completedCount },
                ] as { id: MaintenanceFilter; label: string; count: number }[]
              ).map((f) => {
                const active = maintenanceFilter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setMaintenanceFilter(f.id)}
                    className={cn(
                      'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2',
                      active ? 'bg-card shadow-sm' : '',
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
                    <View
                      className={cn(
                        'rounded-full px-1.5',
                        active ? 'bg-primary/10' : 'bg-muted',
                      )}
                    >
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
                  <EmptyHint
                    title="No upcoming appointments"
                    description="Book a maintenance visit and it will appear here."
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
                  <EmptyHint
                    title="No canceled bookings"
                    description="Canceled appointments with their reason will appear here."
                  />
                ) : (
                  canceledAppointments.map((c) => <CanceledBookingCard key={c.id} canceled={c} />)
                )}
              </View>
            )}

            {maintenanceFilter === 'completed' && (
              <View className="gap-3">
                {services.length === 0 ? (
                  <EmptyHint
                    title="No completed services"
                    description="Completed maintenance visits will appear here."
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

        {tab === 'emergency' && (
          <View className="gap-3">
            {emergencyCalls.length === 0 ? (
              <EmptyHint
                title="No emergency calls yet"
                description="Completed emergency rescue requests will appear here with damage and repair details."
              />
            ) : (
              emergencyCalls.map((call) => <EmergencyHistoryCard key={call.id} call={call} />)
            )}
            <Card className="border-dashed bg-secondary/30 p-4">
              <Text className="text-center text-xs text-muted-foreground">
                Need emergency help? Go to the{' '}
                <Text className="font-semibold text-foreground">Rescue</Text> tab to request a mechanic.
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
          <Text className="text-xs font-semibold text-white">Canceled</Text>
        </View>
      </View>
      <View className="flex-row gap-2 p-4">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <Wrench size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Vehicle</Text>
          </View>
          <Text className="text-sm font-semibold leading-tight text-foreground">
            {canceled.vehicleName}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <CalendarClock size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Date</Text>
          </View>
          <Text className="text-sm font-semibold text-foreground">
            {canceled.date} · {canceled.time}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <FileText size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Reason</Text>
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
              <Text className="text-xs font-semibold text-green">Completed</Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

function EmptyHint({ title, description }: { title: string; description: string }) {
  return (
    <Card className="items-center gap-2 px-6 py-12">
      <Text className="font-semibold text-foreground">{title}</Text>
      <Text className="text-center text-sm text-muted-foreground">{description}</Text>
    </Card>
  );
}
