import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  listServiceRequests,
  type ServiceRequestResponse,
} from '@/lib/service-requests-service';

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
 *
 * Vì sao `list` cũng nằm trong context:
 *  - Trước đây `list` nằm trong `useState` cục bộ của từng hook instance
 *    → tab "Theo dõi" và tab Home mỗi screen một bản riêng, và không tự
 *    nạp khi mount → sau khi restart app, tab Theo dõi hiện "Chưa có yêu
 *    cầu đang chạy" dù job đang chạy, banner "Yêu cầu đang chạy" ở Home
 *    cũng trống.
 *  - Đưa vào context → 1 nguồn sự thật chung, provider tự hydrate 1 lần
 *    lúc mount, mọi screen đọc cùng 1 danh sách.
 */

export const ACTIVE_REQUEST_STORAGE_KEY = '@careonroad/rider/active_request_id';

interface ActiveRequestState {
  /** Request id đang theo dõi, `null` nếu không có. */
  activeRequestId: string | null;
  /** Đã đọc xong AsyncStorage chưa — tránh render trước khi có giá trị. */
  hydrated: boolean;
  /** Đặt request đang theo dõi (ghi AsyncStorage). */
  setActiveRequest: (requestId: string | null) => void;
  /** Xoá request đang theo dõi (gọi khi cancel/completed). */
  clearActiveRequest: () => void;
  /** Danh sách service-requests của rider (nguồn chung cho mọi screen). */
  list: ServiceRequestResponse[];
  listLoading: boolean;
  listError: string | null;
  /** Nạp lại danh sách từ BE. Identity ổn định (useCallback deps rỗng). */
  reloadList: () => Promise<void>;
}

const ActiveRequestContext = createContext<ActiveRequestState | null>(null);

export function ActiveRequestProvider({ children }: { children: React.ReactNode }) {
  const [activeRequestId, setActiveRequestIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Danh sách request — nằm ở provider để mọi screen dùng chung.
  const [list, setList] = useState<ServiceRequestResponse[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Hydrate 1 lần khi provider mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(ACTIVE_REQUEST_STORAGE_KEY);
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

  /**
   * Nạp danh sách service-requests từ BE.
   *
   * `useCallback` với deps rỗng → identity ổn định, dùng được trong deps
   * của `useEffect`/`useFocusEffect` mà không gây re-fire vô hạn.
   */
  const reloadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const items = await listServiceRequests();
      setList(items);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Không thể tải danh sách yêu cầu');
    } finally {
      setListLoading(false);
    }
  }, []);

  // Nạp list ngay khi provider mount (sau khi đã hydrate) → app mở là có
  // data, kể cả khi user vào thẳng tab nào (không phụ thuộc screen focus).
  //
  // Gọi bên trong async callback (sau `await`) để không setState đồng bộ
  // trong thân effect.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await reloadList();
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, reloadList]);

  const setActiveRequest = useCallback((requestId: string | null) => {
    setActiveRequestIdState(requestId);
    void (async () => {
      try {
        if (requestId) await AsyncStorage.setItem(ACTIVE_REQUEST_STORAGE_KEY, requestId);
        else await AsyncStorage.removeItem(ACTIVE_REQUEST_STORAGE_KEY);
      } catch {
        // Best-effort: state trong memory vẫn đúng, chỉ mất persist.
      }
    })();
  }, []);

  const clearActiveRequest = useCallback(() => setActiveRequest(null), [setActiveRequest]);

  const value = useMemo<ActiveRequestState>(
    () => ({
      activeRequestId,
      hydrated,
      setActiveRequest,
      clearActiveRequest,
      list,
      listLoading,
      listError,
      reloadList,
    }),
    [
      activeRequestId,
      hydrated,
      setActiveRequest,
      clearActiveRequest,
      list,
      listLoading,
      listError,
      reloadList,
    ],
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
