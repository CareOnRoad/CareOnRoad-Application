import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { MapPin, MapPinOff } from 'lucide-react-native';
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
  /** Toggle bật/tắt. */
  onToggle: () => void;
}

/**
 * Card điều khiển chia sẻ vị trí cho 1 assignment.
 *
 * Khi mechanic bật, rider sẽ thấy vị trí thợ cập nhật mỗi ~15s cho tới khi
 * tắt hoặc job hoàn tất. Card auto-reset khi status assignment đổi sang
 * `completed`/`canceled` (qua context watcher).
 */
export function LiveSharingCard({
  isSharing,
  canShare,
  error,
  onToggle,
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
            {isSharing ? 'Đang chia sẻ vị trí' : 'Chia sẻ vị trí với khách'}
          </Text>
          <Text className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {isSharing
              ? 'Rider đang thấy vị trí của bạn cập nhật mỗi 15 giây.'
              : 'Bật để rider thấy bạn đang ở đâu trên đường tới.'}
          </Text>
        </View>
        {toggling ? (
          <ActivityIndicator size="small" color="#1974f7" />
        ) : (
          <Switch
            value={isSharing}
            onValueChange={handlePress}
            trackColor={{ false: '#e2e8f0', true: '#1974f7' }}
            thumbColor={isSharing ? '#ffffff' : '#f8fafc'}
            accessibilityLabel="Bật tắt chia sẻ vị trí"
          />
        )}
      </View>
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
