import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import {
  BatteryWarning,
  CircleDot,
  Clock,
  Cog,
  Fuel,
  Loader2,
  LucideIcon,
  MapPin,
  Navigation,
  PhoneCall,
  RefreshCcw,
  Siren,
  TriangleAlert,
} from 'lucide-react-native';

import { useApp } from '@/contexts/app-context';
import { useServiceRequests } from '@/hooks/use-service-requests';
import { ActionButton } from '@/components/ui/action-button';
import { AiChatbox } from '@/components/ai-chatbox';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { Field, FormTextInput } from '@/components/ui/form';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { cn } from '@/lib/utils';
import { formatVnd } from '@/lib/quotes-service';
import { issueCategories } from '@/lib/ui-catalog';
import {
  captureCurrentLocation,
  LocationCaptureError,
  type CapturedLocation,
} from '@/lib/location-service';
import { normalizeLiveLocation } from '@/lib/assignments-service';

const iconMap: Record<string, LucideIcon> = {
  Cog,
  CircleDot,
  BatteryWarning,
  Fuel,
  TriangleAlert,
};

/** Map issue category sang problem_description mặc định (rider có thể sửa). */
const ISSUE_TO_PROBLEM: Record<string, string> = {
  engine: 'Động cơ có vấn đề, cần hỗ trợ tại chỗ.',
  tire: 'Lốp xe bị đâm/xẹp, cần thay hoặc vá lốp.',
  battery: 'Ắc quy yếu, xe không khởi động được.',
  fuel: 'Hết xăng giữa đường, cần giao xăng tận nơi.',
  accident: 'Tai nạn giao thông, cần hỗ trợ khẩn cấp.',
};

const DEFAULT_ADDRESS = '124 Nguyễn Văn Cừ, Quận 5, TP.HCM';

/**
 * RescueScreen — yêu cầu cứu hộ thật (backend-wired).
 *
 * State machine (phase):
 *  - select:    chọn loại sự cố + xe → nhấn Yêu cầu hỗ trợ
 *  - searching: spinner + polling mỗi 5s
 *  - tracking:  đã có mechanic, hiển thị ETA + mechanic card
 *  - quote:     có báo giá pending, hiển thị để duyệt/từ chối
 *  - payment:   đã duyệt, đang chờ thanh toán (Phase 6 sẽ hook vào)
 *  - completed: hoàn tất, có nút đánh giá
 *  - canceled:  đã huỷ
 */
