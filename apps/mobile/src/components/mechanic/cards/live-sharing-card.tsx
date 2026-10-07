import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Switch, Text, View } from 'react-native';
import { MapPin, MapPinOff, Settings as SettingsIcon } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Banner } from '@/components/ui/banner';
import { cn } from '@/lib/utils';

interface LiveSharingCardProps {
  /** Có đang chia sẻ vị trí cho assignment này không. */
  isSharing: boolean;
  /** Job có đang ở trạng thái cho phép share không. */
  canShare: boolean;
  /** Lỗi cuối cùng (tiếng Việt), null nếu không có. */
  error: string | null;
  /** Permission foreground location đã được user cấp hay chưa. */
  permissionGranted?: boolean;
  /**
   * Auto-tracking đang chạy ngầm (provider-level) hay không.
   * UI dùng để hiển thị hint "đang tự động đồng bộ" bên cạnh switch manual.
   */
  autoTrackingActive?: boolean;
  /** Toggle bật/tắt. */
  onToggle: () => void;
  /**
   * Callback mở Settings OS. Mặc định dùng `Linking.openSettings()`.
   * Provider có thể override nếu muốn flow khác.
   */
  onOpenSettings?: () => void;
}

/**
 * Card điều khiển chia sẻ vị trí cho 1 assignment.
 *
 * Trạng thái hiển thị:
 *  - `canShare=false` (assignment không ở travel state) → render null.
 *  - `permissionGranted=false` → banner "Mở cài đặt vị trí" + button Settings;
 *    switch bị disabled.
 *  - `isSharing=true` → đang phát trực tiếp cho assignment này, có nút "Dừng".
 *  - `autoTrackingActive=true` (và !isSharing) → provider đang chạy ngầm
 *    auto-tracking; card hiển thị pill "Tự động đồng bộ" thay vì switch.
 */
export function LiveSharingCard({
  isSharing,
  canShare,
  error,
  permissionGranted = true,
  autoTrackingActive = false,
  onToggle,
  onOpenSettings,
}: LiveSharingCardProps) {
  const [toggling, setToggling] = useState(false);

  const handlePress = async () => {
    setToggling(true);
    try {
      await onToggle();
    } finally {
      setToggling(false);
    }
  };

  const handleOpenSettings = async () => {
    if (onOpenSettings) {
      await onOpenSettings();
      return;
    }
    try {
      await Linking.openSettings();
    } catch {
      // ignore - user tự mở
    }
  };

  if (!canShare) return null;

  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <View
          className={cn(
            'size-10 shrink-0 items-center justify-center rounded-2xl',
            isSharing ? 'bg-green/10' : 'bg-primary/10',
          )}
        >
          {isSharing ? (
            <MapPin size={20} color="#145413" />
          ) : (
            <MapPinOff size={20} color="#1974f7" />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground">
            {isSharing
              ? 'Đang chia sẻ vị trí'
              : autoTrackingActive
                ? 'Đang tự động đồng bộ vị trí'
                : 'Chia sẻ vị trí với khách'}
          </Text>
          <Text className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {isSharing
              ? 'Rider đang thấy vị trí của bạn cập nhật mỗi 15 giây.'
              : autoTrackingActive
                ? 'Hệ thống tự động gửi vị trí khi bạn có assignment đang chạy.'
                : 'Bật để rider thấy bạn đang ở đâu trên đường tới.'}
          </Text>
        </View>
        {toggling ? (
          <ActivityIndicator size="small" color="#1974f7" />
        ) : autoTrackingActive && !isSharing ? (
          <View className="rounded-full bg-primary/10 px-2.5 py-1">
            <Text className="text-[11px] font-semibold text-primary">Tự động</Text>
          </View>
        ) : (
          <Switch
            value={isSharing}
            onValueChange={handlePress}
            disabled={!permissionGranted}
            trackColor={{ false: '#e2e8f0', true: '#1974f7' }}
            thumbColor={isSharing ? '#ffffff' : '#f8fafc'}
            accessibilityLabel="Bật tắt chia sẻ vị trí"
          />
        )}
      </View>
      {!permissionGranted && (
        <View className="mt-3 gap-2">
          <Banner
            tone="warning"
            title="Chưa cấp quyền vị trí"
            description="Cần cấp quyền vị trí để rider thấy bạn trên bản đồ."
          />
          <Pressable
            onPress={handleOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="Mở cài đặt vị trí"
            className="flex-row items-center gap-2 self-start rounded-full bg-amber-500/10 px-3 py-1.5 active:opacity-70"
          >
            <SettingsIcon size={12} color="#d97706" />
            <Text className="text-xs font-semibold text-amber-700">Mở cài đặt vị trí</Text>
          </Pressable>
        </View>
      )}
      {isSharing && (
        <Pressable
          onPress={handlePress}
          className="mt-3 self-start rounded-full bg-destructive/10 px-3 py-1.5 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Dừng chia sẻ vị trí"
        >
          <Text className="text-xs font-semibold text-destructive">Dừng chia sẻ</Text>
        </Pressable>
      )}
      {error && (
        <Banner
          tone="warning"
          title="Không thể chia sẻ vị trí"
          description={error}
          className="mt-3"
        />
      )}
    </Card>
  );
}
