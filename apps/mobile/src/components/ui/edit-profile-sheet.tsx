import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Pencil, X } from 'lucide-react-native';

import { cn } from '@/lib/utils';
import { Banner } from '@/components/ui/banner';
import { Field, FormTextInput } from '@/components/ui/form';
import { useAuth } from '@/contexts/auth-context';

/**
 * EditProfileSheet - modal slide-up để sửa thông tin cá nhân.
 *
 * Wire API:
 *  - Gọi `useAuth().updateProfile({ name, phone, address, avatar })`.
 *  - Khi backend đã cấu hình → PATCH /api/v1/auth/profile (đã được AuthContext
 *    xử lý) → refresh actor → state hiển thị cập nhật ngay.
 *  - Trong demo mode → chỉ ghi session local.
 *
 * Design:
 *  - Bottom sheet với overlay đen 50%, bo góc trên 32px.
 *  - Form fields: avatar + name + phone + email + address.
 *  - Validation client-side trước khi save.
 *  - Save button disabled khi không có thay đổi hoặc đang lưu.
 */
export function EditProfileSheet({
  visible,
  initialName,
  initialEmail,
  initialPhone,
  initialAvatar,
  initialAddress,
  onClose,
  onSaved,
}: EditProfileSheetProps) {
  const { updateProfile } = useAuth();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress ?? '');
  const [avatar, setAvatar] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset state mỗi khi mở sheet với initial props mới
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setEmail(initialEmail);
      setPhone(initialPhone);
      setAddress(initialAddress ?? '');
      setAvatar(initialAvatar);
      setError(null);
      setSuccess(null);
    }
  }, [visible, initialName, initialEmail, initialPhone, initialAddress, initialAvatar]);

  const dirty =
    name.trim() !== initialName.trim() ||
    email.trim() !== initialEmail.trim() ||
    phone.trim() !== initialPhone.trim() ||
    address.trim() !== (initialAddress ?? '').trim() ||
    avatar !== initialAvatar;

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const errors = validateProfile({ name, email, phone });
    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        avatar,
      });
      onSaved?.({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        address: updated.address ?? '',
        avatar: updated.avatar,
        updatedAt: new Date().toISOString(),
      });
      setSuccess('Đã lưu thay đổi.');
      // Đóng sau 600ms để user kịp đọc banner thành công
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  // Phase 1 chỉ là placeholder; Phase 2 sẽ dùng expo-image-picker.
  const handlePickAvatar = () => {
    // Tạm thời: cho user nhập URL hoặc dùng avatar hiện tại.
    // Khi tích hợp image picker thật, thay thế bằng ImagePicker.launchImageLibraryAsync().
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable
          onPress={onClose}
          className="flex-1 items-center justify-end bg-black/50"
          accessibilityLabel="Đóng"
          accessibilityRole="button"
        >
          <Pressable onPress={() => undefined}>
            <View className="w-full rounded-t-3xl bg-card pb-6 shadow-2xl">
              {/* Drag handle */}
              <View className="items-center pb-3 pt-3">
                <View className="size-1.5 w-12 rounded-full bg-border" />
              </View>

              {/* Header */}
              <View className="flex-row items-center justify-between border-b border-border px-5 pb-4">
                <Text className="text-lg font-bold text-foreground">Sửa hồ sơ</Text>
                <Pressable
                  onPress={onClose}
                  accessibilityLabel="Đóng"
                  accessibilityRole="button"
                  className="size-9 items-center justify-center rounded-full bg-secondary active:scale-95"
                >
                  <X size={18} color="#16202f" />
                </Pressable>
              </View>

              <ScrollView
                className="max-h-[600px]"
                contentContainerStyle={{ padding: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {error && (
                  <View className="mb-4">
                    <Banner tone="error" description={error} />
                  </View>
                )}

                {success && !error && (
                  <View className="mb-4">
                    <Banner tone="success" description={success} />
                  </View>
                )}

                {/* Avatar */}
                <View className="items-center">
                  <Pressable
                    onPress={handlePickAvatar}
                    accessibilityLabel="Đổi ảnh đại diện"
                    accessibilityRole="button"
                    className="relative"
                  >
                    <View className="size-24 overflow-hidden rounded-full border-2 border-border bg-secondary">
                      {avatar ? (
                        <Image
                          source={{ uri: avatar }}
                          className="size-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="size-full items-center justify-center">
                          <Text className="text-3xl font-bold text-muted-foreground">
                            {name.trim().charAt(0).toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="absolute bottom-0 right-0 size-8 items-center justify-center rounded-full bg-primary">
                      <Pencil size={14} color="#ffffff" />
                    </View>
                  </Pressable>
                  <Text className="mt-2 text-xs text-muted-foreground">
                    Nhấn để đổi ảnh (sắp có)
                  </Text>
                </View>

                {/* Fields */}
                <View className="mt-6 gap-4">
                  <Field label="Họ và tên" required>
                    <FormTextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Nguyễn Văn A"
                      autoCapitalize="words"
                      accessibilityLabel="Họ và tên"
                    />
                  </Field>
                  <Field label="Số điện thoại">
                    <FormTextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+84 90 555 1234"
                      keyboardType="phone-pad"
                      accessibilityLabel="Số điện thoại"
                    />
                  </Field>
                  <Field
                    label="Email"
                    required
                    hint="Email được quản lý qua tài khoản đăng nhập"
                  >
                    <FormTextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="email@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={false}
                      accessibilityLabel="Email"
                    />
                  </Field>
                  <Field label="Địa chỉ">
                    <FormTextInput
                      value={address ?? ''}
                      onChangeText={setAddress}
                      placeholder="Số nhà, đường, phường, quận..."
                      autoCapitalize="sentences"
                      accessibilityLabel="Địa chỉ"
                    />
                  </Field>
                  <Field label="URL ảnh đại diện (tuỳ chọn)">
                    <FormTextInput
                      value={avatar}
                      onChangeText={setAvatar}
                      placeholder="https://..."
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="URL ảnh đại diện"
                    />
                  </Field>
                </View>

                {/* Actions */}
                <View className="mt-6 flex-row gap-3">
                  <Pressable
                    onPress={onClose}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Huỷ"
                    className={cn(
                      'flex-1 items-center justify-center rounded-2xl border border-border bg-secondary py-3.5 active:scale-[0.97]',
                      saving && 'opacity-50',
                    )}
                  >
                    <Text className="text-sm font-semibold text-foreground">Huỷ</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving || !dirty}
                    accessibilityRole="button"
                    accessibilityLabel="Lưu thay đổi"
                    className={cn(
                      'flex-1 items-center justify-center rounded-2xl bg-primary py-3.5 active:scale-[0.97]',
                      (saving || !dirty) && 'opacity-50',
                    )}
                  >
                    {saving ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text className="text-sm font-semibold text-primary-foreground">
                        Lưu thay đổi
                      </Text>
                    )}
                  </Pressable>
                </View>

                <Text className="mt-4 text-center text-[11px] text-muted-foreground">
                  Thông tin sẽ được đồng bộ lên máy chủ sau khi lưu.
                </Text>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Validate các trường trước khi save.
 * Trả về mảng lỗi tiếng Việt; rỗng = OK.
 */
function validateProfile(input: {
  name: string;
  email: string;
  phone: string;
}): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  if (name.length < 2) {
    errors.push('Họ và tên phải có ít nhất 2 ký tự.');
  } else if (name.length > 120) {
    errors.push('Họ và tên không quá 120 ký tự.');
  }
  const email = input.email.trim();
  if (!email) {
    errors.push('Vui lòng nhập email.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email không hợp lệ.');
  }
  const phone = input.phone.trim();
  if (phone) {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length < 9 || digits.length > 13) {
      errors.push('Số điện thoại phải có 9-13 chữ số.');
    }
  }
  return errors;
}

export interface LocalProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  avatar: string;
  updatedAt: string;
}

interface EditProfileSheetProps {
  visible: boolean;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialAddress?: string;
  initialAvatar: string;
  onClose: () => void;
  onSaved?: (profile: LocalProfile) => void;
}
