import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { BookingCard } from '@/components/booking-card';
import { AppHeader } from '@/components/ui/app-header';
import { useApp } from '@/contexts/app-context';

export default function ConfirmedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appointments } = useApp();
  const appointment = appointments.find((a) => a.id === id);

  if (!appointment) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Booking Confirmed" onBack={() => router.replace('/rider/(tabs)/schedule')} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Booking Confirmed" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        <View className="mb-5 items-center gap-3 pt-6">
          <View className="size-20 items-center justify-center">
            <View className="absolute inset-0 rounded-full bg-green/20" />
            <View className="relative size-16 items-center justify-center rounded-full bg-green">
              <Check size={32} color="#ffffff" />
            </View>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">You're all set!</Text>
            <Text className="mt-1 px-6 text-center text-sm text-muted-foreground">
              Your appointment has been booked. We'll send a reminder before your visit.
            </Text>
          </View>
        </View>
        <BookingCard appointment={appointment} />
        <ActionButton
          fullWidth
          variant="outline"
          className="mt-5"
          onPress={() => router.replace('/rider/(tabs)/schedule')}
        >
          <Text className="text-sm font-semibold text-foreground">Book another service</Text>
        </ActionButton>
      </ScrollView>
    </View>
  );
}
