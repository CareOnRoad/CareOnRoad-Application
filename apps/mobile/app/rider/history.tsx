import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bike, Calendar, FileText, History, LucideIcon, Receipt, User, Wrench } from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MaintenanceCard } from '@/components/maintenance-card';
import { formatDate, formatVND } from '@/lib/mock-data';
import type { ServiceRecord } from '@/lib/types';

/**
 * HistoryScreen - lịch sử dịch vụ đã hoàn tất.
 *
 * Layout:
 *  - AppHeader.
 *  - Hero card navy: tổng chi tiêu + số dịch vụ.
 *  - Danh sách service records (pressable để mở detail).
 */
export default function HistoryScreen() {
  const { services } = useApp();
  const [selected, setSelected] = useState<ServiceRecord | null>(null);
  const total = services.reduce((sum, s) => sum + s.price, 0);

  if (selected) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader
          title="Chi tiết dịch vụ"
          subtitle={selected.type}
          onBack={() => setSelected(null)}
        />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
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
                  <Text className="text-xs font-semibold text-green">Hoàn tất</Text>
                </Badge>
              </View>
            </View>
            <View className="mt-4 gap-3">
              <DetailRow icon={Bike} label="Xe" value={selected.vehicleName} />
              <DetailRow icon={Calendar} label="Ngày" value={formatDate(selected.date)} />
              <DetailRow icon={User} label="Thợ phụ trách" value={selected.mechanic} />
              <DetailRow icon={Receipt} label="Tổng thanh toán" value={formatVND(selected.price)} />
            </View>
          </Card>
          {selected.notes && (
            <Card className="mt-4 p-5">
              <View className="mb-2 flex-row items-center gap-2">
                <FileText size={16} color="#1974f7" />
                <Text className="font-bold text-foreground">Ghi chú dịch vụ</Text>
              </View>
              <Text className="text-sm leading-relaxed text-muted-foreground">{selected.notes}</Text>
            </Card>
          )}

          <ActionButton
            fullWidth
            variant="outline"
            className="mt-4"
            accessibilityLabel="Tải hoá đơn"
          >
            <Receipt size={16} color="#16202f" />
            <Text className="text-sm font-semibold text-foreground">Tải hoá đơn</Text>
          </ActionButton>

          <Banner
            className="mt-5"
            tone="info"
            description="Hoá đơn sẽ được tạo tự động sau khi thanh toán thành công (khi tích hợp backend)."
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Lịch sử dịch vụ" onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Card className="overflow-hidden border-0 bg-navy">
          <View className="flex-row items-center justify-between p-5">
            <View className="flex-1">
              <Text className="text-xs text-white/70">Tổng chi tiêu bảo dưỡng</Text>
              <Text className="mt-1 text-2xl font-bold text-white">{formatVND(total)}</Text>
              <Text className="mt-0.5 text-xs text-white/60">Cập nhật {formatDate(new Date().toISOString())}</Text>
            </View>
            <View className="rounded-full bg-white/15 px-3 py-1.5">
              <Text className="text-sm font-semibold text-white">{services.length} dịch vụ</Text>
            </View>
          </View>
        </Card>

        {services.length === 0 ? (
          <View className="mt-4">
            <EmptyState
              icon={History}
              title="Chưa có lịch sử dịch vụ"
              description="Các dịch vụ đã hoàn thành sẽ hiển thị tại đây."
              action={
                <ActionButton onPress={() => router.replace('/rider/(tabs)/schedule')}>
                  <Text className="text-sm font-semibold text-primary-foreground">Đặt lịch ngay</Text>
                </ActionButton>
              }
            />
          </View>
        ) : (
          <View className="mt-5 gap-3">
            {services.map((s) => (
              <MaintenanceCard
                key={s.id}
                record={s}
                onPress={() => setSelected(s)}
              />
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
