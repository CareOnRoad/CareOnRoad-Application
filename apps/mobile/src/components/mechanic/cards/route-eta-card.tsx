import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Clock, MapPin, RefreshCw } from 'lucide-react-native';

import { Card } from '@/components/ui/card';
import { Banner } from '@/components/ui/banner';
import { ApiError } from '@/lib/api';
import { getRouteEta } from '@/lib/assignments-service';
import type { RouteEtaResponse } from '@/lib/service-requests-service';

/**
 * RouteEtaCard - hiển thị ETA tham khảo từ vị trí thợ → vị trí pickup.
 *
 * BE: `GET /api/v1/assignments/{id}/route-eta`
 *  - Provider: `google_routes` (mặc định cho two-wheeler) hoặc
 *    `distance_fallback` (đường thẳng, controlled).
 *  - BE cache 30s + dedup → không cần poll tự động, chỉ load 1 lần
 *    khi mount + cho phép user refresh thủ công.
 *
 * Guard chống crash UI:
 *  - Wrap try/catch quanh fetch; 404/503 silent fail với banner nhẹ.
 *  - `distance_m`/`duration_seconds` có thể undefined → fallback "—".
 *  - Component unmount giữa lúc fetch → `cancelled` flag, không setState.
 *  - Style động (opacity) qua `style={({ pressed }) => [...]}`, không nhồi className.
 */

export interface RouteEtaCardProps {
  assignmentId: string;
  /** Có hiển thị card không. Parent guard theo `beStatus in ['accepted','en_route','on_site']`. */
  canShow: boolean;
}

function formatKm(meters: number | undefined): string {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) {
    return '—';
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  if (seconds < 60) return `${Math.round(seconds)} giây`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return remainMin > 0 ? `${hours} giờ ${remainMin} phút` : `${hours} giờ`;
}

function providerLabel(p: string | undefined): string {
  if (p === 'google_routes') return 'Google Routes';
  if (p === 'straight_line_fallback') return 'Khoảng cách ước lượng';
  if (p === 'none') return 'Chưa có dữ liệu';
  return p ?? '—';
}

export function RouteEtaCard({ assignmentId, canShow }: RouteEtaCardProps) {
  const [data, setData] = useState<RouteEtaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEta = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    try {
      const res = await getRouteEta(assignmentId);
      if (!cancelled) {
        setData(res);
      }
    } catch (e) {
      if (cancelled) return;
      // 404 = feature disabled, 503 = upstream unavailable. UI không cần
      // crash; chỉ hiển thị banner nhẹ với nút thử lại.
      if (e instanceof ApiError && (e.status === 404 || e.status === 503)) {
        setError('Tính năng ETA tạm thời không khả dụng.');
      } else {
        setError(e instanceof Error ? e.message : 'Không lấy được ETA.');
      }
      setData(null);
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  useEffect(() => {
    if (!canShow) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getRouteEta(assignmentId);
        if (!cancelled) setData(res);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 503)) {
          setError('Tính năng ETA tạm thời không khả dụng.');
        } else {
          setError(e instanceof Error ? e.message : 'Không lấy được ETA.');
        }
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, canShow]);

  if (!canShow) return null;

  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <View className="size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <MapPin size={20} color="#1974f7" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground">ETA tới điểm đón</Text>
          <Text className="mt-0.5 text-[11px] text-muted-foreground">
            Ước lượng từ vị trí thợ · {providerLabel(data?.source)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới ETA"
          onPress={() => void fetchEta()}
          disabled={loading}
          className="size-9 items-center justify-center rounded-full bg-secondary active:opacity-60"
          style={({ pressed }) => [{ opacity: pressed || loading ? 0.6 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#1974f7" />
          ) : (
            <RefreshCw size={14} color="#16202f" />
          )}
        </Pressable>
      </View>

      {data ? (
        <View className="mt-3 flex-row gap-4 border-t border-border pt-3">
          <View className="flex-1">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Khoảng cách
            </Text>
            <Text className="mt-0.5 text-base font-bold text-foreground">
              {formatKm(data.distance_meters)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Thời gian
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1">
              <Clock size={14} color="#1974f7" />
              <Text className="text-base font-bold text-foreground">
                {formatDuration(data.duration_seconds)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {error ? (
        <View className="mt-3">
          <Banner
            tone="warning"
            title="Không lấy được ETA"
            description={error}
          />
        </View>
      ) : null}

      {!data && !error && !loading ? (
        <Text className="mt-3 text-xs text-muted-foreground">
          Chưa có dữ liệu. Bấm nút làm mới để thử lại.
        </Text>
      ) : null}
    </Card>
  );
}
