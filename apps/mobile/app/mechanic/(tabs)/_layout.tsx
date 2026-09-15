import React from 'react';
import { MechanicAppProvider } from '@/contexts/mechanic-app-context';
import { Tabs } from 'expo-router';

export default function MechanicLayout() {
  return (
    <MechanicAppProvider>
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
        <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="jobs" options={{ title: 'Jobs' }} />
        <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </MechanicAppProvider>
  );
}
