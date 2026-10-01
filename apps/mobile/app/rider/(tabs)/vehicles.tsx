import React from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bike, Plus } from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { VehicleCard } from '@/components/vehicle-card';

/**
 * VehiclesScreen - danh sách xe của rider.
 *
 * Pull-to-refresh để reload từ API khi ở backend mode.
 * Hiển thị banner lỗi + retry khi vehiclesError có giá trị.
 */
export default function VehiclesScreen() {
  const { vehicles, vehiclesLoading, vehiclesError, reloadVehicles } = useApp();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Xe của tôi" subtitle={`${vehicles.length} xe đã đăng ký`} />
      <ScreenScroll
        refreshControl={
          <RefreshControl
            refreshing={vehiclesLoading}
            onRefresh={reloadVehicles}
            tintColor="#1974f7"
          />
        }
      >
        <ActionButton
          fullWidth
          onPress={() => router.push('/rider/vehicles/form')}
          className="border border-dashed border-primary/40 bg-primary/5 py-4"
          accessibilityLabel="Thêm xe mới"
        >
          <Plus size={20} color="#1974f7" />
          <Text className="text-sm font-semibold text-primary">Thêm xe mới</Text>
        </ActionButton>

        {vehiclesError && (
          <View className="mt-3">
            <Banner
              tone="error"
              title="Không thể tải danh sách xe"
              description={vehiclesError}
              className="mb-2"
            />
            <ActionButton
              variant="outline"
              fullWidth
              onPress={reloadVehicles}
              accessibilityLabel="Thử lại tải danh sách xe"
            >
              <Text className="text-sm font-semibold text-foreground">Thử lại</Text>
            </ActionButton>
          </View>
        )}

        {vehicles.length === 0 ? (
          <View className="mt-3">
            <EmptyState
              icon={Bike}
              tone="primary"
              title="Chưa có xe nào"
              description="Thêm xe máy để bắt đầu theo dõi bảo dưỡng và nhận nhắc nhở định kỳ."
              action={
                <ActionButton onPress={() => router.push('/rider/vehicles/form')}>
                  <Plus size={16} color="#ffffff" />
                  <Text className="text-sm font-semibold text-primary-foreground">Thêm xe đầu tiên</Text>
                </ActionButton>
              }
            />
          </View>
        ) : (
          <View className="mt-4 gap-3">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </View>
        )}

        <Card className="mt-6 border-dashed bg-secondary/40 p-4">
          <Text className="text-xs font-medium leading-relaxed text-muted-foreground">
            💡 <Text className="font-semibold text-foreground">Mẹo:</Text> kéo xuống để làm
            mới danh sách. Cập nhật số km hàng tháng để nhận nhắc bảo dưỡng chính xác.
          </Text>
        </Card>
      </ScreenScroll>
    </View>
  );
}
