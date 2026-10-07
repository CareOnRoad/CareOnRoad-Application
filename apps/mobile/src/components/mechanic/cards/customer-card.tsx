import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Phone, MapPin } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { MechanicCustomer } from '@/lib/mechanic-types';

export function CustomerCard({ customer }: { customer: MechanicCustomer }) {
  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <View className="size-12 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Text className="text-base font-bold text-foreground">{customer.name.charAt(0)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="truncate font-semibold text-foreground">{customer.name}</Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            <Phone size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">{customer.phone}</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel={`Gọi ${customer.name}`}
          className="size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 active:opacity-60"
        >
          <Phone size={16} color="#1974f7" />
        </Pressable>
      </View>
      <View className="mt-3 flex-row items-center gap-2">
        <MapPin size={14} color="#64748b" />
        <Text className="text-xs text-muted-foreground">Khách hàng thân thiết</Text>
        <Badge tone="green" className="ml-auto">
          <Text className="text-xs font-semibold text-green">Đã xác thực</Text>
        </Badge>
      </View>
    </Card>
  );
}
