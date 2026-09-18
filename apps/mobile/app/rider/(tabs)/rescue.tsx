import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
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
import { ActionButton } from '@/components/ui/action-button';
import { AiChatbox } from '@/components/ai-chatbox';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { Field, FormTextInput } from '@/components/ui/form';
import { MechanicCard } from '@/components/mechanic-card';
import { cn } from '@/lib/utils';
import { issueCategories, mockMechanics } from '@/lib/mock-data';

const iconMap: Record<string, LucideIcon> = {
  Cog,
  CircleDot,
  BatteryWarning,
  Fuel,
  TriangleAlert,
};

type Phase = 'select' | 'searching' | 'tracking';
const timeline = [
  'Đã gửi yêu cầu',
  'Đã ghép thợ',
  'Thợ đang đến',
  'Thợ đã đến nơi',
  'Hoàn tất dịch vụ',
];

/**
 * RescueScreen - yêu cầu cứu hộ khẩn cấp.
 *
 * State machine:
 *  - select: chọn loại sự cố + địa điểm → nhấn Request Assistance.
 *  - searching: tìm thợ gần nhất (mock 2.4s).
 *  - tracking: theo dõi thợ + tiến trình + điền service summary sau khi hoàn tất.
 *
 * Design principles:
 *  - Hero destructive gradient thu hút sự chú ý cho flow cứu hộ.
 *  - Issue cards dùng icon-container + text rõ ràng, dễ chạm.
 *  - Tracking timeline dùng brand-blue (active) + green (done) + slate (todo).
 */
