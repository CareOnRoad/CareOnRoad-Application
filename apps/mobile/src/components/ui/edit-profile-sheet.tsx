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
  TextInput,
  View,
} from 'react-native';
import { Pencil, X } from 'lucide-react-native';

import { cn } from '@/lib/utils';
import { Banner } from '@/components/ui/banner';
import { loadProfile, saveProfile, validateProfile, type LocalProfile } from '@/lib/profile-service';

/**
 * EditProfileSheet - modal slide-up để sửa thông tin cá nhân (tên, SĐT, email, avatar).
 *
 * Phase 1: lưu local vào AsyncStorage.
 * Phase 2: gọi PATCH /api/v1/auth/profile khi có endpoint.
 *
 * Design:
 *  - Bottom sheet với overlay đen 50%, bo góc trên 32px.
 *  - Drag handle bar (visual cue, không kéo thả ở MVP).
 *  - Form fields: avatar + name + phone + email.
 *  - Validation client-side trước khi save.
 *  - Save button disabled khi không có thay đổi hoặc đang lưu.
 */
export function EditProfileSheet({
  visible,
  userId,
  initialName,
  initialEmail,
  initialPhone,
  initialAvatar,
  onClose,
  onSaved,
}: EditProfileSheetProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state mỗi khi mở sheet với initial props mới
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setEmail(initialEmail);
      setPhone(initialPhone);
      setAvatar(initialAvatar);
      setError(null);
    }
  }, [visible, initialName, initialEmail, initialPhone, initialAvatar]);

  const dirty =
    name.trim() !== initialName.trim() ||
    email.trim() !== initialEmail.trim() ||
    phone.trim() !== initialPhone.trim() ||
    avatar !== initialAvatar;

  const handleSave = async () => {
    setError(null);
    const errors = validateProfile({ name, email, phone });
    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }
    if (!userId) {
      setError('Không xác định được người dùng. Vui lòng đăng nhập lại.');
      return;
    }
    setSaving(true);
    try {
      const profile: LocalProfile = {
        id: userId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        avatar,
        updatedAt: new Date().toISOString(),
      };
      await saveProfile(profile);
      onSaved?.(profile);
      onClose();
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
                  <Field
                    label="Họ và tên"
                    value={name}
                    onChangeText={setName}
                    placeholder="Nguyễn Văn A"
                    autoCapitalize="words"
                    required
                  />
                  <Field
                    label="Số điện thoại"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+84 90 555 1234"
                    keyboardType="phone-pad"
                  />
                  <Field
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    required
                  />
                  <Field
                    label="URL ảnh đại diện (tuỳ chọn)"
                    value={avatar}
                    onChangeText={setAvatar}
                    placeholder="https://..."
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
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
                  Thông tin được lưu trên thiết bị (sẽ đồng bộ máy chủ khi có endpoint).
                </Text>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  required?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <Text className="text-destructive"> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground"
      />
    </View>
  );
}

interface EditProfileSheetProps {
  visible: boolean;
  /** User id từ auth-context. */
  userId: string;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialAvatar: string;
  onClose: () => void;
  onSaved?: (profile: LocalProfile) => void;
}
