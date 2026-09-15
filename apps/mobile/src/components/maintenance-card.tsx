import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Wrench, Calendar, ChevronRight } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDate, formatVND } from '@/lib/mock-data';
import type { ServiceRecord } from '@/lib/types';

export function MaintenanceCard({ record }: { record: ServiceRecord }) {
  const router = useRouter();
  return (
    <Card onPress={() => router.push('/rider/history')}>
      <View className="flex-row items-center gap-3 p-4">
        <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Wrench size={20} color="#1974f7" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 truncate font-semibold leading-tight text-foreground">
              {record.type}
            </Text>
            <Text className="shrink-0 text-sm font-bold text-foreground">
              {formatVND(record.price)}
            </Text>
          </View>
          <Text className="truncate text-xs text-muted-foreground">
            {record.vehicleName} · {record.mechanic}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-2">
            <Badge tone="neutral">
              <Calendar size={12} color="#64748b" />
              <Text className="ml-1 text-xs font-semibold text-secondary-foreground">
                {formatDate(record.date)}
              </Text>
            </Badge>
            {record.status === 'completed' ? (
              <Badge tone="green">
                <Text className="text-xs font-semibold text-green">Completed</Text>
              </Badge>
            ) : (
              <Badge tone="amber">
                <Text className="text-xs font-semibold text-amber-600">Upcoming</Text>
              </Badge>
            )}
          </View>
        </View>
        <ChevronRight size={20} color="#64748b" />
      </View>
    </Card>
  );
}
