import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Star, Phone, MessageCircle, Award, ChevronDown, Briefcase } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Mechanic } from '@/lib/types';

export function MechanicCard({ mechanic }: { mechanic: Mechanic }) {
  const [showCertifications, setShowCertifications] = useState(false);
  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <Image
          source={{ uri: mechanic.avatar }}
          className="size-14 shrink-0 rounded-full bg-secondary"
          resizeMode="cover"
        />
        <View className="min-w-0 flex-1">
          <Text className="truncate font-bold leading-tight text-foreground" numberOfLines={1}>
            {mechanic.name}
          </Text>
          <Text className="truncate text-xs text-muted-foreground">{mechanic.specialty}</Text>
          <View className="mt-1 flex-row items-center gap-1">
            <Star size={14} color="#fbbf24" fill="#fbbf24" />
            <Text className="text-xs font-semibold text-foreground">{mechanic.rating}</Text>
            <Text className="text-xs text-muted-foreground">
              · {mechanic.trips.toLocaleString()} chuyến
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            accessibilityLabel="Gọi thợ"
            className="size-10 items-center justify-center rounded-full bg-green active:scale-90"
          >
            <Phone size={16} color="#ffffff" />
          </Pressable>
          <Pressable
            accessibilityLabel="Nhắn tin cho thợ"
            className="size-10 items-center justify-center rounded-full bg-primary active:scale-90"
          >
            <MessageCircle size={16} color="#ffffff" />
          </Pressable>
        </View>
      </View>
      <View className="mt-3 rounded-2xl bg-secondary px-3 py-2">
        <Text className="text-xs text-muted-foreground">{mechanic.vehicle}</Text>
      </View>

      <Pressable
        onPress={() => setShowCertifications((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showCertifications }}
        className="mt-3 flex-row items-center justify-between rounded-2xl border border-border bg-background px-3 py-2.5 active:scale-[0.99]"
      >
        <View className="flex-row items-center gap-2">
          <Award size={16} color="#1974f7" />
          <Text className="text-xs font-semibold text-foreground">
            Xem chứng chỉ & kỹ năng
          </Text>
        </View>
        <ChevronDown
          size={16}
          color="#64748b"
          className={cn(showCertifications ? 'rotate-180' : 'rotate-0')}
        />
      </Pressable>

      {showCertifications && (
        <View className="mt-3 gap-2 rounded-2xl border border-border bg-secondary/40 p-3">
          {mechanic.experience && (
            <View className="flex-row items-center gap-2">
              <Briefcase size={14} color="#1974f7" />
              <Text className="text-xs font-semibold text-foreground">{mechanic.experience}</Text>
            </View>
          )}
          {mechanic.certifications.map((cert, idx) => (
            <View
              key={idx}
              className="flex-row items-start gap-2 rounded-xl bg-background px-2.5 py-2"
            >
              <Award size={14} color="#f59e0b" className="mt-0.5" />
              <Text className="flex-1 text-xs leading-snug text-foreground">{cert}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
