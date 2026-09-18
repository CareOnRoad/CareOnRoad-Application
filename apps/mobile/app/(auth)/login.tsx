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
  FlaskConical,
  Lock,
  Mail,
  ShieldCheck,
  Wrench,
} from 'lucide-react-native';

import { useAuth } from '@/contexts/auth-context';
import { Banner } from '@/components/ui/banner';
import { cn } from '@/lib/utils';
import type { AuthRole } from '@/lib/auth-types';

/**
 * Màn hình đăng nhập.
 *
 * Design principles:
 *  - Nền navy + glassmorphism cards → brand identity cho toàn auth flow.
 *  - Alerts đỏ (Banner tone="error"), warnings amber (chế độ demo) → theo chuẩn.
 *  - Nút primary CTA = brand-blue (#1974f7), không bị mờ đi khi đang submit.
 *  - Tài khoản demo chỉ hiển thị khi chưa cấu hình backend, không gây nhiễu user thật.
 */
export default function LoginScreen() {
  const { login, isBackendConfigured, bypassLoginAs } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bypassing, setBypassing] = useState<AuthRole | null>(null);
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
      await login({ email: email.trim(), password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const onBypass = async (target: AuthRole) => {
    setError(null);
    setBypassing(target);
    try {
      await bypassLoginAs(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể bypass đăng nhập');
    } finally {
      setBypassing(null);
    }
  };

  const fillDemoRider = () => {
    setEmail('rider1@gmail.com');
    setPassword('demo1234');
    setError(null);
  };

  const fillDemoMechanic = () => {
    setEmail('mechanic1@gmail.com');
    setPassword('demo1234');
    setError(null);
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

          {/* Demo mode warning */}
          {!isBackendConfigured && (
            <View className="mt-6">
              <Banner
                tone="warning"
                title="Đang chạy ở chế độ Demo"
                description="Backend chưa cấu hình. Đăng nhập dùng tài khoản local. Xem apps/mobile/README.md để thiết lập."
              />
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

          {/* Demo accounts - chỉ hiện khi chưa có backend */}
          {!isBackendConfigured && (
            <View className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
              <View className="mb-3 flex-row items-center gap-2">
                <ShieldCheck size={16} color="#22c55e" />
                <Text className="text-sm font-semibold text-white">Tài khoản demo</Text>
              </View>
              <Text className="mb-3 text-xs text-white/50">
                Thử nghiệm nhanh với tài khoản có sẵn (mật khẩu: demo1234):
              </Text>
              <View className="gap-2">
                <DemoAccount
                  icon={Bike}
                  iconBg="bg-primary/20"
                  iconColor="#1974f7"
                  title="Rider Demo"
                  email="rider1@gmail.com"
                  onPress={fillDemoRider}
                />
                <DemoAccount
                  icon={Wrench}
                  iconBg="bg-mint/20"
                  iconColor="#a9ffad"
                  title="Mechanic Demo"
                  email="mechanic1@gmail.com"
                  onPress={fillDemoMechanic}
                />
              </View>
            </View>
          )}

          {/* Bypass login - dev only, dùng để test UI nhanh (sẽ xoá trong tương lai) */}
          <View className="mt-4 rounded-3xl border border-dashed border-amber-500/40 bg-amber-500/10 p-4">
            <View className="mb-3 flex-row items-center gap-2">
              <FlaskConical size={16} color="#f59e0b" />
              <Text className="text-sm font-semibold text-amber-700">Dev Bypass (sẽ xoá)</Text>
            </View>
            <Text className="mb-3 text-xs leading-relaxed text-amber-700/80">
              Bỏ qua đăng nhập để xem nhanh giao diện từng role. Nút này chỉ dùng cho dev/test
              và sẽ bị xoá khi tích hợp backend thật.
            </Text>
            <View className="flex-row gap-2">
              <BypassButton
                role="rider"
                loading={bypassing === 'rider'}
                disabled={!!bypassing}
                onPress={() => onBypass('rider')}
              />
              <BypassButton
                role="mechanic"
                loading={bypassing === 'mechanic'}
                disabled={!!bypassing}
                onPress={() => onBypass('mechanic')}
              />
            </View>
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

function DemoAccount({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  email,
  onPress,
}: {
  icon: typeof Bike;
  iconBg: string;
  iconColor: string;
  title: string;
  email: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Điền nhanh ${title}`}
      className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 active:scale-[0.98] active:bg-white/10"
    >
      <View className={cn('size-9 items-center justify-center rounded-lg', iconBg)}>
        <Icon size={18} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-white">{title}</Text>
        <Text className="text-xs text-white/50">{email}</Text>
      </View>
    </Pressable>
  );
}

const bypassTone = {
  rider: { bg: 'bg-primary', fg: '#ffffff', iconBg: 'bg-white/15', Icon: Bike, label: 'Rider' },
  mechanic: { bg: 'bg-green', fg: '#ffffff', iconBg: 'bg-white/15', Icon: Wrench, label: 'Mechanic' },
} as const;

function BypassButton({
  role,
  loading,
  disabled,
  onPress,
}: {
  role: AuthRole;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const tone = bypassTone[role];
  const Icon = tone.Icon;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Bypass đăng nhập vào ${tone.label}`}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3 active:scale-[0.98]',
        tone.bg,
        disabled && 'opacity-60',
      )}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} />
      ) : (
        <>
          <View className={cn('size-6 items-center justify-center rounded-md', tone.iconBg)}>
            <Icon size={14} color={tone.fg} />
          </View>
          <Text className="text-sm font-semibold" style={{ color: tone.fg }}>
            Vào {tone.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
