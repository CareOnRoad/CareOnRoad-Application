import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import {
  Bike,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from 'lucide-react-native';

import { useAuth } from '@/contexts/auth-context';
import { Banner } from '@/components/ui/banner';
import { cn } from '@/lib/utils';

/**
 * Màn hình đăng nhập.
 *
 * Design principles:
 *  - Nền navy + glassmorphism cards → brand identity cho toàn auth flow.
 *  - Alerts đỏ (Banner tone="error") khi login thất bại.
 *  - Nút primary CTA = brand-blue (#1974f7), không bị mờ đi khi đang submit.
 *  - Chỉ đăng nhập bằng email/password. Đăng nhập Google (Supabase OAuth)
 *    đã được gỡ khỏi giao diện — hạ tầng OAuth vẫn còn trong
 *    `src/lib/auth-service.ts` nếu cần bật lại.
 */
export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu');
      return;
    }
    setSubmitting(true);
    try {
      // Thành công → (auth)/_layout tự chuyển sang nhóm theo role.
      await login({ email: email.trim(), password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-navy" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="items-center">
            <View className="mb-5 size-16 items-center justify-center rounded-3xl bg-brand-blue shadow-lg">
              <Bike size={32} color="#ffffff" />
            </View>
            <Text className="text-3xl font-bold tracking-tight text-white">CareOnRoad</Text>
            <Text className="mt-1 text-sm text-white/60">Cứu hộ & bảo dưỡng xe máy tại Việt Nam</Text>
          </View>

          {/* Error banner */}
          {error && (
            <View className="mt-6">
              <Banner tone="error" description={error} />
            </View>
          )}

          {/* Form */}
          <View className="mt-8 gap-5">
            <View className="gap-1.5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Email
              </Text>
              <View className="flex-row items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4">
                <Mail size={18} color="#94a3b8" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Email"
                  className="flex-1 py-3.5 text-sm text-white"
                />
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Mật khẩu
              </Text>
              <View className="flex-row items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4">
                <Lock size={18} color="#94a3b8" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showPassword}
                  accessibilityLabel="Mật khẩu"
                  className="flex-1 py-3.5 text-sm text-white"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="p-1"
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#94a3b8" />
                  ) : (
                    <Eye size={18} color="#94a3b8" />
                  )}
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Đăng nhập"
              className={cn(
                'mt-2 items-center justify-center rounded-2xl bg-brand-blue py-4 active:scale-[0.98]',
                submitting && 'opacity-70',
              )}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">Đăng nhập</Text>
              )}
            </Pressable>
          </View>

          {/* Register link */}
          <View className="mt-6 flex-row items-center justify-center gap-1.5">
            <Text className="text-sm text-white/60">Chưa có tài khoản?</Text>
            <Link href="/register" asChild>
              <Pressable hitSlop={8}>
                <Text className="text-sm font-semibold text-brand-blue">Đăng ký ngay</Text>
              </Pressable>
            </Link>
          </View>

          <Text className="mt-8 text-center text-[11px] text-white/30">
            Bằng việc đăng nhập, bạn đồng ý với{' '}
            <Text className="text-white/40 underline">Điều khoản sử dụng</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
