import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  ChevronRight,
  Crown,
  Languages,
  LifeBuoy,
  LogOut,
  LucideIcon,
  Mail,
  MapPin,
  Moon,
  Pencil,
  Phone,
  User,
} from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { useAuth } from '@/contexts/auth-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { SectionHeader } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EditProfileSheet } from '@/components/ui/edit-profile-sheet';
import { HeroCard } from '@/components/ui/hero-card';
import { PlanBadge } from '@/components/ui/plan-badge';
import { NavRow, RowIcon, ToggleRow } from '@/components/ui/toggle-row';
import { loadProfile, type LocalProfile } from '@/lib/profile-service';
import { formatPlanExpiry, planLabel } from '@/lib/subscriptions-service';

/**
 * ProfileScreen - hồ sơ cá nhân + cài đặt của rider.
 *
 * Layout:
 *  1. AppHeader
 *  2. Hero card navy: avatar, tên, role badge, điểm thành viên.
 *  3. Stat cards: số xe + số dịch vụ đã dùng.
 *  4. Personal info card (avatar/email/phone rows).
 *  5. Saved addresses card.
 *  6. Settings card (notifications, language, dark mode, help).
 *  7. Logout button.
 */
export default function ProfileScreen() {
  const { vehicles, services, darkMode, toggleDarkMode, user: appUser } = useApp();
  const {
    user: authUser,
    refreshActor,
    logout,
  } = useAuth();
  const [language, setLanguage] = useState<'EN' | 'VI'>('VI');
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  // Profile local (sửa được từ EditProfileSheet) override giá trị từ authUser.
  const [localProfile, setLocalProfile] = useState<LocalProfile | null>(null);

  // Load profile local khi mount hoặc khi user đổi
  const reloadLocalProfile = useCallback(async () => {
    if (!authUser?.id) {
      setLocalProfile(null);
      return;
    }
    const stored = await loadProfile(authUser.id);
    setLocalProfile(stored);
  }, [authUser?.id]);

  useEffect(() => {
    reloadLocalProfile();
  }, [reloadLocalProfile]);

  // Gói hiện tại phải khớp backend: mỗi lần vào tab Profile (vd sau khi
  // thanh toán gói ở màn "Gói của tôi", hoặc admin cấp gói) → đọc lại actor.
  useFocusEffect(
    useCallback(() => {
      void refreshActor();
    }, [refreshActor]),
  );

  const user = {
    name: localProfile?.name ?? authUser?.name ?? '',
    phone: localProfile?.phone ?? authUser?.phone ?? '',
    email: localProfile?.email ?? authUser?.email ?? '',
    avatar:
      localProfile?.avatar ?? authUser?.avatar ?? '',
    address:
      localProfile?.address ?? authUser?.address ?? appUser.address ?? '',
  };

  // Gói hiện tại lấy từ actor backend (đã refresh sau khi mua gói).
  const currentPlan = authUser?.planCode ?? 'free';
  const currentPlanExpiryText = formatPlanExpiry(authUser?.planExpiresAt);

  // Mọi vùng hiển thị gói đều mở màn hình "Gói của tôi" (catalog + modal mua).
  const openPlans = useCallback(() => {
    router.push('/rider/plans');
  }, []);

  const handleProfileSaved = (profile: LocalProfile) => {
    setLocalProfile(profile);
  };

  const handleConfirmLogout = async () => {
    setLogoutError(null);
    setLoggingOut(true);
    try {
      await logout();
      // Reset dialog state trước khi điều hướng để tránh flicker.
      setLogoutDialogOpen(false);
      setLoggingOut(false);
      // Dùng replace để user không bấm Back quay lại màn hình đã logout.
      router.replace('/login');
    } catch (err) {
      setLogoutError(
        err instanceof Error ? err.message : 'Đăng xuất thất bại. Vui lòng thử lại.',
      );
      setLoggingOut(false);
    }
  };

  const openLogoutDialog = () => {
    setLogoutError(null);
    setLogoutDialogOpen(true);
  };

  const cancelLogout = () => {
    if (loggingOut) return;
    setLogoutDialogOpen(false);
    setLogoutError(null);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Hồ sơ" />
      <ScreenScroll>
        {/* Hero */}
        <HeroCard>
          <View className="flex-row items-center gap-4">
              <View className="size-16 overflow-hidden rounded-full border-2 border-white/20">
                <Image
                  source={{ uri: user.avatar }}
                  className="size-full"
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-white">{user.name}</Text>
                <View className="mt-0.5 flex-row items-center gap-1">
                  <Phone size={12} color="#ffffff" className="opacity-70" />
                  <Text className="text-xs text-white/70">{user.phone}</Text>
                </View>
                <View className="mt-1.5 flex-row items-center gap-1.5">
                  <Badge tone="blue">
                    <Text className="text-[10px] font-semibold text-primary">Rider</Text>
                  </Badge>
                </View>
              </View>
              <Pressable
                onPress={() => setEditProfileOpen(true)}
                accessibilityLabel="Sửa hồ sơ"
                accessibilityRole="button"
                className="size-9 items-center justify-center rounded-full bg-white/10 active:scale-95"
              >
                <Pencil size={14} color="#ffffff" />
              </Pressable>
            </View>
            <Pressable
              onPress={openPlans}
              accessibilityRole="button"
              accessibilityLabel="Xem và nâng cấp gói của bạn"
              className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 active:bg-white/20"
            >
              <Crown size={16} color="#a9ffad" />
              <Text className="flex-1 text-xs text-white">
                {currentPlanExpiryText
                  ? `Gói ${planLabel(authUser?.planCode)} · hết hạn ${currentPlanExpiryText}`
                  : `Gói ${planLabel(authUser?.planCode)} · Nâng cấp để mở nhắc bảo dưỡng & chi tiết xe VIP`}
              </Text>
              <ChevronRight size={16} color="#a9ffad" />
            </Pressable>
        </HeroCard>

        {/* Stats */}
        <View className="mt-5 flex-row gap-3">
          <Card className="flex-1 items-center p-4">
            <Text className="text-2xl font-bold text-primary">{vehicles.length}</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">Xe đã đăng ký</Text>
          </Card>
          <Card className="flex-1 items-center p-4">
            <Text className="text-2xl font-bold text-green">{services.length}</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">Dịch vụ đã dùng</Text>
          </Card>
        </View>

        {/* Gói của tôi */}
        <View className="mt-6">
          <SectionHeader title="Gói của tôi" />
          <Card>
            <Pressable
              onPress={openPlans}
              accessibilityRole="button"
              accessibilityLabel="Xem và nâng cấp gói của bạn"
              className="flex-row items-center justify-between p-4 active:bg-secondary/40"
            >
              <View className="flex-1">
                <Text className="text-sm text-muted-foreground">Gói đang dùng</Text>
                <Text className="mt-1 text-lg font-bold text-foreground">
                  {planLabel(currentPlan)}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <PlanBadge plan={currentPlan} />
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>

            <Pressable
              onPress={openPlans}
              accessibilityRole="button"
              accessibilityLabel="Xem và nâng cấp gói của bạn"
              className="px-4 pb-1 active:bg-secondary/40"
            >
              <Text className="text-xs text-muted-foreground">
                {currentPlanExpiryText
                  ? `Gói hiện tại có hiệu lực đến ${currentPlanExpiryText}.`
                  : 'Gói Free không có thời hạn. Nâng cấp để mở nhắc bảo dưỡng định kỳ và chi tiết xe VIP.'}
              </Text>
            </Pressable>

            <NavRow
              icon={Crown}
              label="Quản lý gói"
              description="Xem tất cả gói và thanh toán"
              right={<ChevronRight size={20} color="#64748b" />}
              onPress={openPlans}
            />
          </Card>
        </View>

        {/* Personal info */}
        <View className="mt-6">
          <SectionHeader title="Thông tin cá nhân" />
          <Card className="divide-y divide-border">
            <InfoRow icon={User} label="Họ và tên" value={user.name} />
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow icon={Phone} label="Số điện thoại" value={user.phone} />
          </Card>
        </View>

        {/* Saved addresses */}
        <View className="mt-6">
          <SectionHeader title="Địa chỉ đã lưu" />
          <Card className="divide-y divide-border">
            <AddressRow
              label="Địa chỉ chính"
              value={user.address || 'Chưa cập nhật — nhấn Sửa hồ sơ để thêm'}
              empty={!user.address}
            />
          </Card>
        </View>

        {/* Settings */}
        <View className="mt-6">
          <SectionHeader title="Cài đặt" />
          <Card className="divide-y divide-border">
            <NavRow
              icon={Bell}
              label="Thông báo"
              description="Nhắc lịch, cập nhật thợ và khuyến mãi"
              right={<ChevronRight size={20} color="#64748b" />}
              onPress={() => router.push('/rider/notifications')}
            />
            <LanguageRow language={language} onPress={() => setLanguage((l) => (l === 'EN' ? 'VI' : 'EN'))} />
            <ToggleRow
              icon={Moon}
              label="Chế độ tối"
              description="Giao diện dịu mắt cho buổi tối"
              checked={darkMode}
              onChange={toggleDarkMode}
            />
            <NavRow icon={LifeBuoy} label="Trung tâm hỗ trợ" right={<ChevronRight size={20} color="#64748b" />} />
          </Card>
        </View>

        <ActionButton
          fullWidth
          variant="outline"
          className="mt-3 border-destructive/30"
          onPress={openLogoutDialog}
          accessibilityLabel="Đăng xuất"
        >
          <LogOut size={16} color="#ed3f3a" />
          <Text className="text-sm font-semibold text-destructive">Đăng xuất</Text>
        </ActionButton>

        <Text className="mt-6 text-center text-xs text-muted-foreground">
          CareOnRoad · Prototype v1.0
        </Text>
      </ScreenScroll>

      <ConfirmDialog
        visible={logoutDialogOpen}
        title="Đăng xuất khỏi CareOnRoad?"
        description={
          logoutError
            ? logoutError
            : 'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng ứng dụng.'
        }
        confirmLabel="Đăng xuất"
        cancelLabel="Huỷ"
        tone="destructive"
        loading={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={cancelLogout}
      />

      <EditProfileSheet
        visible={editProfileOpen}
        initialName={user.name}
        initialEmail={user.email}
        initialPhone={user.phone}
        initialAddress={user.address}
        initialAvatar={user.avatar}
        onClose={() => setEditProfileOpen(false)}
        onSaved={handleProfileSaved}
      />
    </View>
  );
}

function LanguageRow({ language, onPress }: { language: 'EN' | 'VI'; onPress: () => void }) {
  return (
    <NavRow
      icon={Languages}
      label="Ngôn ngữ"
      description={language === 'VI' ? 'Tiếng Việt' : 'English'}
      onPress={onPress}
      right={
        <Badge tone="blue">
          <Text className="text-xs font-semibold text-primary">
            {language === 'EN' ? 'EN' : 'VI'}
          </Text>
        </Badge>
      }
    />
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <RowIcon icon={Icon} />
      <View className="min-w-0 flex-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className="truncate text-sm font-medium text-foreground">{value}</Text>
      </View>
    </View>
  );
}

function AddressRow({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <RowIcon icon={MapPin} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        <Text
          className={
            empty
              ? 'truncate text-xs italic text-muted-foreground'
              : 'truncate text-xs text-muted-foreground'
          }
        >
          {value}
        </Text>
      </View>
      <ChevronRight size={20} color="#64748b" />
    </View>
  );
}
