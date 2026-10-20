import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';

export default function AuthLayout() {
  const { status, role } = useAuth();

  // Stack không tự rời nhóm (auth) khi auth state đổi, nên mọi đường vào app
  // (login, register, Google OAuth deep-link) đều chuyển màn tại đây theo role.
  if (status === 'authenticated' && role) {
    return <Redirect href={role === 'mechanic' ? '/mechanic' : '/rider'} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#16202f' },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
