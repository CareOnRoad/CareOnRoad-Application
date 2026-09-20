import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Check, MapPin, Wrench } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Banner } from '@/components/ui/banner';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { Field, FormTextInput } from '@/components/ui/form';
import { getServiceRequest, type ServiceRequestResponse } from '@/lib/service-requests-service';

/**
 * ConfirmedScreen - thông báo đặt lịch thành công (BE-wired).
 *
 * Hiển thị service-request code từ BE + thông tin lịch hẹn.
 */
export default function ConfirmedScreen() {
  const { id, code } = useLocalSearchParams<{ id?: string; code?: string }>();
  const [request, setRequest] = useState<ServiceRequestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await getServiceRequest(id);
        if (!cancelled) setRequest(r);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Không thể tải lịch');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Đặt lịch thành công" />
        <View className="flex-1 items-center justify-center px-8">
          <Banner
            tone="warning"
            title="Không tìm thấy lịch"
            description="Vui lòng thử đặt lại."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
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

        {/* Mã yêu cầu */}
        <Card className="border-primary/30 bg-primary/5 p-4">
          <Text className="text-xs text-muted-foreground">Mã yêu cầu</Text>
          <Text className="font-mono text-xl font-bold text-foreground">
            {code ?? request?.request_code ?? id}
          </Text>
          {request?.status && (
            <View className="mt-1">
              <Text className="text-xs text-muted-foreground">Trạng thái: {request.status}</Text>
            </View>
          )}
        </Card>

        {loading && (
          <View className="mt-6 items-center">
            <ActivityIndicator color="#1974f7" />
          </View>
        )}

        {error && (
          <View className="mt-4">
            <Banner tone="error" description={error} />
          </View>
        )}

        {request && (
          <Card className="mt-4 p-4">
            <Field label="Mô tả">
              <FormTextInput
                value={request.problem_description}
                editable={false}
                multiline
                numberOfLines={2}
                className="min-h-[60px] py-2.5"
              />
            </Field>
            {request.scheduled_start_at && (
              <View className="mt-3">
                <Field label="Ngày giờ hẹn">
                  <FormTextInput
                    value={new Date(request.scheduled_start_at).toLocaleString('vi-VN')}
                    editable={false}
                  />
                </Field>
              </View>
            )}
            {request.address_text && (
              <View className="mt-3">
                <Field label="Địa điểm">
                  <FormTextInput value={request.address_text} editable={false} />
                </Field>
              </View>
            )}
          </Card>
        )}

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
    </SafeAreaView>
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
