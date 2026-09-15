import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
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
  ShieldCheck,
  User,
} from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RowIcon, ToggleRow } from '@/components/ui/toggle-row';
import { cn } from '@/lib/utils';

export default function ProfileScreen() {
  const { user, vehicles, services, darkMode, toggleDarkMode } = useApp();
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState<'EN' | 'VI'>('EN');

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Profile" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        <Card className="overflow-hidden border-0 bg-navy">
          <View className="p-5">
            <View className="flex-row items-center gap-4">
              <Image source={{ uri: user.avatar }} className="size-16 rounded-full" resizeMode="cover" />
              <View className="flex-1">
                <Text className="text-lg font-bold text-white">{user.name}</Text>
                <View className="mt-1 flex-row items-center gap-1">
                  <Phone size={14} color="#ffffff" className="opacity-70" />
                  <Text className="text-sm text-white/70">{user.phone}</Text>
                </View>
              </View>
              <View className="size-9 items-center justify-center rounded-full bg-white/10">
                <Pencil size={16} color="#ffffff" />
              </View>
            </View>
            <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
              <ShieldCheck size={16} color="#a9ffad" />
              <Text className="text-xs text-white">CareOnRoad Plus member since 2024</Text>
            </View>
          </View>
        </Card>

        <View className="mt-5 flex-row gap-3">
          <Card className="flex-1 items-center p-4">
            <Text className="text-2xl font-bold text-primary">{vehicles.length}</Text>
            <Text className="text-xs text-muted-foreground">Vehicles</Text>
          </Card>
          <Card className="flex-1 items-center p-4">
            <Text className="text-2xl font-bold text-primary">{services.length}</Text>
            <Text className="text-xs text-muted-foreground">Services done</Text>
          </Card>
        </View>

        <View className="mt-5">
          <Text className="mb-3 font-bold text-foreground">Personal Information</Text>
          <Card className="divide-y divide-border">
            <Row icon={User} label="Full name" value={user.name} />
            <Row icon={Mail} label="Email" value={user.email} />
            <Row icon={Phone} label="Phone" value={user.phone} />
          </Card>
        </View>

        <View className="mt-5">
          <Text className="mb-3 font-bold text-foreground">Saved Addresses</Text>
          <Card className="divide-y divide-border">
            <AddressRow label="Home" value="124 Nguyen Van Cu, District 5" />
            <AddressRow label="Work" value="72 Le Thanh Ton, District 1" />
          </Card>
        </View>

        <View className="mt-5">
          <Text className="mb-3 font-bold text-foreground">Settings</Text>
          <Card className="divide-y divide-border">
            <ToggleRow
              icon={Bell}
              label="Notification Settings"
              checked={notifications}
              onChange={() => setNotifications((v) => !v)}
            />
            <LanguageRow
              language={language}
              onPress={() => setLanguage((l) => (l === 'EN' ? 'VI' : 'EN'))}
            />
            <ToggleRow icon={Moon} label="Dark Mode" checked={darkMode} onChange={toggleDarkMode} />
            <NavRow icon={LifeBuoy} label="Help Center" />
          </Card>
        </View>

        <ActionButton
          fullWidth
          variant="outline"
          className="mt-5"
          onPress={async () => {
            await AsyncStorage.removeItem('careonroad.role');
            router.replace('/');
          }}
        >
          <LogOut size={16} color="#ed3f3a" />
          <Text className="text-sm font-semibold text-destructive">Logout</Text>
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
    <Pressable onPress={onPress} className="flex-row items-center gap-3 p-4">
      <RowIcon icon={Languages} />
      <Text className="flex-1 text-sm font-medium text-foreground">Language</Text>
      <Badge tone="blue">
        <Text className="text-xs font-semibold text-primary">
          {language === 'EN' ? 'English' : 'Tiếng Việt'}
        </Text>
      </Badge>
    </Pressable>
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

function NavRow({
  icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Pressable className="flex-row items-center gap-3 p-4">
      <RowIcon icon={icon} />
      <Text className="flex-1 text-sm font-medium text-foreground">{label}</Text>
      <ChevronRight size={20} color="#64748b" />
    </Pressable>
  );
}
