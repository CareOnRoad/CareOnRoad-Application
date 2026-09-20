import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowRight,
  Bike,
  Bell,
  CalendarPlus,
  History,
  LucideIcon,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { useAuth } from '@/contexts/auth-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MaintenanceCard } from '@/components/maintenance-card';
import { SectionHeader } from '@/components/ui/form';
import { formatDate } from '@/lib/mock-data';
import { getUnreadCount } from '@/lib/notifications-service';

type QuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: 'destructive' | 'primary' | 'success' | 'warning';
  href: string;
};

const quickActions: QuickAction[] = [
  {
    id: 'rescue',
    label: 'Cứu hộ khẩn cấp',
    icon: Siren,
    tone: 'destructive',
    href: '/rider/(tabs)/rescue',
  },
  {
    id: 'schedule',
    label: 'Đặt lịch bảo dưỡng',
    icon: CalendarPlus,
    tone: 'primary',
    href: '/rider/(tabs)/schedule',
  },
  {
    id: 'vehicles',
    label: 'Xe của tôi',
    icon: Bike,
    tone: 'success',
    href: '/rider/(tabs)/vehicles',
  },
  {
    id: 'notifications',
    label: 'Thông báo',
    icon: Bell,
    tone: 'primary',
    href: '/rider/notifications',
  },
  {
    id: 'history',
    label: 'Lịch sử dịch vụ',
    icon: History,
    tone: 'warning',
    href: '/rider/history',
  },
];

const toneStyles: Record<QuickAction['tone'], { bg: string; fg: string }> = {
  destructive: { bg: 'bg-destructive/10', fg: '#ed3f3a' },
  primary: { bg: 'bg-primary/10', fg: '#1974f7' },
  success: { bg: 'bg-green/10', fg: '#145413' },
  warning: { bg: 'bg-amber-500/15', fg: '#d97706' },
};

/**
 * HomeScreen - dashboard cho rider.
 *
 * Layout:
 *  1. AppHeader: "Trang chủ" + greeting theo giờ.
 *  2. Stats cards tổng quan: tổng xe, dịch vụ đã làm, chi tiêu.
 *  3. Quick actions grid 2x2 - 4 chức năng chính.
 *  4. Maintenance reminder card - lấy xe sắp đến hạn bảo dưỡng gần nhất.
 *  5. Recent services - 2 dịch vụ gần nhất.
 *  6. Promo card (limited offer).
 */
