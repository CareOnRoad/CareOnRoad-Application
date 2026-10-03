/**
 * useNotifications — hook unified cho notifications (rider + mechanic).
 *
 * Cung cấp:
 *  - unreadCount     : số thông báo chưa đọc (polling 30s)
 *  - recent          : danh sách thông báo gần nhất (cursor pagination)
 *  - markRead(id)    : đánh dấu 1 notification đã đọc
 *  - markAllRead()   : đánh dấu tất cả đã đọc
 *  - reload()        : fetch lại list + count
 *  - isLoading       : state đang fetch
 *  - error           : lỗi cuối cùng (tiếng Việt)
 *
 * Hook tự khởi động khi mount và polling mỗi 30s.
 * Cleanup timer khi unmount hoặc khi auth thay đổi (unauthenticated).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/lib/api';
import {
  getUnreadCount,
  listNotifications,
  markAllRead as apiMarkAllRead,
  markRead as apiMarkRead,
  type NotificationItem,
} from '@/lib/notifications-service';
import { useAuth } from '@/contexts/auth-context';

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_PAGE_SIZE = 20;

interface UseNotificationsOptions {
  /** Polling interval (ms). Mặc định 30s. Set 0 để tắt polling. */
  pollIntervalMs?: number;
  /** Kích thước trang cho recent list. Mặc định 20. */
  pageSize?: number;
}

interface UseNotificationsReturn {
  unreadCount: number;
  recent: NotificationItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { isBackendConfigured, status: authStatus } = useAuth();
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const reload = useCallback(async () => {
    if (!isBackendConfigured || authStatus !== 'authenticated') {
      setUnreadCount(0);
      setRecent([]);
      setNextCursor(undefined);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [count, listRes] = await Promise.all([
        getUnreadCount().catch(() => 0),
        listNotifications({ limit: pageSize }).catch(
          (): { items: import('@/lib/notifications-service').NotificationItem[]; next_cursor?: string } => ({
            items: [],
          }),
        ),
      ]);
      setUnreadCount(count);
      setRecent(listRes.items);
      setNextCursor(listRes.next_cursor);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Không thể tải thông báo';
      setError(msg);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [isBackendConfigured, authStatus, pageSize]);

  const loadMore = useCallback(async () => {
    if (!isBackendConfigured || authStatus !== 'authenticated') return;
    if (!nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    setError(null);
    try {
      const listRes = await listNotifications({ limit: pageSize, cursor: nextCursor });
      setRecent((prev) => {
        // Loại bỏ trùng id khi cuộn trang.
        const seen = new Set(prev.map((n) => n.id));
        const merged = [...prev];
        for (const item of listRes.items) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setNextCursor(listRes.next_cursor);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Không thể tải thêm thông báo';
      setError(msg);
    } finally {
      setLoadingMore(false);
    }
  }, [isBackendConfigured, authStatus, nextCursor, loadingMore, loading, pageSize]);

  const markRead = useCallback(
    async (id: string) => {
      if (!isBackendConfigured || authStatus !== 'authenticated') return;
      // Optimistic: giảm count + đánh dấu local
      let wasUnread = false;
      setRecent((prev) =>
        prev.map((n) => {
          if (n.id === id && !n.read_at) {
            wasUnread = true;
            return { ...n, read_at: new Date().toISOString() };
          }
          return n;
        }),
      );
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await apiMarkRead(id);
      } catch (e) {
        // Rollback nếu lỗi
        if (wasUnread) setUnreadCount((c) => c + 1);
        setRecent((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: undefined } : n)));
        const msg = e instanceof Error ? e.message : 'Không thể đánh dấu đã đọc';
        setError(msg);
      }
    },
    [isBackendConfigured, authStatus],
  );

  const markAllRead = useCallback(async () => {
    if (!isBackendConfigured || authStatus !== 'authenticated') return;
    const prevUnread = unreadCount;
    const prevRecent = recent;
    // Optimistic
    setUnreadCount(0);
    const now = new Date().toISOString();
    setRecent((curr) => curr.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    try {
      await apiMarkAllRead();
    } catch (e) {
      // Rollback
      setUnreadCount(prevUnread);
      setRecent(prevRecent);
      const msg = e instanceof Error ? e.message : 'Không thể đánh dấu tất cả đã đọc';
      setError(msg);
    }
  }, [isBackendConfigured, authStatus, unreadCount, recent]);

  // Initial load + polling khi auth ready.
  useEffect(() => {
    if (!isBackendConfigured || authStatus !== 'authenticated') {
      clearPoll();
      setUnreadCount(0);
      setRecent([]);
      setNextCursor(undefined);
      return;
    }
    void reload();
    if (pollIntervalMs > 0) {
      pollTimerRef.current = setInterval(() => {
        void reload();
      }, pollIntervalMs);
    }
    return clearPoll;
  }, [isBackendConfigured, authStatus, pollIntervalMs, reload, clearPoll]);

  const hasMore = Boolean(nextCursor);

  return useMemo<UseNotificationsReturn>(
    () => ({
      unreadCount,
      recent,
      loading,
      error,
      hasMore,
      reload,
      loadMore,
      markRead,
      markAllRead,
    }),
    [unreadCount, recent, loading, error, hasMore, reload, loadMore, markRead, markAllRead],
  );
}