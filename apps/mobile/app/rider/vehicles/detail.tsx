import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import {
  Calendar,
  CalendarClock,
  Gauge,
  Palette,
  Pencil,
  Trash2,
  LucideIcon,
} from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Banner } from '@/components/ui/banner';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/mock-data';

/**
 * VehicleDetailScreen - chi tiết một xe đã đăng ký.
 *
 * - Nút "Lưu trữ xe" gọi DELETE /api/v1/motorcycles/[id] (khi đã tích hợp backend).
 * - Trong demo mode: xoá khỏi state local.
 * - Sau khi archive thành công: quay về danh sách.
 */
export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vehicles, archiveVehicle } = useApp();
  const vehicle = vehicles.find((v) => v.id === id);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!vehicle) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Không tìm thấy xe" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="warning"
            title="Xe không tồn tại"
            description="Có thể xe đã được lưu trữ. Vui lòng quay lại danh sách xe."
          />
        </View>
      </View>
    );
  }

  const isUpcomingSoon = isWithinDays(vehicle.nextMaintenance, 14);

  const handleArchive = async () => {
    if (archiving) return;
    setError(null);
    setArchiving(true);
    try {
      const ok = await archiveVehicle(vehicle.id);
      if (!ok) {
        setError('Không thể lưu trữ xe. Vui lòng thử lại.');
        return;
      }
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Đã xảy ra lỗi khi lưu trữ xe');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={vehicle.name}
        subtitle={`${vehicle.brand} · ${vehicle.year}`}
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Card className="overflow-hidden">
          <Image
            source={{ uri: vehicle.image }}
            className="aspect-[16/10] w-full bg-secondary"
            resizeMode="cover"
          />
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1">
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

        {isUpcomingSoon && (
          <View className="mt-4">
            <Banner
              tone="warning"
              title="Sắp đến hạn bảo dưỡng"
              description={`Ngày bảo dưỡng kế tiếp: ${formatDate(vehicle.nextMaintenance)}`}
            />
          </View>
        )}

        {/* Stats grid 2x2 */}
        <View className="mt-5 flex-row flex-wrap gap-3">
          <StatTile icon={Gauge} tone="blue" label="Số km" value={`${vehicle.mileage.toLocaleString()} km`} />
          <StatTile icon={Palette} tone="green" label="Màu sắc" value={vehicle.color} />
          <StatTile
            icon={Calendar}
            tone="neutral"
            label="Bảo dưỡng gần nhất"
            value={formatDate(vehicle.lastMaintenance)}
          />
          <StatTile
            icon={CalendarClock}
            tone={isUpcomingSoon ? 'amber' : 'neutral'}
            label="Bảo dưỡng kế tiếp"
            value={formatDate(vehicle.nextMaintenance)}
          />
        </View>

        {error && (
          <View className="mt-4">
            <Banner tone="error" description={error} />
          </View>
        )}

        {/* Action buttons */}
        <View className="mt-6 gap-3">
          <ActionButton
            fullWidth
            onPress={() =>
              router.push({ pathname: '/rider/vehicles/form', params: { id: vehicle.id } })
            }
            accessibilityLabel="Chỉnh sửa xe"
          >
            <Pencil size={16} color="#ffffff" />
            <Text className="text-sm font-semibold text-primary-foreground">Chỉnh sửa</Text>
          </ActionButton>
          <ActionButton
            fullWidth
            variant="outline"
            onPress={handleArchive}
            disabled={archiving}
            accessibilityLabel="Lưu trữ xe"
          >
            {archiving ? (
              <ActivityIndicator color="#ed3f3a" />
            ) : (
              <Trash2 size={16} color="#ed3f3a" />
            )}
            <Text className="text-sm font-semibold text-destructive">
              {archiving ? 'Đang lưu trữ...' : 'Lưu trữ xe'}
            </Text>
          </ActionButton>
        </View>

        <Text className="mt-6 text-center text-xs text-muted-foreground">
          Mã xe: {vehicle.id}
        </Text>
      </ScrollView>
    </View>
  );
}

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: 'blue' | 'green' | 'amber' | 'neutral';
  label: string;
  value: string;
}) {
  const toneStyles = {
    blue: { bg: 'bg-primary/10', fg: '#1974f7' },
    green: { bg: 'bg-green/10', fg: '#145413' },
    amber: { bg: 'bg-amber-500/15', fg: '#d97706' },
    neutral: { bg: 'bg-secondary', fg: '#64748b' },
  } as const;
  const s = toneStyles[tone];
  return (
    <Card className="w-[48%] p-4">
      <View className="flex-row items-center gap-2">
        <View className="size-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${s.fg}1a` }}>
          <Icon size={14} color={s.fg} />
        </View>
        <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-1.5 font-bold text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );
}

function isWithinDays(isoDate: string, days: number): boolean {
  const target = new Date(isoDate).getTime();
  const today = Date.now();
  const diffDays = (target - today) / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}
