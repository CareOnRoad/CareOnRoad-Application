import React from 'react';
import { Text, View } from 'react-native';
import { Phone, Bike, Wrench, ChevronRight, Clock } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { formatVND } from '@/lib/format';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TONE,
  JOB_STATUS_TONE_COLOR,
  type MechanicJob,
} from '@/lib/mechanic-types';

/**
 * JobCard - card hiển thị job của mechanic trong list/dashboard.
 *
 * Status label + tone lấy từ shared maps trong `mechanic-types.ts` để đảm bảo
 * tất cả UI mechanic (dashboard hero, jobs list, filter chips, job detail
 * header) render cùng 1 vocabulary.
 */
export function JobCard({ job, onPress }: { job: MechanicJob; onPress?: () => void }) {
  const tone = JOB_STATUS_TONE[job.status];
  const label = JOB_STATUS_LABELS[job.status];
  const toneColor = JOB_STATUS_TONE_COLOR[tone];
  return (
    <Card onPress={onPress} className="p-4">
      <View className="flex-row items-start gap-3">
        <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <Wrench size={20} color="#16202f" />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Text className="truncate font-semibold leading-tight text-foreground">{job.type}</Text>
              <Text className="truncate text-xs text-muted-foreground">
                {job.customer.name} · {job.vehicle.plate}
              </Text>
            </View>
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${toneColor}20` }}
            >
              <Text className="text-xs font-semibold" style={{ color: toneColor }}>
                {label}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-1">
              <Clock size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">
                {job.scheduledTime} · {job.durationMin} phút
              </Text>
            </View>
            <Text className="text-xs font-bold text-foreground">{formatVND(job.price)}</Text>
          </View>
          <View className="mt-3 flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
              <Phone size={12} color="#16202f" />
              <Text className="text-xs font-medium text-foreground">{job.customer.phone}</Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
              <Bike size={12} color="#64748b" />
              <Text className="text-xs font-medium text-muted-foreground">{job.vehicle.name}</Text>
            </View>
            <ChevronRight size={20} color="#64748b" className="ml-auto" />
          </View>
        </View>
      </View>
    </Card>
  );
}