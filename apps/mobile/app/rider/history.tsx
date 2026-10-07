import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Bike, Calendar, CheckCircle2, FileText, History, LucideIcon, Receipt, Star, Wrench } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { HeroCard } from '@/components/ui/hero-card';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { useServiceRequests } from '@/hooks/use-service-requests';
import { statusLabel, serviceTypeLabel, type ServiceRequestResponse } from '@/lib/service-requests-service';

/**
 * HistoryScreen - lịch sử dịch vụ từ backend.
 *
 * Hiển thị tất cả service-requests của rider,
 * filter completed/canceled → hiển thị trong card.
 *
 * Nếu BE chưa ready → fallback về mock services từ useApp().
 */
export default function HistoryScreen() {
  const sr = useServiceRequests();
  const [selected, setSelected] = useState<ServiceRequestResponse | null>(null);

  useEffect(() => {
    void sr.reloadList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completed = sr.list.filter((r) => r.status === 'completed');

  if (selected) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader
          title="Chi tiết dịch vụ"
          subtitle={selected.request_code}
          onBack={() => setSelected(null)}
        />
        <ScreenScroll>
          <Card className="p-5">
            <View className="flex-row items-center gap-3">
              <View className="size-12 items-center justify-center rounded-2xl bg-primary/10">
                <Wrench size={24} color="#1974f7" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold leading-tight text-foreground">
                  {serviceTypeLabel(selected.service_type)}
                </Text>
                <Badge tone="green" className="mt-1 self-start">
                  <Text className="text-xs font-semibold text-green">Hoàn tất</Text>
                </Badge>
              </View>
            </View>
            <View className="mt-4 gap-3">
              <DetailRow icon={Bike} label="Mã xe" value={selected.motorcycle_id.slice(0, 8) + '…'} />
              <DetailRow icon={Calendar} label="Ngày tạo" value={formatDate(selected.created_at)} />
              <DetailRow icon={Wrench} label="Loại dịch vụ" value={serviceTypeLabel(selected.service_type)} />
              {selected.address_text && (
                <DetailRow icon={FileText} label="Địa điểm" value={selected.address_text} />
              )}
            </View>
          </Card>
          {selected.problem_description && (
            <Card className="mt-4 p-5">
              <View className="mb-2 flex-row items-center gap-2">
                <FileText size={16} color="#1974f7" />
                <Text className="font-bold text-foreground">Mô tả vấn đề</Text>
              </View>
              <Text className="text-sm leading-relaxed text-muted-foreground">
                {selected.problem_description}
              </Text>
            </Card>
          )}

          {/* Đánh giá thợ — CTA từ màn hình history. Cùng route với (tabs)/rescue
              để logic BE + state xử lý giống nhau. */}
          {selected.status === 'completed' && (
            <Card className="mt-4 border-green/20 bg-green/5 p-4">
              <View className="flex-row items-center gap-2">
                <CheckCircle2 size={16} color="#145413" />
                <Text className="font-bold text-foreground">Hoàn tất dịch vụ</Text>
              </View>
              <Text className="mt-1 text-sm text-muted-foreground">
                Bạn có thể đánh giá thợ để giúp cộng đồng CareOnRoad.
              </Text>
              <ActionButton
                fullWidth
                className="mt-3"
                onPress={() =>
                  router.push({
                    pathname: '/rider/review',
                    params: { requestId: selected.id },
                  } as Href)
                }
                accessibilityLabel="Đánh giá thợ"
              >
                <Star size={16} color="#ffffff" />
                <Text className="text-sm font-semibold text-primary-foreground">
                  Đánh giá thợ
                </Text>
              </ActionButton>
            </Card>
          )}

          <ActionButton
            fullWidth
            variant="outline"
            className="mt-4"
            accessibilityLabel="Tải hoá đơn"
          >
            <Receipt size={16} color="#16202f" />
            <Text className="text-sm font-semibold text-foreground">Tải hoá đơn</Text>
          </ActionButton>

          <Card className="mt-5 border-primary/20 bg-primary/5 p-4">
            <Text className="text-sm text-muted-foreground">
              Hoá đơn sẽ được tạo tự động sau khi thanh toán thành công.
            </Text>
          </Card>
        </ScreenScroll>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader title="Lịch sử dịch vụ" onBack={() => router.back()} />
      <ScreenScroll>
        {/* Hero */}
        <HeroCard>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs text-white/70">Tổng dịch vụ</Text>
              <Text className="mt-1 text-2xl font-bold text-white">{completed.length}</Text>
              <Text className="mt-0.5 text-xs text-white/60">
                Cập nhật {new Date().toLocaleDateString('vi-VN')}
              </Text>
            </View>
            <View className="rounded-full bg-white/15 px-3 py-1.5">
              <Text className="text-sm font-semibold text-white">
                {sr.list.length} yêu cầu
              </Text>
            </View>
          </View>
        </HeroCard>

        {sr.listLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#1974f7" />
          </View>
        ) : sr.list.length === 0 ? (
          <View className="mt-4">
            <EmptyState
              icon={History}
              title="Chưa có lịch sử dịch vụ"
              description="Các dịch vụ đã hoàn thành sẽ hiển thị tại đây."
              action={
                <ActionButton onPress={() => router.replace('/rider/(tabs)/schedule')}>
                  <Text className="text-sm font-semibold text-primary-foreground">Đặt lịch ngay</Text>
                </ActionButton>
              }
            />
          </View>
        ) : (
          <View className="mt-5 gap-3">
            {sr.list.map((r) => (
              <HistoryCard
                key={r.id}
                request={r}
                onPress={() => router.push(`/rider/rescue/${r.id}` as Href)}
                onReviewPress={
                  r.status === 'completed'
                    ? () =>
                        router.push({
                          pathname: '/rider/review',
                          params: { requestId: r.id },
                        } as Href)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </ScreenScroll>
    </SafeAreaView>
  );
}

function HistoryCard({
  request,
  onPress,
  onReviewPress,
}: {
  request: ServiceRequestResponse;
  onPress: () => void;
  onReviewPress?: () => void;
}) {
  const isCompleted = request.status === 'completed';
  const isCanceled = request.status === 'canceled';
  const badgeTone = isCompleted ? 'green' : isCanceled ? 'neutral' : 'blue';
  const badgeText = isCompleted ? 'Hoàn tất' : isCanceled ? 'Đã huỷ' : statusLabel(request.status);

  return (
    <Card className="p-4 active:scale-[0.99]">
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mở chi tiết ${serviceTypeLabel(request.service_type)}`}
          onPress={onPress}
          className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-70"
        >
          <View className="size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Wrench size={20} color="#1974f7" />
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 truncate font-semibold leading-tight text-foreground">
                {serviceTypeLabel(request.service_type)}
              </Text>
              <Badge tone={badgeTone} className="shrink-0">
                <Text className="text-xs font-semibold">{badgeText}</Text>
              </Badge>
            </View>
            <Text className="mt-1 truncate text-xs text-muted-foreground">
              {request.request_code}
            </Text>
            <View className="mt-1.5 flex-row items-center gap-2">
              <View className="flex-row items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
                <Calendar size={12} color="#64748b" />
                <Text className="text-xs font-semibold text-secondary-foreground">
                  {formatDate(request.created_at)}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </View>
      {/* CTA Đánh giá — chỉ cho service-request đã completed.
          Nằm ngoài Pressable chính để tránh trigger card onPress khi user
          chỉ muốn bấm vào nút. Nếu rider đã review (BE trả 409) → screen
          review.tsx sẽ render banner "Bạn đã đánh giá rồi". */}
      {isCompleted && onReviewPress ? (
        <ActionButton
          fullWidth
          size="sm"
          variant="outline"
          className="mt-3"
          onPress={onReviewPress}
          accessibilityLabel="Đánh giá thợ"
        >
          <Star size={14} color="#1974f7" />
          <Text className="text-xs font-semibold text-primary">Đánh giá thợ</Text>
        </ActionButton>
      ) : null}
    </Card>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color="#64748b" />
        <Text className="text-sm text-muted-foreground">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
