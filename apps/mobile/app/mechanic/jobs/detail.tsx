import React from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  AlertCircle,
  Bike,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Gauge,
  MapPin,
  Wrench,
} from 'lucide-react-native';

import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Banner } from '@/components/ui/banner';
import { CustomerCard } from '@/components/mechanic/cards/customer-card';
import { JobUpdateForm } from '@/components/mechanic/forms/job-update-form';
import { formatDate, formatVND } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import type { MechanicJobStatus } from '@/lib/mechanic-types';

const timeline: { id: MechanicJobStatus; label: string }[] = [
  { id: 'pending', label: 'Đã nhận' },
  { id: 'in_progress', label: 'Đang xử lý' },
  { id: 'awaiting_parts', label: 'Chờ phụ tùng' },
  { id: 'completed', label: 'Hoàn tất' },
];

const statusTone: Record<MechanicJobStatus, 'amber' | 'blue' | 'red' | 'green'> = {
  pending: 'amber',
  in_progress: 'blue',
  awaiting_parts: 'red',
  completed: 'green',
};

const statusLabel: Record<MechanicJobStatus, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  awaiting_parts: 'Chờ phụ tùng',
  completed: 'Hoàn tất',
};

const toneColor: Record<string, string> = {
  amber: '#d97706',
  blue: '#1974f7',
  red: '#ed3f3a',
  green: '#145413',
};

const toneBg: Record<string, string> = {
  amber: 'bg-amber-500/15',
  blue: 'bg-primary/10',
  red: 'bg-destructive/10',
  green: 'bg-green/10',
};

/**
 * MechanicJobDetailScreen - chi tiết 1 công việc của thợ.
 *
 * Layout:
 *  1. AppHeader với back.
 *  2. Status pill + created date.
 *  3. Vehicle card.
 *  4. Customer's request card.
 *  5. Customer card.
 *  6. Job progress timeline.
 *  7. Before/After photos.
 *  8. Update form.
 *  9. Pickup location link.
 */
export default function MechanicJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob, updateJobStatus, completeJob } = useMechanicApp();
  const job = id ? getJob(id) : undefined;

  if (!job) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Không tìm thấy" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="warning"
            title="Công việc không tồn tại"
            description="Có thể đã hoàn tất hoặc bị huỷ. Vui lòng quay lại danh sách."
          />
        </View>
      </SafeAreaView>
    );
  }

  const currentStep = timeline.findIndex((s) => s.id === job.status);
  const tone = statusTone[job.status];

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title={job.type}
        subtitle={`${job.vehicle.plate} · ${job.scheduledTime}`}
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 flex-row items-center gap-2">
          <View className={cn('rounded-full px-2.5 py-1', toneBg[tone])}>
            <Text className="text-xs font-semibold" style={{ color: toneColor[tone] }}>
              {statusLabel[job.status]}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            Tạo {formatDate(job.scheduledDate)}
          </Text>
        </View>

        {/* Vehicle card */}
        <Card className="p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Bike size={24} color="#1974f7" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="truncate font-bold leading-tight text-foreground">{job.vehicle.name}</Text>
              <Text className="text-xs text-muted-foreground">
                {job.vehicle.brand} · {job.vehicle.plate}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row flex-wrap items-center gap-3 border-t border-border pt-3">
            <View className="flex-row items-center gap-1.5">
              <Gauge size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">
                {job.vehicle.mileage.toLocaleString()} km
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Calendar size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">
                Hôm nay · {job.scheduledTime}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Clock size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">{job.durationMin} phút</Text>
            </View>
            <Text className="ml-auto text-sm font-bold text-foreground">{formatVND(job.price)}</Text>
          </View>
        </Card>

        {/* Customer request */}
        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Yêu cầu của khách
          </Text>
          <Card className="p-4">
            <View className="flex-row items-start gap-2">
              <AlertCircle size={16} color="#d97706" className="mt-0.5 shrink-0" />
              <Text className="flex-1 text-sm leading-relaxed text-foreground">{job.symptom}</Text>
            </View>
          </Card>
        </View>

        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Khách hàng
          </Text>
          <CustomerCard customer={job.customer} />
        </View>

        {/* Job progress */}
        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tiến trình công việc
          </Text>
          <Card className="p-4">
            <View className="gap-4">
              {timeline.map((step, i) => {
                const reached = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <View key={step.id} className="flex-row items-center gap-3">
                    <View
                      className={cn(
                        'size-7 shrink-0 items-center justify-center rounded-full',
                        reached ? 'bg-primary' : 'bg-secondary',
                        isCurrent && 'ring-4 ring-primary/20',
                      )}
                    >
                      {reached ? (
                        <CheckCircle2 size={16} color="#ffffff" />
                      ) : (
                        <Circle size={16} color="#64748b" />
                      )}
                    </View>
                    <Text
                      className={cn(
                        'text-sm',
                        reached ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </Text>
                    {isCurrent && (
                      <Badge tone="blue" className="ml-auto">
                        <Text className="text-xs font-semibold text-primary">Hiện tại</Text>
                      </Badge>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        </View>

        {/* Before/After */}
        <View className="mt-5">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Trước / Sau
          </Text>
          <View className="flex-row gap-3">
            <Card className="flex-1 overflow-hidden p-0">
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600' }}
                className="aspect-square w-full bg-secondary"
                resizeMode="cover"
              />
              <View className="p-2">
                <Text className="text-center text-xs font-semibold text-muted-foreground">Trước</Text>
              </View>
            </Card>
            <Card className="flex-1 overflow-hidden p-0">
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600' }}
                className="aspect-square w-full bg-secondary"
                resizeMode="cover"
              />
              <View className="p-2">
                <Text className="text-center text-xs font-semibold text-muted-foreground">Sau</Text>
              </View>
            </Card>
          </View>
        </View>

        {/* Update form */}
        <View className="mt-5">
          <View className="mb-2 flex-row items-center gap-2">
            <Wrench size={16} color="#1974f7" />
            <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cập nhật công việc
            </Text>
          </View>
          <Card className="p-4">
            <JobUpdateForm
              job={job}
              onSave={(status, notes) => {
                void updateJobStatus(job.id, status, notes);
              }}
              onComplete={(payload) => {
                void completeJob(job.id, payload);
              }}
            />
          </Card>
        </View>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Mở vị trí đón khách trên bản đồ"
          onPress={() => {
            // Trong khi location chi tiết chưa được wire lên job UI,
            // mở Google Maps với query là địa chỉ khách hàng.
            // Khi MapPicker tích hợp, thay bằng lat/lng cụ thể từ request.location.
            const q = job.customer?.name ?? 'CareOnRoad';
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
            Linking.openURL(url).catch(() => undefined);
          }}
          className="mt-5 flex-row items-center gap-2 self-start"
        >
          <MapPin size={14} color="#64748b" />
          <Text className="text-xs text-muted-foreground underline">Mở vị trí đón khách trên bản đồ</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
