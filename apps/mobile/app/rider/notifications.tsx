import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
import {
  categoryIcon,
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  type NotificationCategory,
  type NotificationItem,
} from '@/lib/notifications-service';

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
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, count] = await Promise.all([
        listNotifications({ limit: 50 }),
        getUnreadCount(),
      ]);
      setItems(list.items);
      setUnread(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải thông báo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleRead = async (n: NotificationItem) => {
    if (n.read_at) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((c) => Math.max(0, c - 1));
    try {
      await markRead(n.id);
    } catch {
      // rollback nếu fail
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: undefined } : x)));
      setUnread((c) => c + 1);
    }
  };

  const handleReadAll = async () => {
    const prevItems = items;
    const prevUnread = unread;
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await markAllRead();
    } catch {
      setItems(prevItems);
      setUnread(prevUnread);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title="Thông báo"
        subtitle={unread > 0 ? `${unread} chưa đọc` : 'Tất cả đã đọc'}
        onBack={() => router.back()}
        right={
          unread > 0 ? (
            <Pressable
              onPress={handleReadAll}
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
                void handleRead(n);
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
