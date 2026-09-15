import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bike, Plus } from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { VehicleCard } from '@/components/vehicle-card';

export default function VehiclesScreen() {
  const { vehicles } = useApp();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="My Vehicles" subtitle={`${vehicles.length} registered`} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        <ActionButton
          fullWidth
          onPress={() => router.push('/rider/vehicles/form')}
          className="border border-dashed border-primary/40 bg-primary/5 py-4"
        >
          <Plus size={20} color="#1974f7" />
          <Text className="text-sm font-semibold text-primary">Add Vehicle</Text>
        </ActionButton>

        {vehicles.length === 0 ? (
          <Card className="mt-3 items-center gap-2 px-6 py-12">
            <View className="size-14 items-center justify-center rounded-2xl bg-secondary">
              <Bike size={28} color="#64748b" />
            </View>
            <Text className="font-semibold text-foreground">No vehicles yet</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Add your motorcycle to start tracking maintenance.
            </Text>
          </Card>
        ) : (
          <View className="mt-3 gap-3">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
