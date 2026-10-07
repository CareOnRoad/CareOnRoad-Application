import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ActiveRequestContext - lưu request cứu hộ / bảo dưỡng đang chạy của rider.
 *
 * Vấn đề được giải quyết:
 *  - `useServiceRequests()` giữ `active` trong React state của từng hook
 *    instance → mỗi screen gọi hook là có state riêng, không share.
 *  - State không persist qua app restart → mở lại app là mất, rider không
 *    còn cách nào biết request cũ đang ở đâu (thợ chưa tới / chờ báo giá /
 *    chờ thanh toán).
 *
 * Giải pháp:
 *  - 1 nguồn sự thật duy nhất (`activeRequestId`) nằm trong Context + được
 *    mirror sang AsyncStorage.
 *  - `useServiceRequests()` đọc/ghi qua context này nên mọi screen đều
 *    thấy cùng 1 giá trị.
 *  - App restart → hydrate lại từ AsyncStorage → rider vẫn vào được màn
 *    hình chi tiết của request đang chạy.
 */

const STORAGE_KEY = '@careonroad/rider/active_request_id';

interface ActiveRequestState {
  /** Request id đang theo dõi, `null` nếu không có. */
  activeRequestId: string | null;
  /** Đã đọc xong AsyncStorage chưa — tránh render trước khi có giá trị. */
  hydrated: boolean;
  /** Đặt request đang theo dõi (ghi AsyncStorage). */
  setActiveRequest: (requestId: string | null) => void;
  /** Xoá request đang theo dõi (gọi khi cancel/completed). */
  clearActiveRequest: () => void;
}

const ActiveRequestContext = createContext<ActiveRequestState | null>(null);

export function ActiveRequestProvider({ children }: { children: React.ReactNode }) {
  const [activeRequestId, setActiveRequestIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate 1 lần khi provider mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && stored && stored.length > 0) setActiveRequestIdState(stored);
      } catch {
        // AsyncStorage lỗi → coi như không có active request, app vẫn chạy.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setActiveRequest = useCallback((requestId: string | null) => {
    setActiveRequestIdState(requestId);
    void (async () => {
      try {
        if (requestId) await AsyncStorage.setItem(STORAGE_KEY, requestId);
        else await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {
        // Best-effort: state trong memory vẫn đúng, chỉ mất persist.
      }
    })();
  }, []);

  const clearActiveRequest = useCallback(() => setActiveRequest(null), [setActiveRequest]);

  const value = useMemo<ActiveRequestState>(
    () => ({ activeRequestId, hydrated, setActiveRequest, clearActiveRequest }),
    [activeRequestId, hydrated, setActiveRequest, clearActiveRequest],
  );

  return (
    <ActiveRequestContext.Provider value={value}>{children}</ActiveRequestContext.Provider>
  );
}

/**
 * Hook truy cập active request.
 *
 * @throws nếu gọi ngoài `ActiveRequestProvider` — để bắt lỗi wiring sớm
 *         thay vì âm thầm mất persist.
 */
export function useActiveRequest(): ActiveRequestState {
  const ctx = useContext(ActiveRequestContext);
  if (!ctx) {
    throw new Error('useActiveRequest must be used within ActiveRequestProvider');
  }
  return ctx;
}

/**
 * Non-throwing variant cho code không chắc chắn có provider (VD: screen
 * dùng chung cho cả mock mode lẫn BE mode).
 */
export function useOptionalActiveRequest(): ActiveRequestState | null {
  return useContext(ActiveRequestContext);
}
