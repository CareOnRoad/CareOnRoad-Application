import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Clock,
  CreditCard,
  Receipt,
  ShieldCheck,
  Wallet,
} from 'lucide-react-native';

import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionButton } from '@/components/ui/action-button';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { cn } from '@/lib/utils';

/**
 * PaymentHomeScreen - landing page PayOS placeholder.
 *
 * BE đã wire payment cho từng quote (`/rider/payments/[quoteId]`),
 * nhưng chưa có payment dashboard tổng. Màn hình này là placeholder
 * giúp người dùng hiểu chỗ truy cập khi cần, đồng thời giải thích rằng
 * thanh toán đang được tích hợp.
 */
export default function PaymentHomeScreen() {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader
        title="Thanh toán"
        subtitle="PayOS - Ví điện tử & VietQR"
        onBack={() => router.back()}
      />
      <ScreenScroll>
        <Banner
          tone="info"
          title="Tính năng thanh toán đang được tích hợp"
          description="Bạn có thể thanh toán trực tiếp với thợ khi hoàn tất dịch vụ. Sau khi tích hợp xong, đơn thanh toán sẽ xuất hiện tại đây."
        />

        {/* Hero card */}
        <Card className="mt-4 overflow-hidden border-primary/30 bg-primary/5 p-5">
          <View className="flex-row items-center gap-3">
            <View className="size-12 items-center justify-center rounded-2xl bg-primary/15">
              <Wallet size={24} color="#1974f7" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-foreground">
                Thanh toán PayOS
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Ví điện tử · VietQR · Thẻ nội địa
              </Text>
            </View>
          </View>
          <View className="mt-4 flex-row gap-2">
            <FeatureChip icon={CreditCard} label="Thẻ nội địa" />
            <FeatureChip icon={Receipt} label="VietQR" />
          </View>
        </Card>

        {/* Recent transactions placeholder */}
        <View className="mt-6">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Giao dịch gần đây
          </Text>
          <EmptyState
            icon={Clock}
            title="Chưa có giao dịch nào"
            description="Các đơn thanh toán PayOS sẽ hiển thị tại đây sau khi hoàn tất."
          />
        </View>

        {/* Security note */}
        <Card className="mt-4 p-4">
          <View className="flex-row items-start gap-3">
            <View className="size-9 shrink-0 items-center justify-center rounded-xl bg-green/10">
              <ShieldCheck size={18} color="#22c55e" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">
                An toàn & minh bạch
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Giao dịch được ký số qua webhook PayOS, đối soát tự động với máy chủ.
                Lịch sử đơn hàng và hoá đơn sẽ xuất hiện ngay khi tích hợp hoàn tất.
              </Text>
            </View>
          </View>
        </Card>

        {/* Disabled CTA */}
        <ActionButton
          fullWidth
          disabled
          className={cn('mt-6 py-4 opacity-70')}
          accessibilityLabel="Tạo đơn thanh toán - sắp có"
        >
          <Text className="text-sm font-semibold text-primary-foreground">
            Tạo đơn thanh toán (sắp có)
          </Text>
        </ActionButton>
        <Text className="mt-3 text-center text-xs text-muted-foreground">
          Hiện tại thanh toán được khởi tạo tự động khi bạn phê duyệt báo giá
          từ thợ.
        </Text>
      </ScreenScroll>
    </SafeAreaView>
  );
}

function FeatureChip({
  icon: Icon,
  label,
}: {
  icon: typeof CreditCard;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-background px-3 py-1.5">
      <Icon size={14} color="#1974f7" />
      <Text className="text-xs font-semibold text-foreground">{label}</Text>
    </View>
  );
}
