import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { AppProvider } from '@/contexts/app-context';
import { ActiveRequestProvider } from '@/contexts/active-request-context';

/**
 * Layout cho nhóm Rider:
 *  - Đảm bảo user đã đăng nhập với role = rider.
 *  - Nếu chưa đăng nhập → redirect về login.
 *  - Nếu đăng nhập nhưng role khác → redirect sang nhóm đúng.
 *  - Mount AppProvider để các màn hình con dùng được state chung.
 */
export default function RiderLayout() {
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

  if (role !== 'rider') {
    return <Redirect href="/mechanic" />;
  }

  return (
    <ActiveRequestProvider>
      <AppProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="vehicles/form" options={{ headerShown: false }} />
          <Stack.Screen name="vehicles/detail" options={{ headerShown: false }} />
          <Stack.Screen name="schedule/booking" options={{ headerShown: false }} />
          <Stack.Screen name="schedule/confirmed" options={{ headerShown: false }} />
          <Stack.Screen name="history" options={{ headerShown: false }} />
          <Stack.Screen name="rescue/[requestId]" options={{ headerShown: false }} />
          <Stack.Screen name="payments/index" options={{ headerShown: false }} />
          <Stack.Screen name="payments/[quoteId]" options={{ headerShown: false }} />
          <Stack.Screen name="review" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
        </Stack>
      </AppProvider>
    </ActiveRequestProvider>
  );
}