export default function RescueScreen() {
  const { vehicles } = useApp();
  const sr = useServiceRequests();
  const [issue, setIssue] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [captured, setCaptured] = useState<CapturedLocation | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Tự động lấy vị trí hiện tại 1 lần khi mở màn hình.
  // Nếu thất bại → vẫn cho phép user nhập tay.
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

  const issueLabel = issueCategories.find((i) => i.id === issue)?.label;
  const vehicle = vehicles[0];
  const vehicleName = vehicle?.name ?? 'Xe của bạn';
  const phase = sr.active.phase;

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

  const submitRescue = async () => {
    if (!issue || !vehicle) return;
    await sr.startRescue({
      motorcycleId: vehicle.id,
      problemDescription: `${ISSUE_TO_PROBLEM[issue] ?? 'Cần hỗ trợ'} (${address || 'Vị trí hiện tại'})`,
      addressText: address,
      ...(captured ? { location: { latitude: captured.latitude, longitude: captured.longitude } } : {}),
    });
  };

  const handleCancel = async () => {
    await sr.cancel('Người dùng huỷ từ app');
  };

  const handleReset = () => {
    sr.reset();
    setIssue(null);
  };

  // Searching state
  if (phase === 'searching') {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Cứu hộ khẩn cấp" variant="navy" />
        <View className="flex-1 items-center justify-center gap-5 px-8">
          <View className="size-28 items-center justify-center">
            <View className="absolute inset-0 rounded-full bg-destructive/30" />
            <View className="absolute inset-3 rounded-full bg-destructive/20" />
            <View className="relative size-20 items-center justify-center rounded-full bg-destructive">
              <Loader2 size={36} color="#ffffff" className="animate-spin" />
            </View>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">
              {sr.active.busy ? 'Đang gửi yêu cầu…' : 'Đang tìm thợ gần bạn…'}
            </Text>
            <Text className="mt-2 px-4 text-center text-sm text-muted-foreground">
              {sr.active.round
                ? `Vòng ghép thợ #${sr.active.round.round_number} · bán kính ${(
                    sr.active.round.radius_m / 1000
                  ).toFixed(1)} km`
                : `Đang ghép thợ phù hợp cho ${issueLabel ?? 'yêu cầu của bạn'}`}
            </Text>
            {sr.active.request?.request_code && (
              <Text className="mt-2 font-mono text-xs text-muted-foreground">
                Mã yêu cầu: {sr.active.request.request_code}
              </Text>
            )}
          </View>
          <View className="flex-row gap-1.5">
            <View className="size-2 rounded-full bg-destructive" style={{ opacity: 0.4 }} />
            <View className="size-2 rounded-full bg-destructive" style={{ opacity: 0.4 }} />
            <View className="size-2 rounded-full bg-destructive" style={{ opacity: 0.4 }} />
          </View>
          <Pressable
            onPress={handleCancel}
            className="mt-4 rounded-full border border-destructive/40 bg-destructive/10 px-5 py-2.5"
            accessibilityLabel="Huỷ yêu cầu cứu hộ"
          >
            <Text className="text-sm font-semibold text-destructive">Huỷ yêu cầu</Text>
          </Pressable>
          {sr.active.lastError && (
            <View className="mt-3 w-full">
              <Banner tone="error" description={sr.active.lastError} />
            </View>
          )}
        </View>
      </View>
    );
  }

  // Tracking — mechanic đã được gán
  if (phase === 'tracking' || phase === 'quote' || phase === 'payment' || phase === 'completed') {
    const eta = sr.active.eta;
    const distanceLabel = eta?.distance_meters
      ? `${(eta.distance_meters / 1000).toFixed(1)} km`
      : '—';
    const etaLabel =
      eta?.status === 'available' && eta.duration_seconds
        ? `~${Math.max(1, Math.round(eta.duration_seconds / 60))} phút`
        : eta?.status === 'fallback'
          ? 'Đang tính…'
          : '—';

    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Theo dõi thợ" subtitle={issueLabel} onBack={handleReset} />
        <ScreenScroll>
          {/* Map hero */}
          <Card className="relative h-44 overflow-hidden">
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200',
              }}
              className="absolute inset-0 size-full"
              resizeMode="cover"
            />
            <View className="absolute inset-0 bg-navy/30" />
            <View className="absolute left-3 top-3">
              <Badge className="bg-white" tone="blue">
                <Navigation size={12} color="#1974f7" />
                <Text className="ml-1 text-xs font-semibold text-primary">
                  {phase === 'tracking' ? 'Đang theo dõi' : statusLabelForPhase(phase)}
                </Text>
              </Badge>
            </View>
            <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-lg">
              <View className="flex-row items-center gap-2">
                <View className="size-8 items-center justify-center rounded-full bg-primary/10">
                  <Clock size={16} color="#1974f7" />
                </View>
                <View>
                  <Text className="text-xs text-muted-foreground">ETA</Text>
                  <Text className="text-sm font-bold text-foreground">{etaLabel}</Text>
                </View>
              </View>
              <View className="rounded-full bg-secondary px-2.5 py-1">
                <Text className="text-xs font-semibold text-secondary-foreground">{distanceLabel}</Text>
              </View>
            </View>
          </Card>

          {/* Thông tin assignment */}
          <Card className="mt-4 p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-muted-foreground">Mã yêu cầu</Text>
                <Text className="font-mono text-sm font-bold text-foreground">
                  {sr.active.request?.request_code ?? '—'}
                </Text>
              </View>
              <Badge tone="blue">
                <Text className="text-xs font-semibold text-primary">
                  {sr.active.request?.status ?? '—'}
                </Text>
              </Badge>
            </View>
            {sr.active.assignment && (
              <View className="mt-3 flex-row items-center gap-3 rounded-2xl bg-secondary px-3 py-2.5">
                <View className="size-8 items-center justify-center rounded-full bg-primary/20">
                  <Navigation size={14} color="#1974f7" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground">Thợ đã nhận</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    Mã thợ: {sr.active.assignment.mechanic_id.slice(0, 8)}…
                  </Text>
                </View>
              </View>
            )}
            {sr.active.liveLocation && (() => {
              const loc = normalizeLiveLocation(sr.active.liveLocation);
              if (!loc) return null;
              return (
                <View className="mt-2 rounded-xl bg-secondary px-3 py-2">
                  <Text className="text-xs text-muted-foreground">
                    Vị trí thợ: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} (cập nhật{' '}
                    {loc.ageSeconds}s trước)
                  </Text>
                </View>
              );
            })()}
            {sr.active.requestId && (
              <View className="mt-3 border-t border-border pt-3">
                <ActionButton
                  variant="outline"
                  fullWidth
                  onPress={() =>
                    router.push(`/rider/rescue/${sr.active.requestId}` as Href)
                  }
                  accessibilityLabel="Mở chi tiết yêu cầu"
                >
                  <Text className="text-sm font-semibold text-foreground">Mở trang chi tiết</Text>
                </ActionButton>
              </View>
            )}
          </Card>

          {/* Quote card (nếu có) */}
          {sr.active.quote && (
            <Card className="mt-4 p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm font-bold text-foreground">
                  Báo giá v{sr.active.quote.version}
                </Text>
                <Badge tone="amber">
                  <Text className="text-xs font-semibold text-amber-700">Chờ duyệt</Text>
                </Badge>
              </View>
              <View className="gap-1.5">
                {sr.active.quote.lines.map((line) => (
                  <View key={line.id} className="flex-row items-center justify-between">
                    <Text className="flex-1 text-sm text-foreground">
                      {line.description}{' '}
                      <Text className="text-xs text-muted-foreground">
                        × {line.quantity}
                      </Text>
                    </Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatVnd(line.line_total_amount)}
                    </Text>
                  </View>
                ))}
              </View>
              <View className="mt-2 border-t border-border pt-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground">Tạm tính</Text>
                  <Text className="text-sm text-foreground">
                    {formatVnd(sr.active.quote.subtotal_amount)}
                  </Text>
                </View>
                {sr.active.quote.discount_amount > 0 && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted-foreground">Giảm giá</Text>
                    <Text className="text-sm text-foreground">
                      -{formatVnd(sr.active.quote.discount_amount)}
                    </Text>
                  </View>
                )}
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className="text-base font-bold text-foreground">Tổng</Text>
                  <Text className="text-base font-bold text-primary">
                    {formatVnd(sr.active.quote.total_amount)}
                  </Text>
                </View>
              </View>
              {phase === 'quote' && (
                <View className="mt-3 flex-row gap-2">
                  <ActionButton
                    variant="outline"
                    fullWidth
                    onPress={() => sr.rejectQuote()}
                    accessibilityLabel="Từ chối báo giá"
                  >
                    <Text className="text-sm font-semibold text-foreground">Từ chối</Text>
                  </ActionButton>
                  <ActionButton
                    fullWidth
                    onPress={() => sr.approveQuote()}
                    accessibilityLabel="Duyệt báo giá"
                    disabled={sr.active.busy}
                  >
                    <Text className="text-sm font-semibold text-primary-foreground">Duyệt</Text>
                  </ActionButton>
                </View>
              )}
            </Card>
          )}

          {/* Phase payment - placeholder, Phase 6 sẽ render QR */}
              {phase === 'payment' && (
                <Card className="mt-4 border-amber-500/40 bg-amber-500/10 p-4">
                  <View className="flex-row items-center gap-2">
                    <Badge tone="amber">
                      <Text className="text-xs font-semibold text-amber-700">Chờ thanh toán</Text>
                    </Badge>
                  </View>
                  <Text className="mt-2 text-sm text-foreground">
                    Báo giá đã được duyệt. Vui lòng thanh toán để thợ bắt đầu công việc.
                  </Text>
                  {sr.active.quote && (
                    <Text className="mt-1 text-base font-bold text-primary">
                      {formatVnd(sr.active.quote.total_amount)}
                    </Text>
                  )}
                  <ActionButton
                    fullWidth
                    className="mt-3"
                    onPress={() => {
                      if (sr.active.quote && sr.active.requestId) {
                        router.push({
                          pathname: '/rider/payments/[quoteId]',
                          params: {
                            quoteId: sr.active.quote.id,
                            requestId: sr.active.requestId,
                          },
                        });
                      }
                    }}
                    accessibilityLabel="Mở màn hình thanh toán"
                  >
                    <Text className="text-sm font-semibold text-primary-foreground">
                      Thanh toán ngay
                    </Text>
                  </ActionButton>
                  <Text className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Bạn sẽ được chuyển sang màn hình thanh toán PayOS. Vui lòng hoàn tất
                    trong thời gian đơn hàng còn hiệu lực.
                  </Text>
                </Card>
              )}

          {/* Phase completed — review */}
          {phase === 'completed' && sr.active.assignment && (
            <Card className="mt-4 p-4">
              <Text className="font-bold text-foreground">Hoàn tất dịch vụ</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Bạn có thể đánh giá thợ để giúp cộng đồng CareOnRoad.
              </Text>
              <ActionButton
                fullWidth
                className="mt-3"
                onPress={() => {
                  if (sr.active.requestId) {
                    router.push({
                      pathname: '/rider/review',
                      params: { requestId: sr.active.requestId },
                    });
                  }
                }}
                accessibilityLabel="Đánh giá thợ"
              >
                <Text className="text-sm font-semibold text-primary-foreground">Đánh giá thợ</Text>
              </ActionButton>
            </Card>
          )}

          {sr.active.lastError && (
            <View className="mt-3">
              <Banner tone="error" description={sr.active.lastError} />
            </View>
          )}

          <ActionButton
            fullWidth
            variant="secondary"
            className="mt-4"
            accessibilityLabel="Gọi tổng đài khẩn cấp"
            onPress={() => Linking.openURL('tel:113').catch(() => undefined)}
          >
            <PhoneCall size={16} color="#16202f" />
            <Text className="text-sm font-semibold text-secondary-foreground">
              Gọi tổng đài khẩn cấp
            </Text>
          </ActionButton>

          <View className="mt-4">
            <AiChatbox />
          </View>
        </ScreenScroll>
      </View>
    );
  }

  // Phase canceled
  if (phase === 'canceled') {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Đã huỷ" onBack={handleReset} />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="info"
            title="Yêu cầu đã được huỷ"
            description="Bạn có thể tạo yêu cầu cứu hộ mới bất kỳ lúc nào."
          />
          <ActionButton className="mt-5" onPress={handleReset}>
            <Text className="text-sm font-semibold text-primary-foreground">Tạo yêu cầu mới</Text>
          </ActionButton>
        </View>
      </View>
    );
  }

  // Phase idle / select — form nhập
  if (!vehicle) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Cứu hộ khẩn cấp" variant="navy" />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="warning"
            title="Chưa có xe nào"
            description="Vui lòng thêm xe trước khi gửi yêu cầu cứu hộ."
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Cứu hộ khẩn cấp" variant="navy" />
      <ScreenScroll>
        {/* Hero destructive */}
        <Card className="overflow-hidden border-0 bg-destructive">
          <View className="flex-row items-center gap-4 p-5">
            <View className="size-16 items-center justify-center">
              <View className="absolute inset-0 rounded-full bg-white/20" />
              <View className="relative size-14 items-center justify-center rounded-full bg-white/15">
                <Siren size={28} color="#ffffff" />
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">Cần hỗ trợ ngay?</Text>
              <Text className="text-sm text-white/85">
                Chọn sự cố bên dưới, hệ thống sẽ ghép thợ gần nhất.
              </Text>
            </View>
          </View>
        </Card>

        {/* Issue selector */}
        <View className="mt-6">
          <Text className="mb-3 font-bold text-foreground">Sự cố của bạn là gì?</Text>
          <View className="flex-row flex-wrap gap-3">
            {issueCategories.map((cat) => {
              const Icon = iconMap[cat.icon];
              const selected = issue === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Chọn sự cố ${cat.label}`}
                  onPress={() => setIssue(cat.id)}
                  className={cn(
                    'w-[48%] rounded-2xl border p-4 active:scale-[0.97]',
                    selected ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  )}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={cn(
                        'size-10 shrink-0 items-center justify-center rounded-xl',
                        selected ? 'bg-primary' : 'bg-secondary',
                      )}
                    >
                      <Icon size={20} color={selected ? '#ffffff' : '#16202f'} />
                    </View>
                    <Text className="flex-1 text-sm font-semibold leading-tight text-foreground">
                      {cat.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Vehicle + Location */}
        <Card className="mt-5 p-4">
          <View className="flex-row items-start gap-3">
            <View className="size-10 items-center justify-center rounded-xl bg-primary/10">
              <MapPin size={20} color="#1974f7" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">Vị trí & xe</Text>
                {captured && (
                  <View className="flex-row items-center gap-1 rounded-full bg-green/10 px-2 py-0.5">
                    <Navigation size={10} color="#145413" />
                    <Text className="text-[10px] font-semibold text-green">
                      GPS · ±{Math.round(captured.accuracy ?? 0)}m
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-sm font-semibold text-foreground">{vehicleName}</Text>
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

        {!issue && (
          <View className="mt-4">
            <Banner
              tone="info"
              description="Vui lòng chọn sự cố trước khi gửi yêu cầu cứu hộ."
            />
          </View>
        )}

        <ActionButton
          fullWidth
          variant="destructive"
          disabled={!issue || sr.active.busy}
          className="mt-5 py-4"
          onPress={submitRescue}
          accessibilityLabel="Yêu cầu hỗ trợ cứu hộ"
        >
          <Siren size={20} color="#ffffff" />
          <Text className="text-base font-semibold text-destructive-foreground">
            {sr.active.busy ? 'Đang gửi…' : 'Yêu cầu hỗ trợ'}
          </Text>
        </ActionButton>

        {sr.active.lastError && (
          <View className="mt-3">
            <Banner tone="error" description={sr.active.lastError} />
          </View>
        )}

        <View className="mt-6">
          <AiChatbox />
        </View>
      </ScreenScroll>
    </View>
  );
}

function statusLabelForPhase(p: 'tracking' | 'quote' | 'payment' | 'completed' | 'canceled'): string {
  switch (p) {
    case 'tracking':
      return 'Thợ đang đến';
    case 'quote':
      return 'Chờ duyệt báo giá';
    case 'payment':
      return 'Chờ thanh toán';
    case 'completed':
      return 'Hoàn tất';
    case 'canceled':
      return 'Đã huỷ';
    default:
      return '';
  }
}
