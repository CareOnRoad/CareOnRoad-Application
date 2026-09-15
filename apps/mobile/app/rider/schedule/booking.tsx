import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, CalendarCheck, Droplet, Disc, CircleDot, LucideIcon, Wrench } from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { Field, FormTextInput } from '@/components/ui/form';
import { formatVND, serviceTypes, timeSlots } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

const serviceIcons: Record<string, LucideIcon> = {
  oil: Droplet,
  brake: Disc,
  tire: CircleDot,
  general: Wrench,
};

export default function BookingScreen() {
  const { vehicles, addAppointment } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');
  const [service, setService] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState<string | null>(null);

  const selectedService = serviceTypes.find((s) => s.id === service);
  const valid = vehicleId && service && date && time;

  const submit = () => {
    if (!valid) return;
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

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4">
          <Text className="mb-1.5 block text-sm font-semibold text-foreground">Select vehicle</Text>
          <Field label="Vehicle">
            <View className="rounded-2xl border border-input bg-background px-4 py-3">
              <Text className="text-sm font-medium text-foreground">
                {vehicles.find((v) => v.id === vehicleId)?.name ?? vehicles[0]?.name}
                {' · '}
                {vehicles.find((v) => v.id === vehicleId)?.plate ?? vehicles[0]?.plate}
              </Text>
            </View>
          </Field>
          <View className="mt-2 gap-1.5">
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setVehicleId(v.id)}
                className={cn(
                  'rounded-xl border px-3 py-2',
                  vehicleId === v.id ? 'border-primary bg-primary/5' : 'border-border bg-background',
                )}
              >
                <Text className="text-sm">
                  {v.name} · {v.plate}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-4">
          <Text className="mb-1.5 block text-sm font-semibold text-foreground">Select service</Text>
          <View className="flex-row flex-wrap gap-3">
            {serviceTypes.map((s) => {
              const Icon = serviceIcons[s.id];
              const selected = service === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setService(s.id)}
                  className={cn(
                    'w-[48%] gap-2 rounded-2xl border p-4 active:scale-[0.97]',
                    selected ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  )}
                >
                  <View
                    className={cn(
                      'size-10 items-center justify-center rounded-xl',
                      selected ? 'bg-primary' : 'bg-secondary',
                    )}
                  >
                    <Icon size={20} color={selected ? '#ffffff' : '#16202f'} />
                  </View>
                  <Text className="text-sm font-semibold leading-tight text-foreground">
                    {s.label}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {formatVND(s.price)} · {s.duration}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-4">
          <Field label="Select date">
            <FormTextInput
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
            />
          </Field>
        </View>

        <View className="mt-4">
          <Text className="mb-1.5 block text-sm font-semibold text-foreground">Select time</Text>
          <View className="flex-row flex-wrap gap-2">
            {timeSlots.map((t) => {
              const selected = time === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTime(t)}
                  className={cn(
                    'min-w-[70px] rounded-xl border px-3 py-2.5 active:scale-95',
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
        </View>

        <ActionButton
          fullWidth
          className="mt-6 py-4"
          disabled={!valid || submitting}
          onPress={submit}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <CalendarCheck size={20} color="#ffffff" />
          )}
          <Text className="text-base font-semibold text-primary-foreground">
            {submitting ? 'Booking…' : 'Book Appointment'}
          </Text>
        </ActionButton>
      </ScrollView>
    </View>
  );
}
