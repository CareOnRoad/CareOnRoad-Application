import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableFreeze } from 'react-native-screens';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import './global.css';

// Workaround cho warning "Couldn't find a navigation context" + crash khi bấm
// tab trong ScheduleScreen với NativeWind CssInterop + react-native-screens 4.5.0.
// enableFreeze(true) mặc định của react-native-screens gây race condition ngắn
// giữa Pressable mount và NavigationContainer context propagation → throw warning
// và crash app ở Expo Go dev mode.
// Gọi ngay tại top-level, trước khi bất kỳ NavigationContainer nào mount.
enableFreeze(false);

/**
 * Root layout - thiết lập providers cốt lõi và stack chính của app.
 * AuthProvider được đặt ngoài cùng để mọi màn hình (auth hoặc app) đều có thể
 * truy cập trạng thái đăng nhập.
 */
function RootNavigator() {
  const { status, role } = useAuth();

  // Khi session chưa hydrate xong, không điều hướng để tránh flash trang sai
  if (status === 'loading') {
    return null;
  }

  // Chưa đăng nhập → chỉ cho phép nhóm auth
  if (status === 'unauthenticated' || !role) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" />
      </Stack>
    );
  }

  // Đã đăng nhập → render 2 nhóm app; logic redirect sẽ chạy trong từng index
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="rider" />
      <Stack.Screen name="mechanic" />
    </Stack>
  );
}

/**
 * Guard đầu root: nếu user đang đăng nhập nhưng mở sai nhóm (ví dụ mechanic vào /rider)
 * thì redirect về nhóm đúng. Stack sẽ tự sinh route cho cả 2 nhóm để tránh crash.
 */
function RootRoleGuard() {
  const { status, role } = useAuth();
  if (status === 'authenticated' && !role) {
    return <Redirect href="/login" />;
  }
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AuthProvider>
          <RootRoleGuard />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
