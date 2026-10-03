/**
 * NearMechanicsCard - info card hiển thị "Danh sách thợ gần bạn:".
 *
 * Dùng cho màn hình rider/schedule/confirmed.tsx sau khi đặt lịch bảo dưỡng.
 *
 * Behavior:
 *  - Nếu request có location (lat/lng) → gọi `listAvailableMechanics()`.
 *  - BE có thể chưa implement endpoint → fallback sang thông báo
 *    "Sẽ có thợ nhận job khi tới giờ hẹn" mà không hiển thị lỗi cho user.
 *  - Khi BE trả 0 thợ → hiển thị "Chưa có thợ khả dụng".
 *  - Khi BE trả >= 1 thợ → hiển thị danh sách ngắn (top 3) + count total.
 *
 * Không cho user chọn thợ (theo AGENTS.md "Don't" rule về booking UI mới).
 * Chỉ là info display.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Star, Users, Wrench } from 'lucide-react-native';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  listAvailableMechanics,
  type AvailableMechanic,
  type ServiceType,
} from '@/lib/mechanics-service';
import { ApiError } from '@/lib/api';

interface NearMechanicsCardProps {
  /** Vĩ độ của service-request (nếu có). */
  latitude?: number;
  /** Kinh độ của service-request (nếu có). */
  longitude?: number;
  /** Service type để filter mechanic phù hợp. */
  serviceType?: ServiceType;
  /** Bán kính tìm kiếm (km). Mặc định 5. */
  radiusKm?: number;
}

export function NearMechanicsCard({
  latitude,
  longitude,
  serviceType,
  radiusKm = 5,
}: NearMechanicsCardProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AvailableMechanic[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listAvailableMechanics({
          latitude,
          longitude,
          ...(serviceType ? { service_type: serviceType } : {}),
          radius_km: radiusKm,
        });
        if (!cancelled) {
          setItems(res.items ?? []);
          setTotal(res.total ?? res.items?.length ?? 0);
        }
      } catch (e) {
        // 404 = BE chưa implement endpoint → silent fallback.
        if (e instanceof ApiError && e.status === 404) {
          if (!cancelled) setError(null);
        } else if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Không thể tải danh sách thợ',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, serviceType, radiusKm]);

  // Không có location → fallback UI.
  if (latitude === undefined || longitude === undefined) {
    return (
      <Card className="mt-5 border-primary/20 bg-primary/5 p-4">
        <View className="mb-2 flex-row items-center gap-2">
          <Wrench size={16} color="#1974f7" />
          <Text className="text-sm font-bold text-foreground">
            Danh sách thợ gần bạn:
          </Text>
        </View>
        <Text className="text-xs leading-relaxed text-muted-foreground">
          Khi tới giờ hẹn, hệ thống sẽ tự động ghép thợ sẵn sàng trong khu vực
          của bạn. Thợ đầu tiên nhận offer sẽ xử lý yêu cầu.
        </Text>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="mt-5 border-primary/20 bg-primary/5 p-4">
        <View className="mb-2 flex-row items-center gap-2">
          <Wrench size={16} color="#1974f7" />
          <Text className="text-sm font-bold text-foreground">
            Danh sách thợ gần bạn:
          </Text>
        </View>
        <View className="items-center py-2">
          <ActivityIndicator color="#1974f7" />
          <Text className="mt-2 text-xs text-muted-foreground">
            Đang tìm thợ gần bạn...
          </Text>
        </View>
      </Card>
    );
  }

  if (error) {
    // Lỗi thật (không phải 404) → ẩn silently, không hiện banner error.
    return null;
  }

  if (total === 0) {
    return (
      <Card className="mt-5 border-amber-500/30 bg-amber-500/10 p-4">
        <View className="mb-2 flex-row items-center gap-2">
          <Wrench size={16} color="#d97706" />
          <Text className="text-sm font-bold text-amber-700">
            Danh sách thợ gần bạn:
          </Text>
        </View>
        <View className="mb-2 flex-row items-center gap-2">
          <Users size={14} color="#d97706" />
          <Text className="text-xs font-semibold text-amber-700">
            Chưa có thợ khả dụng
          </Text>
        </View>
        <Text className="text-xs leading-relaxed text-amber-700/80">
          Hiện chưa có thợ sẵn sàng trong bán kính {radiusKm} km. Hệ thống sẽ
          tiếp tục tìm khi có thợ bật trạng thái nhận việc.
        </Text>
      </Card>
    );
  }

  const top3 = items.slice(0, 3);
  return (
    <Card className="mt-5 border-green/30 bg-green/10 p-4">
      <View className="mb-2 flex-row items-center gap-2">
        <Wrench size={16} color="#145413" />
        <Text className="text-sm font-bold text-green">
          Danh sách thợ gần bạn:
        </Text>
      </View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-green">
          {total} thợ sẵn sàng trong {radiusKm} km
        </Text>
        {items.length > 3 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showList ? 'Thu gọn danh sách' : 'Xem tất cả'}
            onPress={() => setShowList((v) => !v)}
            hitSlop={8}
          >
            <Text className="text-xs font-semibold text-green">
              {showList ? 'Thu gọn' : `+${items.length - 3}`}
            </Text>
          </Pressable>
        )}
      </View>
      <View className="gap-2">
        {(showList ? items : top3).map((m) => (
          <MechanicRow key={m.mechanic_id} mechanic={m} />
        ))}
      </View>
      <Text className="mt-3 text-[11px] leading-relaxed text-green/80">
        Hệ thống sẽ tự động gửi offer tới các thợ trên khi tới giờ hẹn. Thợ
        đầu tiên nhận sẽ xử lý yêu cầu của bạn.
      </Text>
    </Card>
  );
}

function MechanicRow({ mechanic }: { mechanic: AvailableMechanic }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-white/60 p-2.5">
      <View className="size-9 items-center justify-center rounded-full bg-primary/15">
        <Text className="text-sm font-bold text-primary">
          {mechanic.display_name.charAt(0).toUpperCase() || 'T'}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {mechanic.display_name || 'Thợ CareOnRoad'}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-2">
          <View className="flex-row items-center gap-0.5">
            <Star size={10} color="#d97706" fill="#d97706" />
            <Text className="text-[11px] font-semibold text-foreground">
              {mechanic.rating_avg.toFixed(1)}
            </Text>
            <Text className="text-[10px] text-muted-foreground">
              ({mechanic.rating_count})
            </Text>
          </View>
          <Text
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              mechanic.is_available
                ? 'bg-green/20 text-green'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {mechanic.is_available ? 'Sẵn sàng' : 'Bận'}
          </Text>
        </View>
      </View>
      <Text className="text-xs font-semibold text-foreground">
        {mechanic.distance_km.toFixed(1)} km
      </Text>
    </View>
  );
}
