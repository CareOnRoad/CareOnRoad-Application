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
  LucideIcon,
  Mail,
  Phone,
  User as UserIcon,
  Wrench,
} from 'lucide-react-native';

import { useAuth } from '@/contexts/auth-context';
import { Banner } from '@/components/ui/banner';
import type { AuthRole } from '@/lib/auth-types';
import { cn } from '@/lib/utils';

/**
 * Màn hình đăng ký.
 *
 * Design principles:
 *  - Role selector 2-card lớn, dùng icon + mô tả để user hiểu ngay.
 *  - Active state dùng màu nhấn của role: rider = brand-blue, mechanic = mint.
 *  - Form fields có icon, label uppercase tracking-wide để rõ vai trò.
 *  - Validation client-side hiển thị inline.
 */
export default function RegisterScreen() {
  const { register, isBackendConfigured } = useAuth();
  // Backend không có endpoint client-side grant role mechanic,
  // nên khi đã wire BE ta ép role = rider và hiển thị banner.
  const [role, setRole] = useState<AuthRole>('rider');
  const allowMechanicRole = !isBackendConfigured;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email không hợp lệ');
      return;
    }
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        role,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng ký thất bại');
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
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="items-center">
            <Text className="text-2xl font-bold text-white">Tạo tài khoản</Text>
            <Text className="mt-1 text-sm text-white/60">Tham gia CareOnRoad ngay hôm nay</Text>
          </View>

          {/* Role selector - chỉ hiển thị ở demo mode */}
          {allowMechanicRole ? (
            <View className="mt-6 flex-row gap-3">
              <RoleCard
                role="rider"
                active={role === 'rider'}
                icon={Bike}
                title="Rider"
                subtitle="Người dùng xe máy"
                onPress={() => setRole('rider')}
              />
              <RoleCard
                role="mechanic"
                active={role === 'mechanic'}
                icon={Wrench}
                title="Mechanic"
                subtitle="Thợ sửa xe"
                onPress={() => setRole('mechanic')}
              />
            </View>
          ) : null}

          {isBackendConfigured && (
            <View className="mt-5">
              <Banner
                tone="info"
                title="Đăng ký tài khoản Rider"
                description="Tài khoản thợ (Mechanic) cần admin duyệt sau khi đăng ký. Vui lòng liên hệ support nếu bạn là thợ sửa xe."
              />
            </View>
          )}

          {error && (
            <View className="mt-5">
              <Banner tone="error" description={error} />
            </View>
          )}

          {!isBackendConfigured && (
            <View className="mt-5">
              <Banner
                tone="info"
                title="Chế độ Demo"
                description="Tài khoản sẽ được lưu local. Khi tích hợp backend, tài khoản sẽ đồng bộ lên server."
              />
            </View>
          )}

          {/* Form */}
          <View className="mt-6 gap-5">
            <View className="gap-1.5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Họ và tên
              </Text>
              <View className="flex-row items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4">
                <UserIcon size={18} color="#94a3b8" />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nguyễn Văn A"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  accessibilityLabel="Họ và tên"
                  className="flex-1 py-3.5 text-sm text-white"
                />
              </View>
            </View>

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
                Số điện thoại
              </Text>
              <View className="flex-row items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4">
                <Phone size={18} color="#94a3b8" />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+84 9x xxx xxxx"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  accessibilityLabel="Số điện thoại"
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
                  placeholder="Ít nhất 6 ký tự"
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
              accessibilityLabel="Tạo tài khoản"
              className={cn(
                'mt-2 items-center justify-center rounded-2xl py-4 active:scale-[0.98]',
                'bg-brand-blue',
                submitting && 'opacity-70',
              )}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  Tạo tài khoản {role === 'rider' ? 'Rider' : 'Mechanic'}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Login link */}
          <View className="mt-6 flex-row items-center justify-center gap-1.5">
            <Text className="text-sm text-white/60">Đã có tài khoản?</Text>
            <Link href="/login" asChild>
              <Pressable hitSlop={8}>
                <Text className="text-sm font-semibold text-brand-blue">Đăng nhập</Text>
              </Pressable>
            </Link>
          </View>

          <Text className="mt-6 text-center text-[11px] text-white/30">
            Bằng việc đăng ký, bạn đồng ý với{' '}
            <Text className="text-white/40 underline">Điều khoản sử dụng</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleCard({
  active,
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  role: AuthRole;
  active: boolean;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Đăng ký với vai trò ${title}`}
      className={cn(
        'flex-1 items-center rounded-2xl border bg-white/5 p-4 active:scale-[0.98]',
        active ? 'border-brand-blue bg-brand-blue/15' : 'border-white/10',
      )}
    >
      <View
        className={cn(
          'mb-2 size-12 items-center justify-center rounded-2xl',
          active ? 'bg-brand-blue/20' : 'bg-white/10',
        )}
      >
        <Icon size={22} color={active ? '#ffffff' : '#94a3b8'} />
      </View>
      <Text className="text-base font-bold text-white">{title}</Text>
      <Text className="mt-0.5 text-xs text-white/60">{subtitle}</Text>
    </Pressable>
  );
}
