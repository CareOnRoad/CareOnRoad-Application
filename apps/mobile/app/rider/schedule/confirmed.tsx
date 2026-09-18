import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Check, MapPin, Wrench } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { BookingCard } from '@/components/booking-card';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { useApp } from '@/contexts/app-context';

/**
 * ConfirmedScreen - thông báo đặt lịch thành công.
 *
 * Hero success animation: 3 lớp pulse + check lớn.
 * Hiển thị booking card với các thông tin đã đặt.
 * CTA: Book another service, View my bookings.
 */
export default function ConfirmedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appointments } = useApp();
  const appointment = appointments.find((a) => a.id === id);

  if (!appointment) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Đặt lịch thành công" />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="warning"
            title="Không tìm thấy lịch"
            description="Có thể lịch đã bị huỷ. Vui lòng thử đặt lại."
          />
          <ActionButton
            className="mt-5"
            onPress={() => router.replace('/rider/(tabs)/schedule')}
          >
            <Text className="text-sm font-semibold text-primary-foreground">Về trang đặt lịch</Text>
          </ActionButton>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Đặt lịch thành công" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero success */}
        <View className="mb-6 items-center gap-4 pt-6">
          <View className="size-24 items-center justify-center">
            <View className="absolute inset-0 rounded-full bg-green/15" />
            <View className="absolute inset-2 rounded-full bg-green/25" />
            <View className="relative size-16 items-center justify-center rounded-full bg-green">
              <Check size={32} color="#ffffff" strokeWidth={3} />
            </View>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-foreground">Đặt lịch thành công!</Text>
            <Text className="mt-1 px-6 text-center text-sm text-muted-foreground">
              Chúng tôi đã ghi nhận yêu cầu của bạn. Bạn sẽ nhận nhắc nhở trước giờ hẹn.
            </Text>
          </View>
        </View>

        <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Chi tiết lịch hẹn
        </Text>
        <BookingCard appointment={appointment} />

        {/* Tips */}
        <Card className="mt-5 border-primary/20 bg-primary/5 p-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
            Mẹo
          </Text>
          <View className="gap-2">
            <TipLine
              icon={MapPin}
              text="Đảm bảo vị trí xe rõ ràng, dễ tiếp cận để thợ đến nhanh hơn."
            />
            <TipLine
              icon={Wrench}
              text="Mang theo giấy tờ xe và sổ bảo hành nếu có."
            />
          </View>
        </Card>

        <View className="mt-6 gap-3">
          <ActionButton
            fullWidth
            variant="outline"
            onPress={() => router.replace('/rider/(tabs)/schedule')}
            accessibilityLabel="Về trang đặt lịch"
          >
            <Text className="text-sm font-semibold text-foreground">Về trang đặt lịch</Text>
          </ActionButton>
          <ActionButton
            fullWidth
            onPress={() => router.replace('/rider/schedule/booking')}
            accessibilityLabel="Đặt dịch vụ khác"
          >
            <Text className="text-sm font-semibold text-primary-foreground">Đặt dịch vụ khác</Text>
          </ActionButton>
        </View>
      </ScrollView>
    </View>
  );
}

function TipLine({
  icon: Icon,
  text,
}: {
  icon: typeof MapPin;
  text: string;
}) {
  return (
    <View className="flex-row items-start gap-2">
      <View className="mt-0.5 size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon size={14} color="#1974f7" />
      </View>
      <Text className="flex-1 text-sm leading-relaxed text-foreground">{text}</Text>
    </View>
  );
}
