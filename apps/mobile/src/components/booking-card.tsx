import React from 'react';
import { Text, View } from 'react-native';
import { CalendarClock, Clock, Bike, Check, X } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { formatDdMmYyyy } from '@/lib/format';
import type { Appointment } from '@/lib/types';

export function BookingCard({
  appointment,
  onCancel,
}: {
  appointment: Appointment;
  onCancel?: () => void;
}) {
  const isConfirmed = appointment.status === 'confirmed';
  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center justify-between bg-navy px-4 py-3">
        <View className="flex-row items-center gap-2">
          <CalendarClock size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-white">{appointment.service}</Text>
        </View>
        <View
          className={`rounded-full px-2.5 py-1 ${
            isConfirmed ? 'bg-green/20' : 'bg-amber-500/20'
          }`}
        >
          <Text className="text-xs font-semibold text-white">
            {isConfirmed ? 'Đã xác nhận' : 'Chờ xác nhận'}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2 p-4">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <Bike size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Xe</Text>
          </View>
          <Text className="text-sm font-semibold leading-tight text-foreground">
            {appointment.vehicleName}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <CalendarClock size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Ngày</Text>
          </View>
          <Text className="text-sm font-semibold text-foreground">
            {formatDdMmYyyy(appointment.date)}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1">
            <Clock size={14} color="#64748b" />
            <Text className="text-xs text-muted-foreground">Giờ</Text>
          </View>
          <Text className="text-sm font-semibold text-foreground">{appointment.time}</Text>
        </View>
      </View>
      <View className="flex-row gap-2 border-t border-border px-4 py-3">
        <ActionButton
          variant="mint"
          className="flex-1 py-2.5"
          accessibilityLabel="Xác nhận lịch hẹn"
        >
          <Check size={16} color="#145413" />
          <Text className="text-xs font-semibold text-green">Xác nhận</Text>
        </ActionButton>
        <ActionButton
          variant="destructive"
          className="flex-1 py-2.5"
          onPress={onCancel}
          accessibilityLabel="Huỷ lịch hẹn"
        >
          <X size={16} color="#ffffff" />
          <Text className="text-xs font-semibold text-destructive-foreground">Huỷ</Text>
        </ActionButton>
      </View>
    </Card>
  );
}
