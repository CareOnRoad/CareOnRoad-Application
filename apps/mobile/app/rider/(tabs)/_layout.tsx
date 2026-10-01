import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bike,
  CalendarPlus,
  Home,
  LucideIcon,
  Siren,
  User as UserIcon,
} from 'lucide-react-native';

/**
 * Tabs của Rider - chỉ render Tabs, AppProvider được mount ở layout cha
 * (`app/rider/_layout.tsx`) để tránh nested Provider và đảm bảo state dùng
 * được xuyên suốt cả nhóm rider.
 *
 * - Mỗi tab có icon riêng (lucide) để người dùng nhận diện nhanh.
 * - paddingBottom của tab bar lấy theo bottom safe-area inset (gesture/nav bar),
 *   tránh icon bị che bởi system bar.
 */
const tabIcons: Record<string, LucideIcon> = {
  index: Home,
  vehicles: Bike,
  rescue: Siren,
  schedule: CalendarPlus,
  profile: UserIcon,
};

function makeTabBarIcon(iconName: keyof typeof tabIcons) {
  const Icon = tabIcons[iconName];
  const TabBarIcon = ({ color, size }: { color: string; size: number }) => (
    <Icon color={color} size={size} strokeWidth={2} />
  );
  TabBarIcon.displayName = `TabBarIcon_${iconName}`;
  return TabBarIcon;
}

export default function RiderTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1974f7',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          borderTopColor: '#e2e8f0',
          backgroundColor: '#ffffff',
          paddingTop: 6,
          paddingBottom: 6 + bottomInset,
          height: 60 + bottomInset,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: makeTabBarIcon('index') }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{ title: 'Vehicles', tabBarIcon: makeTabBarIcon('vehicles') }}
      />
      <Tabs.Screen
        name="rescue"
        options={{ title: 'Rescue', tabBarIcon: makeTabBarIcon('rescue') }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Schedule', tabBarIcon: makeTabBarIcon('schedule') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: makeTabBarIcon('profile') }}
      />
    </Tabs>
  );
}
