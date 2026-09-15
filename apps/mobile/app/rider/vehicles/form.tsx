import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useApp } from '@/contexts/app-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Field, FormTextInput } from '@/components/ui/form';

export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { vehicles, addVehicle, updateVehicle } = useApp();
  const existing = id ? vehicles.find((v) => v.id === id) : undefined;

  const [form, setForm] = useState({
    name: existing?.name ?? '',
    brand: existing?.brand ?? '',
    plate: existing?.plate ?? '',
    mileage: existing?.mileage?.toString() ?? '',
    color: existing?.color ?? '',
    year: existing?.year?.toString() ?? '',
    lastMaintenance: existing?.lastMaintenance ?? '',
    nextMaintenance: existing?.nextMaintenance ?? '',
  });

  const valid = form.name.trim() && form.plate.trim() && form.mileage.trim();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={existing ? 'Edit Vehicle' : 'Add Vehicle'} onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Model name">
          <FormTextInput
            placeholder="e.g. Honda Vision"
            value={form.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
          />
        </Field>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Field label="Brand">
              <FormTextInput
                placeholder="Honda"
                value={form.brand}
                onChangeText={(t) => setForm({ ...form, brand: t })}
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Year">
              <FormTextInput
                placeholder="2024"
                keyboardType="numeric"
                value={form.year}
                onChangeText={(t) => setForm({ ...form, year: t })}
              />
            </Field>
          </View>
        </View>
        <View className="mt-4">
          <Field label="Plate number">
            <FormTextInput
              placeholder="59-H1 234.56"
              value={form.plate}
              onChangeText={(t) => setForm({ ...form, plate: t })}
            />
          </Field>
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Field label="Mileage (km)">
              <FormTextInput
                placeholder="12000"
                keyboardType="numeric"
                value={form.mileage}
                onChangeText={(t) => setForm({ ...form, mileage: t })}
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Color">
              <FormTextInput
                placeholder="Pearl White"
                value={form.color}
                onChangeText={(t) => setForm({ ...form, color: t })}
              />
            </Field>
          </View>
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Field label="Last maintenance">
              <FormTextInput
                value={form.lastMaintenance}
                onChangeText={(t) => setForm({ ...form, lastMaintenance: t })}
                placeholder="YYYY-MM-DD"
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Next maintenance">
              <FormTextInput
                value={form.nextMaintenance}
                onChangeText={(t) => setForm({ ...form, nextMaintenance: t })}
                placeholder="YYYY-MM-DD"
              />
            </Field>
          </View>
        </View>

        <ActionButton
          fullWidth
          className="mt-6"
          disabled={!valid}
          onPress={() => {
            if (!valid) return;
            const payload = {
              name: form.name.trim(),
              brand: form.brand.trim() || 'Motorcycle',
              plate: form.plate.trim(),
              mileage: Number(form.mileage) || 0,
              color: form.color.trim() || '—',
              year: Number(form.year) || new Date().getFullYear(),
              lastMaintenance: form.lastMaintenance || new Date().toISOString().slice(0, 10),
              nextMaintenance:
                form.nextMaintenance ||
                new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString().slice(0, 10),
            };
            if (existing) {
              updateVehicle({ ...existing, ...payload });
              router.back();
            } else {
              addVehicle(payload);
              router.back();
            }
          }}
        >
          <Check size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-primary-foreground">
            {existing ? 'Save changes' : 'Add vehicle'}
          </Text>
        </ActionButton>
      </ScrollView>
    </View>
  );
}
