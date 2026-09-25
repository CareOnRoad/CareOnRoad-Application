import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Clock, MapPin, RefreshCw, Tag, Wrench } from 'lucide-react-native';

import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionButton } from '@/components/ui/action-button';
import { cn } from '@/lib/utils';
import {
  acceptOffer,
  declineOffer,
  distanceLabel,
  listMyOffers,
  offerStatusLabel,
  type DispatchOffer,
} from '@/lib/dispatch-service';

/**
 * MechanicOffersScreen - danh sách offer dispatch cho thợ hiện tại.
 *
 * - Polling mỗi 15s cho offer mới.
 * - Accept → điều hướng tới job detail.
 * - Decline → xác nhận trước khi gọi BE.
 * - Tự reload khi quay lại screen.
 */
const POLL_MS = 15000;

export default function MechanicOffersScreen() {
  const router = useRouter();
  const { isBackendConfigured } = useAuth();
  const [offers, setOffers] = useState<DispatchOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

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
        title="Offers"
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
      </ScrollView>
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
            Request {offer.request_id.slice(0, 8)}
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
