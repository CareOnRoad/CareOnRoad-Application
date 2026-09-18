import React, { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Bell,
  ChevronRight,
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
  User,
} from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { useAuth } from '@/contexts/auth-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NavRow, RowIcon, ToggleRow } from '@/components/ui/toggle-row';

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
 *  7. Switch role + Logout buttons.
 */
export default function ProfileScreen() {
  const { vehicles, services, darkMode, toggleDarkMode } = useApp();
  const { user: authUser, logout, switchRoleDemo, isBackendConfigured } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState<'EN' | 'VI'>('VI');

  const user = {
    name: authUser?.name ?? 'Nguyễn Văn An',
    phone: authUser?.phone ?? '+84 90 555 1234',
    email: authUser?.email ?? 'an.nguyen@email.com',
    avatar: authUser?.avatar ?? 'https://i.pravatar.cc/200?img=15',
  };

  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const onSwitchRole = async () => {
    if (!isBackendConfigured) {
      // Trong demo mode: switch role bằng cách swap local account.
      await switchRoleDemo();
      router.replace('/mechanic');
    } else {
      // Production: cần logout + login với tài khoản khác.
      router.replace('/login');
    }
  };

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
              <View className="size-9 items-center justify-center rounded-full bg-white/10">
                <Pencil size={14} color="#ffffff" />
              </View>
            </View>
            <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
              <ShieldCheck size={16} color="#a9ffad" />
              <Text className="text-xs text-white">CareOnRoad Plus · thành viên từ 2024</Text>
            </View>
          </View>
        </Card>

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

        {/* Personal info */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Thông tin cá nhân
          </Text>
          <Card className="divide-y divide-border">
            <InfoRow icon={User} label="Họ và tên" value={user.name} />
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow icon={Phone} label="Số điện thoại" value={user.phone} />
          </Card>
        </View>

        {/* Saved addresses */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Địa chỉ đã lưu
          </Text>
          <Card className="divide-y divide-border">
            <AddressRow label="Nhà" value="124 Nguyễn Văn Cừ, Quận 5" />
            <AddressRow label="Công ty" value="72 Lê Thánh Tôn, Quận 1" />
          </Card>
        </View>

        {/* Settings */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Cài đặt
          </Text>
          <Card className="divide-y divide-border">
            <ToggleRow
              icon={Bell}
              label="Thông báo"
              description="Nhắc lịch, cập nhật thợ và khuyến mãi"
              checked={notifications}
              onChange={() => setNotifications((v) => !v)}
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

        {/* Switch role - chỉ demo */}
        {!isBackendConfigured && (
          <ActionButton
            fullWidth
            variant="outline"
            className="mt-6"
            onPress={onSwitchRole}
            accessibilityLabel="Chuyển sang vai trò thợ sửa xe"
          >
            <RefreshCcw size={16} color="#1974f7" />
            <Text className="text-sm font-semibold text-primary">Chuyển sang Mechanic</Text>
          </ActionButton>
        )}

        <ActionButton
          fullWidth
          variant="outline"
          className="mt-3 border-destructive/30"
          onPress={onLogout}
          accessibilityLabel="Đăng xuất"
        >
          <LogOut size={16} color="#ed3f3a" />
          <Text className="text-sm font-semibold text-destructive">Đăng xuất</Text>
        </ActionButton>

        <Text className="mt-6 text-center text-xs text-muted-foreground">
          CareOnRoad · Prototype v1.0
        </Text>
      </ScrollView>
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

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <RowIcon icon={MapPin} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        <Text className="truncate text-xs text-muted-foreground">{value}</Text>
      </View>
      <ChevronRight size={20} color="#64748b" />
    </View>
  );
}
