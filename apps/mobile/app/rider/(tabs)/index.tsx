import React from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowRight,
  Bike,
  CalendarPlus,
  History,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MaintenanceCard } from '@/components/maintenance-card';
import { SectionHeader } from '@/components/ui/form';
import { formatDate } from '@/lib/mock-data';

const quickActions = [
  { id: 'rescue', label: 'Emergency Rescue', tab: 'rescue', icon: Siren, tone: 'bg-destructive/10' },
  { id: 'schedule', label: 'Book Maintenance', tab: 'schedule', icon: CalendarPlus, tone: 'bg-primary/10' },
  { id: 'vehicles', label: 'My Vehicles', tab: 'vehicles', icon: Bike, tone: 'bg-green/10' },
  { id: 'history', label: 'Service History', tab: null, icon: History, tone: 'bg-navy/10' },
] as const;

const iconColor: Record<string, string> = {
  rescue: '#ed3f3a',
  schedule: '#1974f7',
  vehicles: '#145413',
  history: '#16202f',
};

export default function HomeScreen() {
  const { user, vehicles, services } = useApp();
  const upcoming = vehicles
    .slice()
    .sort(
      (a, b) =>
        new Date(a.nextMaintenance).getTime() - new Date(b.nextMaintenance).getTime(),
    )[0];
  const recent = services.filter((s) => s.status === 'completed').slice(0, 2);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      <Card className="overflow-hidden border-0 bg-navy">
        <View className="p-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-white/70">Good afternoon,</Text>
              <Text className="text-xl font-bold text-white">{user.name}</Text>
            </View>
            <Image
              source={{ uri: user.avatar }}
              className="size-12 rounded-full"
              resizeMode="cover"
            />
          </View>
          <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
            <ShieldCheck size={16} color="#a9ffad" />
            <Text className="text-xs text-white">CareOnRoad Plus active · 24/7 coverage</Text>
          </View>
        </View>
      </Card>

      <View className="mt-5">
        <SectionHeader title="Quick Actions" />
        <View className="flex-row gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <View key={a.id} className="flex-1 items-center gap-2">
                <View
                  className={`size-14 items-center justify-center rounded-2xl ${a.tone} active:scale-90`}
                >
                  <Icon size={24} color={iconColor[a.id]} />
                </View>
                <Text
                  className="text-center text-[11px] font-medium leading-tight text-foreground"
                  onPress={() => {
                    if (a.tab === 'rescue') router.push('/rider/(tabs)/rescue');
                    else if (a.tab === 'schedule') router.push('/rider/(tabs)/schedule');
                    else if (a.tab === 'vehicles') router.push('/rider/(tabs)/vehicles');
                    else router.push('/rider/history');
                  }}
                >
                  {a.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {upcoming && (
        <View className="mt-5">
          <SectionHeader title="Maintenance Reminder" action="Book now" onAction={() => router.push('/rider/(tabs)/schedule')} />
          <Card>
            <View className="flex-row items-center gap-3 p-4">
              <View className="size-12 shrink-0 items-center justify-center rounded-2xl bg-mint">
                <Wrench size={24} color="#145413" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-semibold leading-tight text-foreground">
                  {upcoming.name} is due soon
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Scheduled for {formatDate(upcoming.nextMaintenance)} · {upcoming.mileage.toLocaleString()} km
                </Text>
              </View>
              <Badge tone="amber">
                <Text className="text-xs font-semibold text-amber-600">Due</Text>
              </Badge>
            </View>
          </Card>
        </View>
      )}

      <View className="mt-5">
        <SectionHeader title="Recent Services" action="See all" onAction={() => router.push('/rider/history')} />
        <View className="gap-3">
          {recent.map((r) => (
            <MaintenanceCard key={r.id} record={r} />
          ))}
        </View>
      </View>

      <Card className="mt-5 overflow-hidden border-0 bg-green">
        <View className="flex-row items-center justify-between gap-3 p-5">
          <View className="flex-1">
            <View className="mb-2 self-start rounded-full bg-white/20 px-2.5 py-1">
              <Text className="text-xs font-semibold text-white">Limited offer</Text>
            </View>
            <Text className="text-balance text-lg font-bold leading-tight text-white">
              30% off your first oil change
            </Text>
            <Text className="mt-1 text-sm text-white/80">
              Use code CARE30 at booking checkout.
            </Text>
            <ActionButton variant="mint" className="mt-3 self-start px-4 py-2" onPress={() => router.push('/rider/(tabs)/schedule')}>
              <Text className="text-sm font-semibold text-green">Book now</Text>
              <ArrowRight size={16} color="#145413" />
            </ActionButton>
          </View>
          <Siren size={48} color="#ffffff" className="opacity-30" />
        </View>
      </Card>
    </ScrollView>
  );
}
