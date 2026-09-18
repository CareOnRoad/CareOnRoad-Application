import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';

/**
 * Root entry - điều hướng dựa trên trạng thái auth và role của user:
 *  - Đang load session → hiển thị spinner.
 *  - Chưa đăng nhập → vào nhóm auth (login).
 *  - Rider → vào /rider.
 *  - Mechanic → vào /mechanic.
 *
 * Lưu ý: AppProvider/MechanicAppProvider đã được mount trong các layout tương ứng
 * để các context sẵn sàng ngay khi user được điều hướng vào nhóm tab.
 */
export default function RootIndex() {
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

  if (role === 'rider') return <Redirect href="/rider" />;
  return <Redirect href="/mechanic" />;
}
