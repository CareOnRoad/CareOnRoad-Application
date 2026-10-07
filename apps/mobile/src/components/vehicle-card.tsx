import React from 'react';
import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gauge, ChevronRight } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import type { Vehicle } from '@/lib/types';

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  return (
    <Card onPress={() => router.push({ pathname: '/rider/vehicles/detail', params: { id: vehicle.id } })}>
      <View className="flex-row gap-3 p-3">
        <Image
          source={{ uri: vehicle.image }}
          className="size-20 shrink-0 rounded-2xl bg-secondary"
          resizeMode="cover"
        />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Text className="truncate font-bold leading-tight text-foreground" numberOfLines={1}>
                {vehicle.name}
              </Text>
              <Text className="text-xs text-muted-foreground">{vehicle.plate}</Text>
            </View>
            <ChevronRight size={20} color="#64748b" />
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
            <Badge tone="blue">
              <Gauge size={12} color="#1974f7" />
              <Text className="ml-1 text-xs font-semibold text-primary">
                {vehicle.mileage.toLocaleString()} km
              </Text>
            </Badge>
            <Badge tone="neutral">
              <Text className="text-xs font-semibold text-secondary-foreground">
                {vehicle.year}
              </Text>
            </Badge>
          </View>
          <Text className="mt-1.5 text-xs text-muted-foreground">
            Bảo dưỡng tiếp theo: {formatDate(vehicle.nextMaintenance)}
          </Text>
        </View>
      </View>
    </Card>
  );
}
