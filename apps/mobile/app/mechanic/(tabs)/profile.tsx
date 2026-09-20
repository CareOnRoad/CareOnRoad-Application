import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Award,
  Bell,
  Languages,
  LifeBuoy,
  LogOut,
  LucideIcon,
  Mail,
  MapPin,
  Moon,
  Pencil,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Star,
  TrendingUp,
  Wrench,
} from 'lucide-react-native';

import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { useAuth } from '@/contexts/auth-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EditProfileSheet } from '@/components/ui/edit-profile-sheet';
import { NavRow, RowIcon, ToggleRow } from '@/components/ui/toggle-row';
import { cn } from '@/lib/utils';
import { formatVND } from '@/lib/mock-data';
import { loadProfile, type LocalProfile } from '@/lib/profile-service';

const languageCopy = { EN: 'English', VI: 'Tiếng Việt' } as const;

/**
 * MechanicProfileScreen - hồ sơ cá nhân + thống kê + cài đặt.
 *
 * Hero card navy có avatar, rating, garage info.
 * Stats cards: total jobs, rating, this month earnings.
 * Các phần: Garage, Certifications, Settings, Switch role, Logout.
 */
export default function MechanicProfileScreen() {
  const { mechanic, garage, earnings, darkMode, toggleDarkMode } = useMechanicApp();
  const { user: authUser, logout, switchRoleDemo, isBackendConfigured } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState<'EN' | 'VI'>('VI');
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [localProfile, setLocalProfile] = useState<LocalProfile | null>(null);

  // Load profile local (sửa được từ EditProfileSheet)
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

  const handleConfirmLogout = async () => {
    setLogoutError(null);
    setLoggingOut(true);
    try {
      await logout();
      setLogoutDialogOpen(false);
      setLoggingOut(false);
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

  const onSwitchRole = async () => {
    if (!isBackendConfigured) {
      await switchRoleDemo();
      router.replace('/rider');
    } else {
      router.replace('/login');
    }
  };

  const displayName = localProfile?.name ?? authUser?.name ?? mechanic.name;
  const displayAvatar =
    localProfile?.avatar ?? authUser?.avatar ?? mechanic.avatar;
  const displayPhone = localProfile?.phone ?? authUser?.phone ?? garage.phone;
  const displayEmail =
    localProfile?.email ?? authUser?.email ?? 'quan@quansgarage.vn';
  const handleProfileSaved = (profile: LocalProfile) => {
    setLocalProfile(profile);
  };
  const delta = earnings.lastWeek > 0
    ? ((earnings.thisWeek - earnings.lastWeek) / earnings.lastWeek) * 100
    : 0;
  const isUp = delta >= 0;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Hồ sơ" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Card className="overflow-hidden border-0 bg-navy">
          <View className="p-5">
            <View className="flex-row items-center gap-4">
              <View className="size-16 overflow-hidden rounded-full border-2 border-white/20">
                <Image
                  source={{ uri: displayAvatar }}
                  className="size-full"
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-white">{displayName}</Text>
                <Text className="text-xs text-white/70">{mechanic.specialty}</Text>
                <View className="mt-1.5 flex-row items-center gap-1.5">
                  <Badge tone="green">
                    <Text className="text-[10px] font-semibold text-white">Mechanic</Text>
                  </Badge>
                </View>
                <View className="mt-1 flex-row items-center gap-1">
                  <Star size={14} color="#a9ffad" fill="#a9ffad" />
                  <Text className="text-xs font-bold text-white">{mechanic.rating}</Text>
                  <Text className="text-xs text-white/60">· {mechanic.totalJobs} công việc</Text>
                </View>
                <View className="mt-1 flex-row items-center gap-1">
                  <Phone size={11} color="#ffffff" className="opacity-70" />
                  <Text className="text-[11px] text-white/70">{displayPhone}</Text>
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
            <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
              <ShieldCheck size={16} color="#a9ffad" />
              <Text className="text-xs text-white">
                {garage.name} · {mechanic.experienceYears} năm kinh nghiệm
              </Text>
            </View>
          </View>
        </Card>

        {/* Stats */}
        <View className="mt-5 flex-row gap-3">
          <StatTile
            icon={Wrench}
            tone="blue"
            label="Tổng công việc"
            value={mechanic.totalJobs.toString()}
          />
          <StatTile
            icon={Star}
            tone="green"
            label="Đánh giá"
            value={mechanic.rating.toString()}
          />
          <StatTile
            icon={TrendingUp}
            tone="amber"
            label="Tháng này"
            value={formatVND(earnings.thisMonth)}
            small
          />
        </View>

        {/* Earnings trend */}
        <Card className="mt-5 p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-10 shrink-0 items-center justify-center rounded-2xl bg-green/10">
              <TrendingUp size={20} color="#145413" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-xs text-muted-foreground">Tuần này so với tuần trước</Text>
              <Text className="font-bold text-foreground">
                {isUp ? '+' : ''}
                {formatVND(earnings.thisWeek - earnings.lastWeek)}
              </Text>
            </View>
            <Badge tone={isUp ? 'green' : 'red'}>
              <Text className={cn('text-xs font-semibold', isUp ? 'text-green' : 'text-destructive')}>
                {isUp ? '+' : ''}
                {delta.toFixed(1)}%
              </Text>
            </Badge>
          </View>
        </Card>

        {/* Garage info */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Garage
          </Text>
          <Card className="divide-y divide-border">
            <Row icon={MapPin} label="Địa chỉ" value={garage.address} />
            <Row icon={Phone} label="Hotline" value={garage.phone} />
            <Row icon={Mail} label="Email liên hệ" value={displayEmail} />
          </Card>
        </View>

        {/* Certifications */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Chứng chỉ
          </Text>
          <View className="gap-2">
            {mechanic.certifications.map((c) => (
              <Card key={c} className="flex-row items-center gap-3 p-3">
                <RowIcon icon={Award} tone="blue" />
                <Text className="flex-1 text-sm font-medium text-foreground">{c}</Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Cài đặt
          </Text>
          <Card className="divide-y divide-border">
            <ToggleRow
              icon={Bell}
              label="Thông báo công việc"
              description="Báo khi có offer mới hoặc việc được ghép"
              checked={notifications}
              onChange={() => setNotifications((v) => !v)}
            />
            <LanguageRow
              language={language}
              onPress={() => setLanguage((l) => (l === 'EN' ? 'VI' : 'EN'))}
            />
            <ToggleRow
              icon={Moon}
              label="Chế độ tối"
              description="Giao diện dịu mắt"
              checked={darkMode}
              onChange={toggleDarkMode}
            />
            <NavRow
              icon={LifeBuoy}
              label="Trung tâm hỗ trợ"
              right={<Text className="text-xs text-muted-foreground">›</Text>}
            />
          </Card>
        </View>

        {!isBackendConfigured && (
          <ActionButton
            fullWidth
            variant="outline"
            className="mt-6"
            onPress={onSwitchRole}
            accessibilityLabel="Chuyển sang vai trò Rider"
          >
            <RefreshCcw size={16} color="#1974f7" />
            <Text className="text-sm font-semibold text-primary">Chuyển sang Rider</Text>
          </ActionButton>
        )}

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
          CareOnRoad Mechanic · Prototype v1.0
        </Text>
      </ScrollView>

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
        userId={authUser?.id ?? ''}
        initialName={displayName}
        initialEmail={displayEmail}
        initialPhone={displayPhone}
        initialAvatar={displayAvatar}
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
      description={languageCopy[language]}
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

function Row({
  icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <RowIcon icon={icon} />
      <View className="min-w-0 flex-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className="truncate text-sm font-medium text-foreground">{value}</Text>
      </View>
    </View>
  );
}

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  small,
}: {
  icon: LucideIcon;
  tone: 'blue' | 'green' | 'amber';
  label: string;
  value: string;
  small?: boolean;
}) {
  const toneStyles = {
    blue: { bg: 'bg-primary/10', fg: '#1974f7' },
    green: { bg: 'bg-green/10', fg: '#145413' },
    amber: { bg: 'bg-amber-500/15', fg: '#d97706' },
  } as const;
  const s = toneStyles[tone];
  return (
    <Card className="flex-1 items-center p-3">
      <View
        className="mb-2 size-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${s.fg}1a` }}
      >
        <Icon size={16} color={s.fg} />
      </View>
      <Text className={cn('font-bold text-foreground', small ? 'text-sm leading-tight' : 'text-xl')}>
        {value}
      </Text>
      <Text className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</Text>
    </Card>
  );
}