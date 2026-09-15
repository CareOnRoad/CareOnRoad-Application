import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Phone,
  RefreshCcw,
  ShieldCheck,
  Star,
  TrendingUp,
} from 'lucide-react-native';
import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RowIcon, ToggleRow } from '@/components/ui/toggle-row';
import { cn } from '@/lib/utils';
import { formatVND } from '@/lib/mock-data';

export default function MechanicProfileScreen() {
  const { mechanic, garage, earnings, darkMode, toggleDarkMode } = useMechanicApp();
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
              <Image source={{ uri: mechanic.avatar }} className="size-16 rounded-full" resizeMode="cover" />
              <View className="flex-1">
                <Text className="text-lg font-bold text-white">{mechanic.name}</Text>
                <Text className="text-xs text-white/70">{mechanic.specialty}</Text>
                <View className="mt-1 flex-row items-center gap-1">
                  <Star size={14} color="#a9ffad" fill="#a9ffad" />
                  <Text className="text-xs font-semibold text-white">{mechanic.rating}</Text>
                  <Text className="text-xs text-white/60">· {mechanic.totalJobs} jobs</Text>
                </View>
              </View>
            </View>
            <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
              <ShieldCheck size={16} color="#a9ffad" />
              <Text className="text-xs text-white">
                {garage.name} · {mechanic.experienceYears} years experience
              </Text>
            </View>
          </View>
        </Card>

        <View className="mt-5 flex-row gap-2">
          <StatTile label="Total jobs" value={mechanic.totalJobs.toString()} tone="blue" />
          <StatTile label="Rating" value={mechanic.rating.toString()} tone="green" />
          <StatTile label="This month" value={formatVND(earnings.thisMonth)} tone="amber" small />
        </View>

        <Card className="mt-5 p-4">
          <View className="flex-row items-center gap-2">
            <View className="size-10 shrink-0 items-center justify-center rounded-2xl bg-green/10">
              <TrendingUp size={20} color="#145413" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-xs text-muted-foreground">This week vs last</Text>
              <Text className="font-bold text-foreground">
                +{formatVND(earnings.thisWeek - earnings.lastWeek)}
              </Text>
            </View>
            <Badge tone="green">
              <Text className="text-xs font-semibold text-green">
                +
                {(((earnings.thisWeek - earnings.lastWeek) / Math.max(earnings.lastWeek, 1)) * 100).toFixed(1)}%
              </Text>
            </Badge>
          </View>
        </Card>

        <View className="mt-5">
          <Text className="mb-3 font-bold text-foreground">Garage</Text>
          <Card className="divide-y divide-border">
            <Row icon={MapPin} label="Address" value={garage.address} />
            <Row icon={Phone} label="Garage phone" value={garage.phone} />
            <Row icon={Mail} label="Contact email" value="quan@quansgarage.vn" />
          </Card>
        </View>

        <View className="mt-5">
          <Text className="mb-3 font-bold text-foreground">Certifications</Text>
          <View className="gap-2">
            {mechanic.certifications.map((c) => (
              <Card key={c} className="flex-row items-center gap-3 p-3">
                <View className="size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Award size={16} color="#1974f7" />
                </View>
                <Text className="flex-1 text-sm font-medium text-foreground">{c}</Text>
              </Card>
            ))}
          </View>
        </View>

        <View className="mt-5">
          <Text className="mb-3 font-bold text-foreground">Settings</Text>
          <Card className="divide-y divide-border">
            <ToggleRow
              icon={Bell}
              label="Job notifications"
              checked={notifications}
              onChange={() => setNotifications((v) => !v)}
            />
            <LanguageRow language={language} onPress={() => setLanguage((l) => (l === 'EN' ? 'VI' : 'EN'))} />
            <ToggleRow icon={Moon} label="Dark Mode" checked={darkMode} onChange={toggleDarkMode} />
            <HelpCenterRow />
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
          <RefreshCcw size={16} color="#16202f" />
          <Text className="text-sm font-semibold text-foreground">Switch to Rider view</Text>
        </ActionButton>

        <ActionButton fullWidth variant="outline" className="mt-3">
          <LogOut size={16} color="#ed3f3a" />
          <Text className="text-sm font-semibold text-destructive">Logout</Text>
        </ActionButton>

        <Text className="mt-6 text-center text-xs text-muted-foreground">
          CareOnRoad Mechanic · Prototype v1.0
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

function HelpCenterRow() {
  return (
    <Pressable className="flex-row items-center gap-3 p-4">
      <RowIcon icon={LifeBuoy} />
      <Text className="flex-1 text-sm font-medium text-foreground">Help Center</Text>
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

function StatTile({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'amber';
  small?: boolean;
}) {
  const toneStyles = {
    blue: 'bg-primary/10',
    green: 'bg-green/10',
    amber: 'bg-amber-500/15',
  };
  const iconColor = {
    blue: '#1974f7',
    green: '#145413',
    amber: '#d97706',
  };
  return (
    <Card className="flex-1 items-center p-3">
      <View className={`size-8 items-center justify-center rounded-xl ${toneStyles[tone]}`}>
        <Star size={16} color={iconColor[tone]} />
      </View>
      <Text className={cn('mt-2 font-bold text-foreground', small ? 'text-sm leading-tight' : 'text-xl')}>
        {value}
      </Text>
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
    </Card>
  );
}
