import React from 'react';
import { Tabs } from 'expo-router';

/**
 * Tabs của Rider - chỉ render Tabs, AppProvider được mount ở layout cha
 * (`app/rider/_layout.tsx`) để tránh nested Provider và đảm bảo state dùng
 * được xuyên suốt cả nhóm rider.
 */
export default function RiderTabsLayout() {
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
          paddingBottom: 18,
          height: 76,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Vehicles' }} />
      <Tabs.Screen name="rescue" options={{ title: 'Rescue' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