export default function HomeScreen() {
  const { user: appUser, vehicles, services } = useApp();
  const { user: authUser } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const c = await getUnreadCount();
      setUnread(c);
    } catch {
      // im lặng
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    // Refresh mỗi 60s — phase 7 sẽ chuyển sang foreground refresh khi focus.
    const t = setInterval(() => void refreshUnread(), 60_000);
    return () => clearInterval(t);
  }, [refreshUnread]);

  // Ưu tiên tên từ auth session, fallback mock.
  const displayName = authUser?.name ?? appUser.name;
  const displayAvatar = authUser?.avatar ?? appUser.avatar;

  const upcoming = vehicles
    .slice()
    .sort(
      (a, b) =>
        new Date(a.nextMaintenance).getTime() - new Date(b.nextMaintenance).getTime(),
    )[0];
  const recent = services.filter((s) => s.status === 'completed').slice(0, 2);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Trang chủ"
        subtitle={greeting()}
        right={
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push('/rider/notifications')}
              accessibilityLabel="Mở thông báo"
              className="relative size-9 items-center justify-center rounded-full bg-secondary active:scale-95"
            >
              <Bell size={18} color="#16202f" />
              {unread > 0 && (
                <View className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5">
                  <Text className="text-[10px] font-bold text-destructive-foreground">
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push('/rider/(tabs)/profile')}
              accessibilityLabel="Mở hồ sơ"
              className="size-9 overflow-hidden rounded-full bg-secondary"
            >
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} className="size-full" resizeMode="cover" />
              ) : (
                <View className="size-full items-center justify-center">
                  <Text className="text-sm font-bold text-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero greeting card */}
        <Card className="overflow-hidden border-0 bg-navy">
          <View className="flex-row items-center justify-between p-5">
            <View className="flex-1">
              <Text className="text-sm text-white/70">Xin chào,</Text>
              <Text className="mt-0.5 text-2xl font-bold text-white">{displayName}</Text>
              <Text className="mt-1 text-xs text-white/60">Sẵn sàng cho hành trình hôm nay?</Text>
            </View>
            <View className="size-14 items-center justify-center rounded-2xl bg-brand-blue">
              <Bike size={28} color="#ffffff" />
            </View>
          </View>
          <View className="mx-5 mb-5 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5">
            <ShieldCheck size={16} color="#a9ffad" />
            <Text className="text-xs font-medium text-white">
              CareOnRoad Plus · hỗ trợ 24/7
            </Text>
          </View>
        </Card>

        {/* Quick stats */}
        <View className="mt-5">
          <SectionHeader title="Tổng quan" />
          <View className="flex-row gap-3">
            <StatTile
              icon={Bike}
              tone="blue"
              label="Xe đã đăng ký"
              value={vehicles.length.toString()}
            />
            <StatTile
              icon={Wrench}
              tone="green"
              label="Dịch vụ hoàn thành"
              value={services.length.toString()}
            />
            <StatTile
              icon={CalendarPlus}
              tone="amber"
              label="Lịch sắp tới"
              value={vehicles.length.toString()}
            />
          </View>
        </View>

        {/* Quick actions */}
        <View className="mt-6">
          <SectionHeader title="Hành động nhanh" subtitle="Bắt đầu yêu cầu chỉ với 1 chạm" />
          <View className="flex-row flex-wrap gap-3">
            {quickActions.map((a) => {
              const Icon = a.icon;
              const tone = toneStyles[a.tone];
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  onPress={() => router.push(a.href as never)}
                  className="w-[48%] active:scale-[0.97]"
                >
                  <Card className="p-4">
                    <View
                      className="mb-3 size-12 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${tone.fg}1a` }}
                    >
                      <Icon size={22} color={tone.fg} />
                    </View>
                    <Text className="text-sm font-semibold leading-tight text-foreground">
                      {a.label}
                    </Text>
                    <View className="mt-2 flex-row items-center gap-1">
                      <Text className="text-xs font-medium" style={{ color: tone.fg }}>
                        Mở
                      </Text>
                      <ArrowRight size={12} color={tone.fg} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Maintenance reminder */}
        {upcoming && (
          <View className="mt-6">
            <SectionHeader
              title="Nhắc bảo dưỡng"
              action="Đặt lịch ngay"
              onAction={() => router.push('/rider/(tabs)/schedule')}
            />
            <Card>
              <View className="flex-row items-center gap-3 p-4">
                <View className="size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
                  <Wrench size={24} color="#d97706" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold leading-tight text-foreground">
                    {upcoming.name} sắp đến hạn
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(upcoming.nextMaintenance)} · {upcoming.mileage.toLocaleString()} km
                  </Text>
                </View>
                <Badge tone="amber">
                  <Text className="text-xs font-semibold text-amber-600">Sắp đến</Text>
                </Badge>
              </View>
            </Card>
          </View>
        )}

        {/* Recent services */}
        <View className="mt-6">
          <SectionHeader
            title="Dịch vụ gần đây"
            action="Xem tất cả"
            onAction={() => router.push('/rider/history')}
          />
          {recent.length === 0 ? (
            <EmptyState
              icon={History}
              title="Chưa có dịch vụ nào"
              description="Các dịch vụ bạn đã hoàn thành sẽ hiển thị tại đây."
            />
          ) : (
            <View className="gap-3">
              {recent.map((r) => (
                <MaintenanceCard key={r.id} record={r} />
              ))}
            </View>
          )}
        </View>

        {/* Promo card */}
        <Card className="mt-6 overflow-hidden border-0 bg-green">
          <View className="flex-row items-center justify-between gap-3 p-5">
            <View className="flex-1">
              <View className="mb-2 self-start rounded-full bg-white/20 px-2.5 py-1">
                <Text className="text-xs font-semibold text-white">Ưu đãi có hạn</Text>
              </View>
              <Text className="text-balance text-lg font-bold leading-tight text-white">
                Giảm 30% lần thay nhớt đầu tiên
              </Text>
              <Text className="mt-1 text-sm text-white/85">
                Sử dụng mã CARE30 khi thanh toán.
              </Text>
              <ActionButton
                variant="mint"
                className="mt-3 self-start px-4 py-2"
                onPress={() => router.push('/rider/(tabs)/schedule')}
              >
                <Text className="text-sm font-semibold text-green">Đặt lịch ngay</Text>
                <ArrowRight size={16} color="#145413" />
              </ActionButton>
            </View>
            <Siren size={48} color="#ffffff" className="opacity-30" />
          </View>
        </Card>
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
  tone: 'blue' | 'green' | 'amber';
  label: string;
  value: string;
}) {
  const toneStyles = {
    blue: { bg: 'bg-primary/10', fg: '#1974f7' },
    green: { bg: 'bg-green/10', fg: '#145413' },
    amber: { bg: 'bg-amber-500/15', fg: '#d97706' },
  } as const;
  const s = toneStyles[tone];
  return (
    <Card className="flex-1 p-3">
      <View className="mb-2 size-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${s.fg}1a` }}>
        <Icon size={16} color={s.fg} />
      </View>
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      <Text className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</Text>
    </Card>
  );
}

/**
 * Lời chào theo giờ trong ngày.
 */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Chúc bạn ngủ ngon';
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}
