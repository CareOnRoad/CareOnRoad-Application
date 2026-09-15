import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
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
  'Request Sent',
  'Mechanic Assigned',
  'Mechanic On The Way',
  'Mechanic Arrived',
  'Service Completed',
];

export default function RescueScreen() {
  const { vehicles, addEmergencyCall } = useApp();
  const [phase, setPhase] = useState<Phase>('select');
  const [issue, setIssue] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [eta, setEta] = useState(12);
  const [completed, setCompleted] = useState(false);
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
      if (next === timeline.length - 1) setCompleted(true);
      return next;
    });
  };

  const reset = () => {
    setPhase('select');
    setIssue(null);
    setStep(1);
    setEta(12);
    setCompleted(false);
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
      issue: issueLabel ?? 'Emergency',
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
        <AppHeader title="Emergency Rescue" variant="navy" />
        <View className="flex-1 items-center justify-center gap-5 px-8">
          <View className="size-28 items-center justify-center">
            <View className="absolute inset-0 rounded-full bg-destructive/30" />
            <View className="absolute inset-3 rounded-full bg-destructive/20" />
            <View className="relative size-20 items-center justify-center rounded-full bg-destructive">
              <Loader2 size={36} color="#ffffff" className="animate-spin" />
            </View>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold text-foreground">Finding nearby mechanics…</Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Matching you with the closest available rider for{' '}
              <Text className="font-semibold">{issueLabel}</Text>
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (phase === 'tracking') {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Mechanic Tracking" subtitle={issueLabel} onBack={reset} />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        >
          <Card className="relative h-44 overflow-hidden">
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200',
              }}
              className="absolute inset-0 size-full"
              resizeMode="cover"
            />
            <View className="absolute inset-0 bg-navy/10" />
            <View className="absolute left-3 top-3">
              <Badge className="bg-white">
                <Navigation size={12} color="#1974f7" />
                <Text className="ml-1 text-xs font-semibold text-foreground">Live tracking</Text>
              </Badge>
            </View>
            <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between rounded-2xl bg-white px-4 py-2.5 shadow-lg">
              <View className="flex-row items-center gap-2">
                <Clock size={16} color="#1974f7" />
                <Text className="text-sm font-semibold text-foreground">
                  {step >= 3 ? 'Arrived' : `ETA ${eta} min`}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">2.4 km away</Text>
            </View>
          </Card>

          <View className="mt-4">
            <MechanicCard mechanic={mechanic} />
          </View>

          <Card className="mt-4 p-4">
            <Text className="mb-3 font-bold text-foreground">Service Status</Text>
            <View className="gap-0">
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
                            'text-xs',
                            done || active ? 'text-white' : 'text-muted-foreground',
                          )}
                        >
                          {i + 1}
                        </Text>
                      </View>
                      {!last && (
                        <View
                          className={cn(
                            'my-0.5 w-0.5 flex-1',
                            done ? 'bg-green' : 'bg-border',
                          )}
                          style={{ minHeight: 28 }}
                        />
                      )}
                    </View>
                    <View className="pb-4">
                      <Text
                        className={cn(
                          'text-sm font-semibold',
                          active ? 'text-primary' : !done && !active ? 'text-muted-foreground' : 'text-foreground',
                        )}
                      >
                        {label}
                      </Text>
                      {active && (
                        <Text className="text-xs text-muted-foreground">In progress…</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {step < timeline.length - 1 ? (
              <ActionButton fullWidth className="mt-1" onPress={advance}>
                <Text className="text-sm font-semibold text-primary-foreground">
                  Simulate next step
                </Text>
              </ActionButton>
            ) : (
              <View className="mt-1 gap-3">
                <View className="flex-row items-center justify-center gap-2 rounded-2xl bg-green/10 py-3">
                  <Text className="text-sm font-semibold text-green">
                    ✓ Service completed successfully
                  </Text>
                </View>

                {saved ? (
                  <View className="rounded-2xl border border-green/30 bg-green/5 p-4">
                    <Text className="text-center text-sm font-semibold text-green">
                      Saved to Emergency History
                    </Text>
                    <Text className="mt-1 text-center text-xs text-muted-foreground">
                      Bạn có thể xem lại trong tab Schedule → Emergency History.
                    </Text>
                  </View>
                ) : (
                  <Card className="gap-3 p-4">
                    <Text className="text-sm font-semibold text-foreground">Service summary</Text>
                    <Field label="Mô tả hư hại">
                      <FormTextInput
                        multiline
                        numberOfLines={3}
                        value={damageDesc}
                        onChangeText={setDamageDesc}
                        placeholder="Ví dụ: Lốp trước bị đâm đinh, xẹp hoàn toàn..."
                        className="min-h-[80px]"
                      />
                    </Field>
                    <Field label="Nội dung đã sửa chữa">
                      <FormTextInput
                        multiline
                        numberOfLines={3}
                        value={repairs}
                        onChangeText={setRepairs}
                        placeholder="Ví dụ: Thay lốp mới, cân bằng bánh trước..."
                        className="min-h-[80px]"
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
                    <ActionButton fullWidth onPress={handleSave}>
                      <Save size={16} color="#ffffff" />
                      <Text className="text-sm font-semibold text-primary-foreground">
                        Save to Emergency History
                      </Text>
                    </ActionButton>
                  </Card>
                )}

                <ActionButton fullWidth variant="outline" onPress={reset}>
                  <RotateCcw size={16} color="#16202f" />
                  <Text className="text-sm font-semibold text-foreground">New request</Text>
                </ActionButton>
              </View>
            )}
          </Card>

          <ActionButton fullWidth variant="secondary" className="mt-4">
            <PhoneCall size={16} color="#16202f" />
            <Text className="text-sm font-semibold text-secondary-foreground">
              Call emergency hotline
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
      <AppHeader title="Emergency Rescue" variant="navy" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        <Card className="overflow-hidden border-0 bg-destructive">
          <View className="flex-row items-center gap-4 p-5">
            <View className="size-16 items-center justify-center">
              <View className="absolute inset-0 rounded-full bg-white/20" />
              <View className="relative size-14 items-center justify-center rounded-full bg-white/15">
                <Siren size={28} color="#ffffff" />
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">Need help right now?</Text>
              <Text className="text-sm text-white/85">
                Pick an issue below and we'll dispatch the nearest mechanic.
              </Text>
            </View>
          </View>
        </Card>

        <View className="mt-5">
          <Text className="mb-3 font-bold text-foreground">What's the problem?</Text>
          <View className="flex-row flex-wrap gap-3">
            {issueCategories.map((cat) => {
              const Icon = iconMap[cat.icon];
              const selected = issue === cat.id;
              return (
                <View
                  key={cat.id}
                  className={cn(
                    'w-[48%] rounded-2xl border p-4 active:scale-[0.97]',
                    selected ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  )}
                >
                  <Pressable onPress={() => setIssue(cat.id)} className="flex-row items-center gap-3">
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
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        <Card className="mt-5 p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-10 items-center justify-center rounded-xl bg-primary/10">
              <MapPin size={20} color="#1974f7" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground">Your location</Text>
              <Text className="text-sm font-semibold text-foreground">
                124 Nguyen Van Cu, District 5, HCMC
              </Text>
            </View>
            <Text className="text-sm font-semibold text-primary">Change</Text>
          </View>
        </Card>

        <Card className="mt-3 flex-row items-center justify-between bg-navy p-4">
          <View className="flex-row items-center gap-3">
            <Clock size={20} color="#a9ffad" />
            <View>
              <Text className="text-xs text-white/70">Estimated arrival</Text>
              <Text className="font-bold text-white">8–14 minutes</Text>
            </View>
          </View>
          <View className="rounded-full bg-white/15 px-2.5 py-1">
            <Text className="text-xs font-semibold text-white">{mockMechanics.length} nearby</Text>
          </View>
        </Card>

        <ActionButton
          fullWidth
          variant="destructive"
          disabled={!issue}
          className="mt-5 py-4"
          onPress={() => setPhase('searching')}
        >
          <Siren size={20} color="#ffffff" />
          <Text className="text-base font-semibold text-destructive-foreground">
            Request Assistance
          </Text>
        </ActionButton>

        <View className="mt-5">
          <AiChatbox />
        </View>
      </ScrollView>
    </View>
  );
}
