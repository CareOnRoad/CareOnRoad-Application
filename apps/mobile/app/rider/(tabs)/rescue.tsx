import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
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
  RotateCcw,
  Save,
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
import { cn } from '@/lib/utils';
import { formatVnd } from '@/lib/quotes-service';
import { issueCategories } from '@/lib/mock-data';

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
  const { vehicles, addEmergencyCall } = useApp();
  const sr = useServiceRequests();
  const [issue, setIssue] = useState<string | null>(null);
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [damageDesc, setDamageDesc] = useState('');
  const [repairs, setRepairs] = useState('');
  const [price, setPrice] = useState('');
  const [saved, setSaved] = useState(false);

  const issueLabel = issueCategories.find((i) => i.id === issue)?.label;
  const vehicle = vehicles[0];
  const vehicleName = vehicle?.name ?? 'Vehicle';
  const phase = sr.active.phase;

  const submitRescue = async () => {
    if (!issue || !vehicle) return;
    await sr.startRescue({
      motorcycleId: vehicle.id,
      problemDescription: `${ISSUE_TO_PROBLEM[issue] ?? 'Cần hỗ trợ'} (${address})`,
      addressText: address,
    });
  };

  const handleCancel = async () => {
    await sr.cancel('Người dùng huỷ từ app');
    setSaved(false);
  };

  const handleReset = () => {
    sr.reset();
    setIssue(null);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!sr.active.request) return;
    // Lưu nhanh vào local history (mock — Phase 4 sẽ lưu vào DB qua media metadata).
    const now = new Date();
    addEmergencyCall({
      vehicleName,
      issue: issueLabel ?? 'Khẩn cấp',
      damageDescription:
        damageDesc.trim() ||
        sr.active.request.problem_description ||
        'Chi tiết hư hại chưa được ghi nhận.',
      repairs:
        repairs.trim() ||
        'Thợ đã hỗ trợ khắc phục sự cố tại chỗ và đảm bảo xe vận hành tạm ổn.',
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      mechanicName: 'Thợ CareOnRoad',
      price: Number(price) > 0 ? Number(price) : sr.active.quote?.total_amount ?? 250000,
      status: 'completed',
    });
    setSaved(true);
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
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
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
            {sr.active.liveLocation && (
              <View className="mt-2 rounded-xl bg-secondary px-3 py-2">
                <Text className="text-xs text-muted-foreground">
                  Vị trí thợ: {sr.active.liveLocation.location.latitude.toFixed(4)},{' '}
                  {sr.active.liveLocation.location.longitude.toFixed(4)} (cập nhật{' '}
                  {Math.round(sr.active.liveLocation.age_seconds ?? 0)}s trước)
                </Text>
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

          {phase === 'completed' && (
            <Card className="mt-4 gap-3 p-4">
              <Text className="text-sm font-semibold text-foreground">Tóm tắt dịch vụ</Text>
              <Field label="Mô tả hư hại" hint="Không bắt buộc - dùng để theo dõi bảo hành">
                <FormTextInput
                  multiline
                  numberOfLines={3}
                  value={damageDesc}
                  onChangeText={setDamageDesc}
                  placeholder="Ví dụ: Lốp trước bị đâm đinh, xẹp hoàn toàn..."
                  className="min-h-[80px] py-2.5"
                />
              </Field>
              <Field label="Nội dung đã sửa chữa">
                <FormTextInput
                  multiline
                  numberOfLines={3}
                  value={repairs}
                  onChangeText={setRepairs}
                  placeholder="Ví dụ: Thay lốp mới, cân bằng bánh trước..."
                  className="min-h-[80px] py-2.5"
                />
              </Field>
              <Field label="Chi phí (VND)">
                <FormTextInput
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                  placeholder="250000"
                />
              </Field>
              {saved ? (
                <View className="rounded-2xl border border-green/30 bg-green/5 p-4">
                  <Text className="text-center text-sm font-semibold text-green">
                    Đã lưu vào lịch sử cứu hộ
                  </Text>
                </View>
              ) : (
                <ActionButton
                  fullWidth
                  onPress={handleSave}
                  accessibilityLabel="Lưu vào lịch sử cứu hộ"
                >
                  <Save size={16} color="#ffffff" />
                  <Text className="text-sm font-semibold text-primary-foreground">
                    Lưu vào lịch sử cứu hộ
                  </Text>
                </ActionButton>
              )}
              <ActionButton
                fullWidth
                variant="outline"
                onPress={handleReset}
                accessibilityLabel="Tạo yêu cầu mới"
              >
                <RotateCcw size={16} color="#16202f" />
                <Text className="text-sm font-semibold text-foreground">Yêu cầu mới</Text>
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
        </ScrollView>
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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
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
          <View className="flex-row items-center gap-3">
            <View className="size-10 items-center justify-center rounded-xl bg-primary/10">
              <MapPin size={20} color="#1974f7" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground">Vị trí & xe</Text>
              <Text className="text-sm font-semibold text-foreground">{vehicleName}</Text>
              <Text className="mt-1 text-xs text-muted-foreground">{address}</Text>
            </View>
          </View>
          <View className="mt-3">
            <Field label="Địa chỉ chi tiết" hint="Để trống nếu dùng vị trí GPS">
              <FormTextInput
                value={address}
                onChangeText={setAddress}
                accessibilityLabel="Địa chỉ"
                placeholder={DEFAULT_ADDRESS}
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
      </ScrollView>
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
