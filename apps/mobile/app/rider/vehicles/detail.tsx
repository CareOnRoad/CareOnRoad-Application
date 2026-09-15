import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image, ScrollView, Text, View } from 'react-native';
import {
  Calendar,
  CalendarClock,
  Gauge,
  LucideIcon,
  Palette,
  Pencil,
} from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/mock-data';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vehicles } = useApp();
  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Vehicle not found" onBack={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={vehicle.name} subtitle={vehicle.plate} onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        <Card className="overflow-hidden">
          <Image
            source={{ uri: vehicle.image }}
            className="aspect-[16/10] w-full bg-secondary"
            resizeMode="cover"
          />
          <View className="flex-row items-center justify-between p-4">
            <View>
              <Text className="text-lg font-bold text-foreground">{vehicle.name}</Text>
              <Text className="text-sm text-muted-foreground">
                {vehicle.brand} · {vehicle.year}
              </Text>
            </View>
            <Badge tone="blue">
              <Text className="text-xs font-semibold text-primary">{vehicle.plate}</Text>
            </Badge>
          </View>
        </Card>

        <View className="mt-4 flex-row flex-wrap gap-3">
          <StatTile icon={Gauge} label="Mileage" value={`${vehicle.mileage.toLocaleString()} km`} />
          <StatTile icon={Palette} label="Color" value={vehicle.color} />
          <StatTile icon={Calendar} label="Last service" value={formatDate(vehicle.lastMaintenance)} />
          <StatTile icon={CalendarClock} label="Next service" value={formatDate(vehicle.nextMaintenance)} />
        </View>

        <ActionButton
          fullWidth
          variant="outline"
          className="mt-4"
          onPress={() => router.push({ pathname: '/rider/vehicles/form', params: { id: vehicle.id } })}
        >
          <Pencil size={16} color="#16202f" />
          <Text className="text-sm font-semibold text-foreground">Edit Vehicle</Text>
        </ActionButton>
      </ScrollView>
    </View>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card className="w-[48%] p-4">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color="#64748b" />
        <Text className="text-xs text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-1 font-bold text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );
}
