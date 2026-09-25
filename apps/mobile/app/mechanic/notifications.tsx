import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import {
  Bell,
  Check,
  Inbox,
  RefreshCw,
  Wrench,
  Calendar,
  CreditCard,
  Star,
  ClipboardList,
  Info,
} from 'lucide-react-native';

import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import {
  getUnreadCount,
  listNotifications,
  markRead as markNotificationRead,
  markAllRead as markAllNotificationsRead,
  type NotificationCategory,
  type NotificationItem,
} from '@/lib/notifications-service';

const POLL_MS = 20000;

function categoryIcon(c: NotificationCategory) {
  switch (c) {
    case 'service_request':
      return Wrench;
    case 'assignment':
      return ClipboardList;
    case 'quote':
      return CreditCard;
    case 'payment':
      return CreditCard;
    case 'reminder':
      return Calendar;
    case 'review':
      return Star;
    case 'system':
    default:
      return Info;
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

/**
 * NotificationInboxScreen - danh sách thông báo cho mechanic hoặc rider.
 * Có thể tái sử dụng ở cả hai role vì BE /api/v1/notifications là owner-scoped.
 */
export default function NotificationInboxScreen() {
  const { isBackendConfigured } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!isBackendConfigured) {
      setItems([]);
      setUnread(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        listNotifications({ limit: 50 }),
        getUnreadCount().catch(() => 0),
      ]);
      setItems(list.items);
      setUnread(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải thông báo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkRead = async (n: NotificationItem) => {
    if (n.read_at) return;
    // optimistic
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(n.id);
    } catch (e) {
      // rollback
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: undefined } : x)));
      setUnread((c) => c + 1);
      setError(e instanceof Error ? e.message : 'Không thể đánh dấu đã đọc');
    }
  };

  const handleMarkAll = async () => {
    setUnread(0);
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    try {
      await markAllNotificationsRead();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể đánh dấu tất cả');
      void reload();
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Thông báo"
        subtitle={unread > 0 ? `${unread} chưa đọc` : 'Tất cả đã đọc'}
        right={
          <View className="flex-row items-center gap-2">
            {unread > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đánh dấu tất cả đã đọc"
                onPress={handleMarkAll}
                className="flex-row items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 active:opacity-70"
              >
                <Check size={12} color="#1974f7" />
                <Text className="text-xs font-semibold text-primary">Đọc tất cả</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityLabel="Làm mới"
              onPress={() => void reload()}
              className="size-9 items-center justify-center rounded-full bg-secondary active:opacity-70"
              disabled={loading}
            >
              <RefreshCw size={16} color="#16202f" />
            </Pressable>
          </View>
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View className="mb-4">
            <Banner tone="error" description={error} />
          </View>
        )}

        {!isBackendConfigured ? (
          <EmptyState
            icon={Bell}
            tone="primary"
            title="Chưa kết nối backend"
            description="Đăng nhập để nhận thông báo từ hệ thống."
          />
        ) : loading && items.length === 0 ? (
          <View className="items-center py-12">
            <ActivityIndicator color="#1974f7" />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            tone="primary"
            title="Chưa có thông báo nào"
            description="Thông báo mới sẽ hiển thị tại đây."
          />
        ) : (
          <View className="gap-3">
            {items.map((n) => (
              <NotificationCard key={n.id} item={n} onPress={() => void handleMarkRead(n)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function NotificationCard({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const Icon = categoryIcon(item.category);
  const isUnread = !item.read_at;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${isUnread ? 'chưa đọc' : 'đã đọc'}`}
      onPress={onPress}
      className={cn('active:opacity-70', isUnread && 'opacity-100')}
    >
      <Card className={cn('p-4', isUnread && 'border-primary bg-primary/5')}>
        <View className="flex-row items-start gap-3">
          <View
            className={cn(
              'size-10 shrink-0 items-center justify-center rounded-2xl',
              isUnread ? 'bg-primary/15' : 'bg-secondary',
            )}
          >
            <Icon size={18} color={isUnread ? '#1974f7' : '#64748b'} />
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-start justify-between gap-2">
              <Text
                className={cn(
                  'flex-1 text-sm leading-tight',
                  isUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground',
                )}
              >
                {item.title}
              </Text>
              {isUnread && <View className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
            </View>
            <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
              {item.body}
            </Text>
            <Text className="mt-1 text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
