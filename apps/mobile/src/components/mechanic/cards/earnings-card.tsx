import React from 'react';
import { Text, View } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { formatVND } from '@/lib/format';

export function EarningsCard({
  thisWeek,
  lastWeek,
  label = 'Tuần này',
}: {
  thisWeek: number;
  lastWeek: number;
  label?: string;
}) {
  const delta = lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek : 0;
  const isUp = delta >= 0;
  return (
    <Card className="overflow-hidden border-0 bg-navy">
      <View className="p-5">
        <Text className="text-sm text-white/70">{label}</Text>
        <Text className="mt-1 text-2xl font-bold text-white">{formatVND(thisWeek)}</Text>
        <View
          className={`mt-3 flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${
            isUp ? 'bg-mint/20' : 'bg-white/10'
          }`}
        >
          {isUp ? <TrendingUp size={14} color="#a9ffad" /> : <TrendingDown size={14} color="#ffffff" />}
          <Text className={`text-xs font-semibold ${isUp ? 'text-mint' : 'text-white/80'}`}>
            {isUp ? '+' : ''}
            {(delta * 100).toFixed(1)}% so với tuần trước
          </Text>
        </View>
      </View>
    </Card>
  );
}
