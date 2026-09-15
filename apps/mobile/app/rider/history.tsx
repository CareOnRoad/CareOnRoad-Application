import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bike, Calendar, FileText, History, LucideIcon, Receipt, User, Wrench } from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MaintenanceCard } from '@/components/maintenance-card';
import { formatDate, formatVND } from '@/lib/mock-data';
import type { ServiceRecord } from '@/lib/types';

export default function HistoryScreen() {
  const { services } = useApp();
  const [selected, setSelected] = useState<ServiceRecord | null>(null);
  const total = services.reduce((sum, s) => sum + s.price, 0);

  if (selected) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader
          title="Service Detail"
          subtitle={selected.type}
          onBack={() => setSelected(null)}
        />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        >
          <Card className="p-5">
            <View className="flex-row items-center gap-3">
              <View className="size-12 items-center justify-center rounded-2xl bg-primary/10">
                <Wrench size={24} color="#1974f7" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold leading-tight text-foreground">
                  {selected.type}
                </Text>
                <Badge tone="green" className="mt-1 self-start">
                  <Text className="text-xs font-semibold text-green">Completed</Text>
                </Badge>
              </View>
            </View>
            <View className="mt-4 gap-3">
              <DetailRow icon={Bike} label="Vehicle" value={selected.vehicleName} />
              <DetailRow icon={Calendar} label="Date" value={formatDate(selected.date)} />
              <DetailRow icon={User} label="Mechanic" value={selected.mechanic} />
              <DetailRow icon={Receipt} label="Total paid" value={formatVND(selected.price)} />
            </View>
          </Card>
          {selected.notes && (
            <Card className="mt-4 p-5">
              <View className="mb-2 flex-row items-center gap-2">
                <FileText size={16} color="#1974f7" />
                <Text className="font-bold text-foreground">Service notes</Text>
              </View>
              <Text className="text-sm leading-relaxed text-muted-foreground">{selected.notes}</Text>
            </Card>
          )}
          <ActionButton fullWidth variant="outline" className="mt-4">
            <Receipt size={16} color="#16202f" />
            <Text className="text-sm font-semibold text-foreground">Download invoice</Text>
          </ActionButton>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Service History" onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        <Card className="flex-row items-center justify-between bg-navy p-4">
          <View>
            <Text className="text-xs text-white/70">Total spent on maintenance</Text>
            <Text className="text-xl font-bold text-white">{formatVND(total)}</Text>
          </View>
          <View className="rounded-full bg-white/15 px-2.5 py-1">
            <Text className="text-xs font-semibold text-white">{services.length} services</Text>
          </View>
        </Card>

        {services.length === 0 ? (
          <Card className="mt-4 items-center gap-2 px-6 py-12">
            <View className="size-14 items-center justify-center rounded-2xl bg-secondary">
              <History size={28} color="#64748b" />
            </View>
            <Text className="font-semibold text-foreground">No service history</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Your completed services will appear here.
            </Text>
          </Card>
        ) : (
          <View className="mt-4 gap-3">
            {services.map((s) => (
              <MaintenanceCard key={s.id} record={s} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color="#64748b" />
        <Text className="text-sm text-muted-foreground">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
