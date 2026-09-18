import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { MechanicAppProvider } from '@/contexts/mechanic-app-context';

/**
 * Layout cho nhóm Mechanic - tương tự RiderLayout nhưng mount MechanicAppProvider
 * và yêu cầu role = mechanic.
 */
export default function MechanicLayout() {
  const { status, role } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-navy">
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (status === 'unauthenticated' || !role) {
    return <Redirect href="/login" />;
  }

  if (role !== 'mechanic') {
    return <Redirect href="/rider" />;
  }

  return (
    <MechanicAppProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="jobs/detail" options={{ headerShown: false }} />
      </Stack>
    </MechanicAppProvider>
  );
}
