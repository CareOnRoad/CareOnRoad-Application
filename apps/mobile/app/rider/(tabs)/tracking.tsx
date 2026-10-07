import React, { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Siren, Wrench } from 'lucide-react-native';

import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { useServiceRequests } from '@/hooks/use-service-requests';
import {
  statusLabel,
  type RequestStatus,
} from '@/lib/service-requests-service';
import { cn } from '@/lib/utils';

/**
 * Tab "Theo dõi" — hub để rider mở lại bất kỳ request nào đang chạy.
 *
 * Vì sao cần màn hình này:
 *  - Session tracking của `useServiceRequests()` sống trong React state và
 *    mất khi app restart hoặc khi rời màn hình rescue.
 *  - Rider cần một chỗ cố định để xem "yêu cầu nào của tôi đang chạy" và mở
 *    vào màn hình chi tiết (status, thợ đã nhận chưa, báo giá, thanh toán).
 *  - Màn hình này chỉ đọc danh sách từ BE, không tạo request mới.
 */

/** Status còn "sống" — chưa tới trạng thái kết thúc. */
const ACTIVE_STATUSES: RequestStatus[] = [
  'submitted',
  'dispatching',
  'offered',
  'manual_escalation',
  'assigned',
  'mechanic_en_route',
  'in_service',
  'awaiting_quote_approval',
  'awaiting_payment',
];

const statusTone: Record<string, string> = {
  submitted: 'bg-slate-500/15 text-slate-600',
  dispatching: 'bg-blue-500/15 text-blue-600',
  offered: 'bg-blue-500/15 text-blue-600',
  manual_escalation: 'bg-amber-500/15 text-amber-600',
  assigned: 'bg-emerald-500/15 text-emerald-600',
  mechanic_en_route: 'bg-emerald-500/15 text-emerald-600',
  in_service: 'bg-emerald-500/15 text-emerald-600',
  awaiting_quote_approval: 'bg-violet-500/15 text-violet-600',
  awaiting_payment: 'bg-amber-500/15 text-amber-600',
};

const serviceLabel: Record<string, string> = {
  emergency_rescue: 'Cứu hộ khẩn cấp',
  periodic_maintenance: 'Bảo dưỡng định kỳ',
  standard: 'Sửa chữa thường',
  other: 'Yêu cầu khác',
};

export default function RiderTrackingScreen() {
  const router = useRouter();
  const { list, listLoading, listError, reloadList } = useServiceRequests();

  // Chỉ hiện request còn sống. `list` đã được BE sort mới → cũ.
  const activeItems = useMemo(
    () => list.filter((r) => ACTIVE_STATUSES.includes(r.status)),
    [list],
  );

  const onOpen = useCallback(
    (requestId: string) => {
      router.push(`/rider/rescue/${requestId}` as never);
    },
    [router],
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Theo dõi" subtitle="Yêu cầu đang chạy của bạn" />
      <ScreenScroll
        refreshControl={
          <RefreshControl
            refreshing={listLoading}
            onRefresh={() => void reloadList()}
            tintColor="#94a3b8"
          />
        }
      >
        {listError ? (
          <Card className="mb-4 p-4">
            <Text className="text-sm text-red-500">{listError}</Text>
          </Card>
        ) : null}

        {activeItems.length === 0 ? (
          <View className="items-center px-6 py-16">
            <View className="mb-4 size-16 items-center justify-center rounded-full bg-secondary">
              <Wrench size={28} color="#94a3b8" />
            </View>
            <Text className="text-base font-bold text-foreground">Chưa có yêu cầu đang chạy</Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              Khi bạn đặt cứu hộ hoặc lịch bảo dưỡng, yêu cầu sẽ xuất hiện ở đây để bạn theo dõi
              trạng thái, báo giá và vị trí thợ.
            </Text>
            <Pressable
              onPress={() => router.push('/rider/(tabs)/rescue' as never)}
              className="mt-6 flex-row items-center gap-2 rounded-full bg-primary px-5 py-3"
            >
              <Siren size={16} color="#ffffff" />
              <Text className="text-sm font-semibold text-white">Đặt cứu hộ</Text>
            </Pressable>
          </View>
        ) : (
          activeItems.map((item) => {
            const tone = statusTone[item.status] ?? 'bg-slate-500/15 text-slate-600';
            return (
              <Pressable
                key={item.id}
                onPress={() => onOpen(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Mở yêu cầu ${item.request_code ?? item.id}`}
                className="mb-3"
              >
                <Card className="p-4">
                  <View className="flex-row items-start gap-3">
                    <View className={cn('rounded-full px-2.5 py-1', tone)}>
                      <Text className="text-xs font-semibold">
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-bold text-foreground">
                        {serviceLabel[item.service_type] ?? item.service_type}
                      </Text>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        {item.request_code ? `#${item.request_code}` : null}
                        {item.request_code && item.address_text ? ' · ' : null}
                        {item.address_text ?? item.problem_description}
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#94a3b8" />
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScreenScroll>
    </View>
  );
}