export default function RescueScreen() {
  const { vehicles, addEmergencyCall } = useApp();
  const [phase, setPhase] = useState<Phase>('select');
  const [issue, setIssue] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [eta, setEta] = useState(12);
  const [damageDesc, setDamageDesc] = useState('');
  const [repairs, setRepairs] = useState('');
  const [price, setPrice] = useState('');
  const [saved, setSaved] = useState(false);
  const mechanic = mockMechanics[0];
  const issueLabel = issueCategories.find((i) => i.id === issue)?.label;

  useEffect(() => {
    if (phase !== 'searching') return;
    const t = setTimeout(() => {
      setPhase('tracking');
      setStep(1);
      setEta(12);
    }, 2400);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'tracking' || step >= 3) return;
    const t = setInterval(() => setEta((e) => (e > 1 ? e - 1 : 1)), 1500);
    return () => clearInterval(t);
  }, [phase, step]);

  const advance = () => {
    setStep((s) => {
      const next = Math.min(s + 1, timeline.length - 1);
      if (next >= 3) setEta(0);
      return next;
    });
  };

  const reset = () => {
    setPhase('select');
    setIssue(null);
    setStep(1);
    setEta(12);
    setDamageDesc('');
    setRepairs('');
    setPrice('');
    setSaved(false);
  };

  const vehicleName = vehicles[0]?.name ?? 'Vehicle';

  const handleSave = () => {
    if (!issue) return;
    const now = new Date();
    addEmergencyCall({
      vehicleName,
      issue: issueLabel ?? 'Khẩn cấp',
      damageDescription:
        damageDesc.trim() ||
        'Chi tiết hư hại chưa được ghi nhận. Vui lòng bổ sung sau.',
      repairs:
        repairs.trim() ||
        'Thợ đã hỗ trợ khắc phục sự cố tại chỗ và đảm bảo xe vận hành tạm ổn.',
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      mechanicName: mechanic.name,
      price: Number(price) > 0 ? Number(price) : 250000,
      status: 'completed',
    });
    setSaved(true);
  };

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
            <Text className="text-xl font-bold text-foreground">Đang tìm thợ gần bạn…</Text>
            <Text className="mt-2 px-4 text-center text-sm text-muted-foreground">
              Đang ghép thợ phù hợp cho <Text className="font-semibold text-foreground">{issueLabel}</Text>
            </Text>
          </View>
          <View className="flex-row gap-1.5">
            <Dot delay={0} />
            <Dot delay={150} />
            <Dot delay={300} />
          </View>
        </View>
      </View>
    );
  }

  if (phase === 'tracking') {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Theo dõi thợ" subtitle={issueLabel} onBack={reset} />
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
                <Text className="ml-1 text-xs font-semibold text-primary">Đang theo dõi</Text>
              </Badge>
            </View>
            <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-lg">
              <View className="flex-row items-center gap-2">
                <View className="size-8 items-center justify-center rounded-full bg-primary/10">
                  <Clock size={16} color="#1974f7" />
                </View>
                <View>
                  <Text className="text-xs text-muted-foreground">Trạng thái</Text>
                  <Text className="text-sm font-bold text-foreground">
                    {step >= 3 ? 'Đã đến nơi' : `Còn khoảng ${eta} phút`}
                  </Text>
                </View>
              </View>
              <View className="rounded-full bg-secondary px-2.5 py-1">
                <Text className="text-xs font-semibold text-secondary-foreground">2.4 km</Text>
              </View>
            </View>
          </Card>

          <View className="mt-4">
            <MechanicCard mechanic={mechanic} />
          </View>

          {/* Timeline */}
          <Card className="mt-4 p-4">
            <Text className="mb-4 font-bold text-foreground">Tiến trình dịch vụ</Text>
            <View>
              {timeline.map((label, i) => {
                const done = i < step;
                const active = i === step;
                const last = i === timeline.length - 1;
                return (
                  <View key={label} className="flex-row gap-3">
                    <View className="items-center">
                      <View
                        className={cn(
                          'size-7 items-center justify-center rounded-full border-2',
                          done && 'border-green bg-green',
                          active && 'border-primary bg-primary',
                          !done && !active && 'border-border bg-card',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-xs font-bold',
                            done || active ? 'text-white' : 'text-muted-foreground',
                          )}
                        >
                          {i + 1}
                        </Text>
                      </View>
                      {!last && (
                        <View
                          className={cn('my-0.5 w-0.5 flex-1', done ? 'bg-green' : 'bg-border')}
                          style={{ minHeight: 28 }}
                        />
                      )}
                    </View>
                    <View className="pb-4">
                      <Text
                        className={cn(
                          'text-sm font-semibold',
                          active
                            ? 'text-primary'
                            : !done && !active
                              ? 'text-muted-foreground'
                              : 'text-foreground',
                        )}
                      >
                        {label}
                      </Text>
                      {active && <Text className="mt-0.5 text-xs text-muted-foreground">Đang diễn ra…</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {step < timeline.length - 1 ? (
              <ActionButton fullWidth className="mt-2" onPress={advance} accessibilityLabel="Mô phỏng bước tiếp theo">
                <Text className="text-sm font-semibold text-primary-foreground">Mô phỏng bước tiếp theo</Text>
              </ActionButton>
            ) : (
              <View className="mt-2 gap-3">
                <View className="flex-row items-center justify-center gap-2 rounded-2xl bg-green/10 py-3">
                  <Text className="text-sm font-semibold text-green">✓ Dịch vụ đã hoàn tất</Text>
                </View>

                {saved ? (
                  <View className="rounded-2xl border border-green/30 bg-green/5 p-4">
                    <Text className="text-center text-sm font-semibold text-green">
                      Đã lưu vào lịch sử cứu hộ
                    </Text>
                    <Text className="mt-1 text-center text-xs text-muted-foreground">
                      Bạn có thể xem lại trong tab Đặt lịch → Lịch sử cứu hộ.
                    </Text>
                  </View>
                ) : (
                  <Card className="gap-3 p-4">
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
                    <ActionButton fullWidth onPress={handleSave} accessibilityLabel="Lưu vào lịch sử cứu hộ">
                      <Save size={16} color="#ffffff" />
                      <Text className="text-sm font-semibold text-primary-foreground">Lưu vào lịch sử cứu hộ</Text>
                    </ActionButton>
                  </Card>
                )}

                <ActionButton fullWidth variant="outline" onPress={reset} accessibilityLabel="Tạo yêu cầu mới">
                  <RotateCcw size={16} color="#16202f" />
                  <Text className="text-sm font-semibold text-foreground">Yêu cầu mới</Text>
                </ActionButton>
              </View>
            )}
          </Card>

          <ActionButton fullWidth variant="secondary" className="mt-4" accessibilityLabel="Gọi tổng đài khẩn cấp">
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

        {/* Location */}
        <Card className="mt-5 p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-10 items-center justify-center rounded-xl bg-primary/10">
              <MapPin size={20} color="#1974f7" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground">Vị trí của bạn</Text>
              <Text className="text-sm font-semibold text-foreground">
                124 Nguyễn Văn Cừ, Quận 5, TP.HCM
              </Text>
            </View>
            <Pressable hitSlop={8} accessibilityLabel="Đổi vị trí">
              <Text className="text-sm font-semibold text-primary">Đổi</Text>
            </Pressable>
          </View>
        </Card>

        <Card className="mt-3 flex-row items-center justify-between bg-navy p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-9 items-center justify-center rounded-xl bg-white/10">
              <Clock size={20} color="#a9ffad" />
            </View>
            <View>
              <Text className="text-xs text-white/70">Thời gian dự kiến</Text>
              <Text className="font-bold text-white">8–14 phút</Text>
            </View>
          </View>
          <View className="rounded-full bg-white/15 px-2.5 py-1">
            <Text className="text-xs font-semibold text-white">{mockMechanics.length} thợ gần bạn</Text>
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
          disabled={!issue}
          className="mt-5 py-4"
          onPress={() => setPhase('searching')}
          accessibilityLabel="Yêu cầu hỗ trợ cứu hộ"
        >
          <Siren size={20} color="#ffffff" />
          <Text className="text-base font-semibold text-destructive-foreground">Yêu cầu hỗ trợ</Text>
        </ActionButton>

        <View className="mt-6">
          <AiChatbox />
        </View>
      </ScrollView>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <View
      className="size-2 rounded-full bg-destructive"
      style={{ opacity: 0.4 }}
      // Note: animationDelay không phải style native - để đơn giản hiển thị tĩnh
    />
  );
}
