import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  CalendarClock,
  Palette,
  Pencil,
  Shield,
  Sparkles,
  Trash2,
  LucideIcon,
} from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { useAuth } from '@/contexts/auth-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Banner } from '@/components/ui/banner';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { ApiError } from '@/lib/api';
import { formatDate, formatVND } from '@/lib/format';
import { hasVipPlan } from '@/lib/plan-gate';
import { VEHICLE_DETAIL_FIELDS } from '@/lib/vehicle-details';

/**
 * VehicleDetailScreen - chi tiết một xe đã đăng ký.
 *
 * - Nút "Lưu trữ xe" gọi DELETE /api/v1/motorcycles/[id].
 * - Trong demo mode: xoá khỏi state local.
 * - Sau khi archive thành công: quay về danh sách.
 *
 * Hồ sơ xe đầy đủ (gói VIP):
 *  - Đọc LUÔN được phép — BE luôn trả `details` khi rider đã lưu, kể cả khi
 *    gói đã hết hạn (design decision D7: không xoá, không ẩn).
 *  - Ghi giá trị mới cần gói VIP; xoá (gửi `null`) luôn được phép (D14).
 */
export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vehicles, archiveVehicle, reloadVehicles } = useApp();
  const { user } = useAuth();
  const vehicle = vehicles.find((v) => v.id === id);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vipActive = hasVipPlan(user?.planCode);
  const details = vehicle?.details;

  const detailRows = VEHICLE_DETAIL_FIELDS.map((field) => {
    const value = details?.[field.key];
    return {
      key: field.key,
      label: field.label,
      value:
        value === undefined || value === null || value === ''
          ? null
          : field.kind === 'number'
            ? `${formatVND(Number(value))}`
            : field.kind === 'date'
              ? formatDate(String(value))
              : String(value),
    };
  }).filter((row) => row.value !== null);

  const hasDetails = detailRows.length > 0;

  // Refresh vehicles list when detail mounts so user sees latest data
  // (e.g. after editing another tab) without manual pull-to-refresh.
  useEffect(() => {
    reloadVehicles();
    // reloadVehicles intentionally not in deps — reference is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!vehicle) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Không tìm thấy xe" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="warning"
            title="Xe không tồn tại"
            description="Có thể xe đã được lưu trữ. Vui lòng quay lại danh sách xe."
          />
        </View>
      </SafeAreaView>
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
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title={vehicle.name}
        subtitle={`${vehicle.brand} · ${vehicle.year}`}
        onBack={() => router.back()}
      />
      <ScreenScroll>
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

        {/* Stats grid — không có "Số km" (BE cố ý không lưu km, D1). */}
        <View className="mt-5 flex-row flex-wrap gap-3">
          <StatTile
            icon={Palette}
            tone="green"
            label="Màu sắc"
            value={vehicle.color && vehicle.color !== '—' ? vehicle.color : 'Chưa cập nhật'}
          />
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

        {/* =========================================================
            Hồ sơ xe đầy đủ (gói VIP)
            ========================================================= */}
        <View className="mt-6">
          <SectionTitle
            icon={Shield}
            title="Hồ sơ xe đầy đủ"
            badge={vipActive ? 'VIP' : undefined}
          />

          {!vipActive && (
            <View className="mb-3">
              <Banner
                tone="info"
                title="Tính năng của gói VIP"
                description={
                  hasDetails
                    ? 'Gói VIP của bạn đã hết hạn hoặc chưa kích hoạt. Thông tin đã lưu vẫn còn và bạn vẫn có thể xoá, nhưng không thể thêm hoặc sửa.'
                    : 'Lưu số khung, số máy, ngày mua, giá mua, bảo hành và bảo hiểm để báo giá và nhắc bảo dưỡng chính xác hơn.'
                }
              />
            </View>
          )}

          {hasDetails ? (
            <Card className="mt-1 p-4">
              {detailRows.map((row, index) => (
                <View
                  key={row.key}
                  className={`flex-row items-start justify-between gap-3 py-2 ${
                    index < detailRows.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <Text className="text-xs text-muted-foreground">{row.label}</Text>
                  <Text
                    className="flex-1 text-right text-sm font-semibold text-foreground"
                    numberOfLines={2}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </Card>
          ) : (
            <Card className="mt-1 border-dashed bg-secondary/40 p-4">
              <Text className="text-center text-xs text-muted-foreground">
                Chưa có hồ sơ xe. Nhấn &quot;Chỉnh sửa hồ sơ&quot; để thêm thông tin chi tiết.
              </Text>
            </Card>
          )}

          <View className="mt-3">
            {vipActive ? (
              <ActionButton
                fullWidth
                variant="outline"
                onPress={() =>
                  router.push({ pathname: '/rider/vehicles/form', params: { id: vehicle.id } })
                }
                accessibilityLabel="Chỉnh sửa hồ sơ xe"
              >
                <Sparkles size={16} color="#16202f" />
                <Text className="text-sm font-semibold text-foreground">
                  Chỉnh sửa hồ sơ xe
                </Text>
              </ActionButton>
            ) : (
              <ActionButton
                fullWidth
                onPress={() => router.push('/rider/plans')}
                accessibilityLabel="Nâng cấp lên gói VIP"
              >
                <Sparkles size={16} color="#ffffff" />
                <Text className="text-sm font-semibold text-primary-foreground">
                  Nâng cấp lên VIP
                </Text>
              </ActionButton>
            )}
          </View>
        </View>

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
      </ScreenScroll>
    </SafeAreaView>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
}) {
  return (
    <View className="mb-2 flex-row items-center gap-2">
      <Icon size={18} color="#1974f7" />
      <Text className="text-base font-bold text-foreground">{title}</Text>
      {badge ? <Badge tone="amber">{badge}</Badge> : null}
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
