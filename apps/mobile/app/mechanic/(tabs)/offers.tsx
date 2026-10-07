import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Clock, MapPin, Navigation, RefreshCcw, RefreshCw, Tag, Wrench } from 'lucide-react-native';

import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionButton } from '@/components/ui/action-button';
import { Field, FormTextInput } from '@/components/ui/form';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { cn } from '@/lib/utils';
import {
  acceptOffer,
  declineOffer,
  distanceLabel,
  listMyOffers,
  offerStatusLabel,
  type DispatchOffer,
} from '@/lib/dispatch-service';
import {
  captureCurrentLocation,
  LocationCaptureError,
  type CapturedLocation,
} from '@/lib/location-service';

/**
 * MechanicOffersScreen - danh sách offer dispatch cho thợ hiện tại.
 *
 * - Polling mỗi 15s cho offer mới.
 * - Accept → điều hướng tới job detail.
 * - Decline → xác nhận trước khi gọi BE.
 * - Tự reload khi quay lại screen.
 */
const POLL_MS = 15000;
const DEFAULT_ADDRESS = '124 Nguyễn Văn Cừ, Quận 5, TP.HCM';

export default function MechanicOffersScreen() {
  const router = useRouter();
  const { isBackendConfigured } = useAuth();
  const [offers, setOffers] = useState<DispatchOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  // Vị trí GPS thu được từ thiết bị - dùng để xem trước + check vị trí
  // (giống pattern "Vị trí & xe" trong screen rescue của rider).
  const [captured, setCaptured] = useState<CapturedLocation | null>(null);
  const [address, setAddress] = useState<string>('');
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isBackendConfigured) {
      setOffers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listMyOffers();
      // Chỉ lấy offer 'offered' đang chờ
      setOffers(res.items.filter((o) => o.status === 'offered'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải danh sách offer');
    } finally {
      setLoading(false);
    }
  }, [isBackendConfigured]);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  // Reload khi screen focus lại (sau khi accept xong navigate)
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Tự động lấy vị trí hiện tại 1 lần khi mở màn hình.
  // Nếu thất bại → vẫn cho phép user nhập tay địa chỉ.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLocationBusy(true);
      setLocationError(null);
      try {
        const loc = await captureCurrentLocation();
        if (cancelled) return;
        setCaptured(loc);
        // Autofill chỉ khi user chưa sửa gì
        setAddress((prev) => (prev.trim() ? prev : loc.address));
      } catch (err) {
        if (cancelled) return;
        setLocationError(
          err instanceof LocationCaptureError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Không lấy được vị trí hiện tại.',
        );
      } finally {
        if (!cancelled) setLocationBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLocation = async () => {
    setLocationBusy(true);
    setLocationError(null);
    try {
      const loc = await captureCurrentLocation();
      setCaptured(loc);
      setAddress(loc.address);
    } catch (err) {
      setLocationError(
        err instanceof LocationCaptureError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Không lấy được vị trí hiện tại.',
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const handleAccept = (offer: DispatchOffer) => {
    Alert.alert(
      'Nhận offer này?',
      `Offer từ request ${offer.request_id.slice(0, 8)} sẽ trở thành công việc đang chạy.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Nhận việc',
          onPress: async () => {
            setBusyOfferId(offer.id);
            try {
              const assignment = await acceptOffer(offer.id);
              // Sau khi accept, navigate sang job detail
              router.replace({
                pathname: '/mechanic/jobs/detail',
                params: { id: assignment.id },
              });
              void reload();
            } catch (e) {
              Alert.alert(
                'Không thể nhận offer',
                e instanceof Error ? e.message : 'Lỗi không xác định',
              );
            } finally {
              setBusyOfferId(null);
            }
          },
        },
      ],
    );
  };

  const handleDecline = (offer: DispatchOffer) => {
    Alert.alert(
      'Từ chối offer?',
      `Bạn sẽ từ chối offer cho request ${offer.request_id.slice(0, 8)}. Hành động này không thể hoàn tác.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            setBusyOfferId(offer.id);
            try {
              await declineOffer(offer.id);
              void reload();
            } catch (e) {
              Alert.alert(
                'Không thể từ chối offer',
                e instanceof Error ? e.message : 'Lỗi không xác định',
              );
            } finally {
              setBusyOfferId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Yêu cầu nhận"
        subtitle={offers.length > 0 ? `${offers.length} offer chờ bạn` : 'Không có offer nào'}
        right={
          <Pressable
            accessibilityLabel="Làm mới offers"
            onPress={() => void reload()}
            className="size-9 items-center justify-center rounded-full bg-secondary active:opacity-70"
            disabled={loading}
          >
            <RefreshCw size={16} color="#16202f" className={loading ? 'opacity-50' : ''} />
          </Pressable>
        }
      />
      <ScreenScroll>
        {error && (
          <View className="mb-4">
            <Banner tone="error" description={error} />
          </View>
        )}

        {/* Vị trí của tôi - pattern giống card "Vị trí & xe" trong rescue rider.
            Giúp mechanic check nhanh toạ độ + địa chỉ GPS đang được dùng để
            dispatch offer. */}
        <Card className="mb-4 p-4">
          <View className="flex-row items-start gap-3">
            <View className="size-10 items-center justify-center rounded-xl bg-primary/10">
              <MapPin size={20} color="#1974f7" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Vị trí của tôi</Text>
                {captured && (
                  <View className="flex-row items-center gap-1 rounded-full bg-green/10 px-2 py-0.5">
                    <Navigation size={10} color="#145413" />
                    <Text className="text-[10px] font-semibold text-green">
                      GPS · ±{Math.round(captured.accuracy ?? 0)}m
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {captured
                  ? `${captured.latitude.toFixed(4)}, ${captured.longitude.toFixed(4)}`
                  : locationBusy
                    ? 'Đang xác định vị trí…'
                    : 'Chưa có toạ độ'}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                {address || (locationBusy ? 'Đang xác định vị trí…' : 'Chưa có địa chỉ')}
              </Text>
            </View>
            <Pressable
              onPress={refreshLocation}
              disabled={locationBusy}
              accessibilityLabel="Cập nhật vị trí hiện tại"
              className={cn(
                'size-9 items-center justify-center rounded-full border border-border bg-secondary active:scale-95',
                locationBusy && 'opacity-50',
              )}
            >
              {locationBusy ? (
                <ActivityIndicator size="small" color="#1974f7" />
              ) : (
                <RefreshCcw size={14} color="#16202f" />
              )}
            </Pressable>
          </View>
          {locationError && (
            <View className="mt-3">
              <Banner
                tone="warning"
                title="Không lấy được vị trí"
                description={`${locationError} Bạn có thể nhập tay bên dưới.`}
              />
            </View>
          )}
          <View className="mt-3">
            <Field label="Địa chỉ chi tiết" hint="Có thể chỉnh sửa nếu GPS chưa chính xác">
              <FormTextInput
                value={address}
                onChangeText={setAddress}
                accessibilityLabel="Địa chỉ"
                placeholder={captured ? captured.address : DEFAULT_ADDRESS}
                multiline
              />
            </Field>
          </View>
        </Card>

        {!isBackendConfigured ? (
          <EmptyState
            icon={Wrench}
            tone="primary"
            title="Chưa kết nối backend"
            description="Đăng nhập bằng tài khoản mechanic để nhận offer từ khách hàng."
          />
        ) : loading && offers.length === 0 ? (
          <View className="items-center py-12">
            <ActivityIndicator color="#1974f7" />
          </View>
        ) : offers.length === 0 ? (
          <EmptyState
            icon={Tag}
            tone="primary"
            title="Chưa có offer mới"
            description="Khi có khách hàng gần bạn cần cứu hộ, offer sẽ xuất hiện tại đây."
          />
        ) : (
          <View className="gap-3">
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                busy={busyOfferId === o.id}
                onAccept={() => handleAccept(o)}
                onDecline={() => handleDecline(o)}
              />
            ))}
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}

function OfferCard({
  offer,
  busy,
  onAccept,
  onDecline,
}: {
  offer: DispatchOffer;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const expired = offer.expires_at ? new Date(offer.expires_at).getTime() < Date.now() : false;
  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center justify-between bg-primary px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Wrench size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-white" numberOfLines={1}>
            Yêu cầu {offer.request_id.slice(0, 8)}
          </Text>
        </View>
        <View className="rounded-full bg-white/15 px-2.5 py-1">
          <Text className="text-xs font-semibold text-white">{offerStatusLabel(offer.status)}</Text>
        </View>
      </View>
      <View className="gap-3 p-4">
        <View className="flex-row items-center gap-2">
          <View className="size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <MapPin size={16} color="#1974f7" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-xs text-muted-foreground">Khoảng cách</Text>
            <Text className="text-sm font-semibold text-foreground">
              {distanceLabel(offer.distance_m)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            <Tag size={16} color="#d97706" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-xs text-muted-foreground">Hạng</Text>
            <Text className="text-sm font-semibold text-foreground">#{offer.rank}</Text>
          </View>
        </View>
        {offer.expires_at && (
          <View className="flex-row items-center gap-2">
            <View
              className={cn(
                'size-9 shrink-0 items-center justify-center rounded-xl',
                expired ? 'bg-destructive/10' : 'bg-green/10',
              )}
            >
              <Clock size={16} color={expired ? '#ed3f3a' : '#145413'} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-xs text-muted-foreground">Hết hạn</Text>
              <Text
                className={cn(
                  'text-sm font-semibold',
                  expired ? 'text-destructive' : 'text-foreground',
                )}
              >
                {new Date(offer.expires_at).toLocaleString('vi-VN')}
              </Text>
            </View>
          </View>
        )}
      </View>
      <View className="flex-row gap-2 border-t border-border px-4 py-3">
        <ActionButton
          variant="destructive"
          fullWidth
          onPress={onDecline}
          disabled={busy || expired}
          accessibilityLabel="Từ chối offer"
        >
          <Text className={cn('text-xs font-semibold', expired ? 'text-muted-foreground' : 'text-destructive-foreground')}>
            Từ chối
          </Text>
        </ActionButton>
        <ActionButton
          variant="primary"
          fullWidth
          onPress={onAccept}
          disabled={busy || expired}
          accessibilityLabel="Nhận offer"
        >
          <Text className="text-xs font-semibold text-primary-foreground">
            {busy ? 'Đang xử lý…' : 'Nhận việc'}
          </Text>
        </ActionButton>
      </View>
    </Card>
  );
}
