import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Bike, RefreshCcw, Wrench } from 'lucide-react-native';

type Role = 'rider' | 'mechanic';

const STORAGE_KEY = 'careonroad.role';

export default function RolePicker() {
  const [role, setRole] = useState<Role | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'rider' || saved === 'mechanic') setRole(saved);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  const choose = (r: Role) => {
    setRole(r);
    AsyncStorage.setItem(STORAGE_KEY, r).catch(() => undefined);
    if (r === 'rider') router.replace('/rider/(tabs)');
    else router.replace('/mechanic/(tabs)');
  };

  const switchBack = () => {
    setRole(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  };

  if (!hydrated) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-navy">
        <ActivityIndicator color="#ffffff" />
      </SafeAreaView>
    );
  }

  if (role === 'rider') return <Redirect href="/rider/(tabs)" />;
  if (role === 'mechanic') return <Redirect href="/mechanic/(tabs)" />;

  return (
    <SafeAreaView className="flex-1 bg-navy px-5 py-8">
      <View className="mx-auto w-full max-w-[440px] flex-1 justify-center">
        <View className="mb-8 items-center">
          <View className="mb-4 rounded-full bg-white/10 px-3 py-1.5">
            <Text className="text-xs font-semibold text-white">CareOnRoad Demo</Text>
          </View>
          <Text className="mb-2 text-balance text-center text-3xl font-bold leading-tight text-white">
            Choose how you want to use the app
          </Text>
          <Text className="text-center text-sm text-white/70">
            You can switch any time from your profile.
          </Text>
        </View>

        <View className="gap-3">
          <RoleCard
            tone="blue"
            icon={<Bike size={28} color="#1974f7" />}
            title="I'm a Rider"
            subtitle="Emergency rescue, book maintenance, manage vehicles"
            onPress={() => choose('rider')}
          />
          <RoleCard
            tone="green"
            icon={<Wrench size={28} color="#a9ffad" />}
            title="I'm a Mechanic"
            subtitle="Manage jobs, schedule, customers and earnings"
            onPress={() => choose('mechanic')}
          />
        </View>

        <Text className="mt-8 text-center text-xs text-white/50">
          CareOnRoad · Prototype v1.0
        </Text>
      </View>
    </SafeAreaView>
  );
}

function RoleCard({
  tone,
  icon,
  title,
  subtitle,
  onPress,
}: {
  tone: 'blue' | 'green';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const toneStyles: Record<string, { bg: string; iconBg: string }> = {
    blue: { bg: 'bg-primary/15 ring-1 ring-primary/30', iconBg: 'bg-primary/15' },
    green: { bg: 'bg-green/15 ring-1 ring-mint/30', iconBg: 'bg-green/15' },
  };

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 active:scale-[0.98] ${toneStyles[tone].bg}`}
    >
      <View className="size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-lg font-bold text-white">{title}</Text>
        <Text className="text-sm text-white/70">{subtitle}</Text>
      </View>
      <ArrowRight size={20} color="#ffffff" className="opacity-60" />
    </Pressable>
  );
}

function RoleSwitchHint({ onSwitch }: { onSwitch: () => void }) {
  return (
    <Pressable
      onPress={onSwitch}
      className="absolute right-4 top-12 z-50 flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 active:opacity-60"
    >
      <RefreshCcw size={14} color="#ffffff" />
      <Text className="text-xs font-semibold text-white">Switch role</Text>
    </Pressable>
  );
}
