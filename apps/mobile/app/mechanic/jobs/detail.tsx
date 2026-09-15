import React from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  AlertCircle,
  Bike,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Gauge,
  MapPin,
  Wrench,
} from 'lucide-react-native';
import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CustomerCard } from '@/components/mechanic/cards/customer-card';
import { JobUpdateForm } from '@/components/mechanic/forms/job-update-form';
import { formatDate, formatVND } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import type { MechanicJobStatus } from '@/lib/mechanic-types';

const timeline: { id: MechanicJobStatus; label: string }[] = [
  { id: 'pending', label: 'Assigned' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'awaiting_parts', label: 'Awaiting parts' },
  { id: 'completed', label: 'Completed' },
];

const statusTone: Record<MechanicJobStatus, 'amber' | 'blue' | 'red' | 'green'> = {
  pending: 'amber',
  in_progress: 'blue',
  awaiting_parts: 'red',
  completed: 'green',
};

const toneColor: Record<string, string> = {
  amber: '#d97706',
  blue: '#1974f7',
  red: '#ed3f3a',
  green: '#145413',
};

export default function MechanicJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob, updateJobStatus, completeJob } = useMechanicApp();
  const job = id ? getJob(id) : undefined;

  if (!job) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Job not found" onBack={() => router.back()} />
      </View>
    );
  }

  const currentStep = timeline.findIndex((s) => s.id === job.status);
  const tone = statusTone[job.status];

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={job.type}
        subtitle={`${job.vehicle.plate} · ${job.scheduledTime}`}
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        <View className="mb-4 flex-row items-center gap-2">
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${toneColor[tone]}20` }}>
            <Text className="text-xs font-semibold" style={{ color: toneColor[tone] }}>
              {job.status.replace('_', ' ')}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            Created {formatDate(job.scheduledDate)}
          </Text>
        </View>

        <Card className="p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Bike size={24} color="#1974f7" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="truncate font-bold leading-tight text-foreground">{job.vehicle.name}</Text>
              <Text className="text-xs text-muted-foreground">
                {job.vehicle.brand} · {job.vehicle.plate}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-3 border-t border-border pt-3">
            <View className="flex-row items-center gap-2">
              <Gauge size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">
                {job.vehicle.mileage.toLocaleString()} km
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">
                Today · {job.scheduledTime}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Clock size={14} color="#64748b" />
              <Text className="text-xs text-muted-foreground">{job.durationMin} min</Text>
            </View>
            <Text className="text-xs font-semibold text-foreground">{formatVND(job.price)}</Text>
          </View>
        </Card>

        <View className="mt-4">
          <Text className="mb-2 font-bold text-foreground">Customer's request</Text>
          <Card className="p-4">
            <View className="flex-row items-start gap-2">
              <AlertCircle size={16} color="#d97706" className="mt-0.5" />
              <Text className="flex-1 text-sm text-foreground">{job.symptom}</Text>
            </View>
          </Card>
        </View>

        <View className="mt-4">
          <Text className="mb-2 font-bold text-foreground">Customer</Text>
          <CustomerCard customer={job.customer} />
        </View>

        <View className="mt-4">
          <Text className="mb-2 font-bold text-foreground">Job progress</Text>
          <Card className="p-4">
            <View className="gap-3">
              {timeline.map((step, i) => {
                const reached = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <View key={step.id} className="flex-row items-center gap-3">
                    <View
                      className={cn(
                        'size-7 shrink-0 items-center justify-center rounded-full',
                        reached ? 'bg-primary' : 'bg-secondary',
                        isCurrent && 'ring-4 ring-primary/20',
                      )}
                    >
                      {reached ? (
                        <CheckCircle2 size={16} color="#ffffff" />
                      ) : (
                        <Circle size={16} color="#64748b" />
                      )}
                    </View>
                    <Text
                      className={cn(
                        'text-sm',
                        reached ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </Text>
                    {isCurrent && (
                      <Badge tone="blue" className="ml-auto">
                        <Text className="text-xs font-semibold text-primary">Current</Text>
                      </Badge>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        </View>

        <View className="mt-4">
          <Text className="mb-2 font-bold text-foreground">Before / After</Text>
          <View className="flex-row gap-3">
            <Card className="flex-1 overflow-hidden p-0">
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600' }}
                className="aspect-square w-full bg-secondary"
                resizeMode="cover"
              />
              <View className="p-2">
                <Text className="text-center text-xs font-semibold text-muted-foreground">Before</Text>
              </View>
            </Card>
            <Card className="flex-1 overflow-hidden p-0">
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600' }}
                className="aspect-square w-full bg-secondary"
                resizeMode="cover"
              />
              <View className="p-2">
                <Text className="text-center text-xs font-semibold text-muted-foreground">After</Text>
              </View>
            </Card>
          </View>
        </View>

        <View className="mt-4">
          <View className="mb-2 flex-row items-center gap-2">
            <Wrench size={16} color="#1974f7" />
            <Text className="font-bold text-foreground">Update job</Text>
          </View>
          <Card className="p-4">
            <JobUpdateForm
              job={job}
              onSave={(status, notes) => updateJobStatus(job.id, status, notes)}
              onComplete={(payload) => completeJob(job.id, payload)}
            />
          </Card>
        </View>

        <View className="mt-4 flex-row items-center gap-2">
          <MapPin size={14} color="#64748b" />
          <Text className="text-xs text-muted-foreground">Open pickup location in Maps</Text>
        </View>
      </ScrollView>
    </View>
  );
}
