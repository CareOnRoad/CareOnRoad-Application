import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import {
  Bell,
  CheckCheck,
  CreditCard,
  FileText,
  Info,
  Siren,
  Star,
  Wrench,
} from 'lucide-react-native';

import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/use-notifications';
import { categoryIcon, type NotificationCategory, type NotificationItem } from '@/lib/notifications-service';
import { hrefForNotification } from '@/lib/notification-routing';

const iconMap: Record<string, typeof Bell> = {
  Siren,
  Wrench,
  FileText,
  CreditCard,
  Bell,
  Star,
  Info,
};

export default function NotificationsScreen() {
  const {
    unreadCount,
    recent: items,
    loading,
    error,
    reload,
    markRead,
    markAllRead,
  } = useNotifications({ pollIntervalMs: 15_000 });
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const handleRead = useCallback(
    async (n: NotificationItem) => {
      if (n.read_at) return;
      await markRead(n.id);
    },
    [markRead],
  );

  const handleTap = useCallback(
    async (n: NotificationItem) => {
      await handleRead(n);
      const href = hrefForNotification(n, 'rider');
      if (href) router.push(href as Href);
    },
    [handleRead],
  );

  const handleReadAll = useCallback(async () => {
    await markAllRead();
  }, [markAllRead]);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title="Thông báo"
        subtitle={unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Tất cả đã đọc'}
        onBack={() => router.back()}
        right={
          unreadCount > 0 ? (
            <Pressable
              onPress={() => void handleReadAll()}
              accessibilityLabel="Đánh dấu tất cả đã đọc"
              className="rounded-full bg-primary/10 px-3 py-1.5 active:opacity-70"
            >
              <View className="flex-row items-center gap-1">
                <CheckCheck size={14} color="#1974f7" />
                <Text className="text-xs font-semibold text-primary">Đọc tất cả</Text>
              </View>
            </Pressable>
          ) : null
        }
      />

      {error && (
        <View className="px-5 pt-3">
          <Banner tone="error" description={error} />
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1974f7" />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon={Bell}
            tone="primary"
            title="Chưa có thông báo"
            description="Các thông báo về yêu cầu, thợ, báo giá và thanh toán sẽ hiển thị tại đây."
          />
        </View>
      ) : (
        <ScreenScroll
          contentContainerStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {items.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onPress={() => {
                void handleTap(n);
              }}
            />
          ))}
        </ScreenScroll>
      )}
    </SafeAreaView>
  );
}

function NotificationCard({
  notification,
  onPress,
}: {
  notification: NotificationItem;
  onPress: () => void;
}) {
  const IconName = categoryIcon(notification.category);
  const Icon = iconMap[IconName] ?? Bell;
  const isUnread = !notification.read_at;
  const tone = categoryTone(notification.category);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}${isUnread ? ', chưa đọc' : ''}`}
      onPress={onPress}
      className={cn(
        'rounded-2xl border p-4 active:scale-[0.99]',
        isUnread ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <View className="flex-row items-start gap-3">
        <View
          className={cn(
            'size-10 shrink-0 items-center justify-center rounded-xl',
            isUnread ? 'bg-primary' : 'bg-secondary',
          )}
        >
          <Icon size={20} color={isUnread ? '#ffffff' : '#16202f'} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-bold text-foreground" numberOfLines={1}>
              {notification.title}
            </Text>
            <Text className="shrink-0 text-[10px] text-muted-foreground">
              {formatTime(notification.created_at)}
            </Text>
          </View>
          <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
            {notification.body}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <View className={cn('rounded-full px-2 py-0.5', tone.bg)}>
              <Text className={cn('text-[10px] font-bold', tone.text)}>
                {labelFor(notification.category)}
              </Text>
            </View>
            {isUnread && (
              <View className="rounded-full bg-primary px-2 py-0.5">
                <Text className="text-[10px] font-bold text-primary-foreground">Mới</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function categoryTone(c: NotificationCategory): { bg: string; text: string } {
  switch (c) {
    case 'service_request':
      return { bg: 'bg-destructive/10', text: 'text-destructive' };
    case 'payment':
      return { bg: 'bg-amber-500/15', text: 'text-amber-700' };
    case 'quote':
      return { bg: 'bg-primary/10', text: 'text-primary' };
    case 'review':
      return { bg: 'bg-green/15', text: 'text-green' };
    default:
      return { bg: 'bg-secondary', text: 'text-secondary-foreground' };
  }
}

function labelFor(c: NotificationCategory): string {
  switch (c) {
    case 'service_request':
      return 'Yêu cầu';
    case 'assignment':
      return 'Thợ';
    case 'quote':
      return 'Báo giá';
    case 'payment':
      return 'Thanh toán';
    case 'reminder':
      return 'Nhắc nhở';
    case 'review':
      return 'Đánh giá';
    case 'system':
      return 'Hệ thống';
    default:
      return c;
  }
}
