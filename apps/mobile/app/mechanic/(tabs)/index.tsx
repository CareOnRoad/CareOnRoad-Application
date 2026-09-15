import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Bell, CheckCircle2, Circle, Clock, LucideIcon, Star, Wrench } from 'lucide-react-native';
import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EarningsCard } from '@/components/mechanic/cards/earnings-card';
import { JobCard } from '@/components/mechanic/cards/job-card';
import { SectionHeader } from '@/components/ui/form';

export default function MechanicDashboardScreen() {
  const { mechanic, garage, todayJobs, upcomingTodayJobs, earnings, updateJobStatus } =
    useMechanicApp();

  const pendingCount = todayJobs.filter((j) => j.status === 'pending').length;
  const inProgressCount = todayJobs.filter((j) => j.status === 'in_progress').length;
  const completedCount = todayJobs.filter((j) => j.status === 'completed').length;
  const nextJob = upcomingTodayJobs[0];

  const handleStartNext = () => {
    if (!nextJob) return;
    if (nextJob.status === 'pending') updateJobStatus(nextJob.id, 'in_progress');
    router.push({ pathname: '/mechanic/jobs/detail', params: { id: nextJob.id } });
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
    >
      <Card className="overflow-hidden border-0 bg-navy">
        <View className="p-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-white/70">Good afternoon,</Text>
              <Text className="text-xl font-bold text-white">{mechanic.name}</Text>
              <Text className="mt-1 text-xs text-white/70">{garage.name}</Text>
            </View>
            <View className="items-end gap-2">
              <Image source={{ uri: mechanic.avatar }} className="size-12 rounded-full" resizeMode="cover" />
              <View className="flex-row items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
                <Star size={12} color="#a9ffad" fill="#a9ffad" />
                <Text className="text-xs text-white">{mechanic.rating}</Text>
              </View>
            </View>
          </View>
          <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
            <Bell size={16} color="#a9ffad" />
            <Text className="text-xs text-white">
              {pendingCount + inProgressCount} jobs active today
            </Text>
          </View>
        </View>
      </Card>

      <View className="mt-5">
        <SectionHeader title="Today" />
        <View className="flex-row gap-2">
          <StatTile icon={Circle} label="Pending" value={pendingCount} tone="amber" />
          <StatTile icon={Clock} label="In progress" value={inProgressCount} tone="blue" />
          <StatTile icon={CheckCircle2} label="Completed" value={completedCount} tone="green" />
        </View>
      </View>

      <View className="mt-5">
        <EarningsCard thisWeek={earnings.thisWeek} lastWeek={earnings.lastWeek} />
      </View>

      {nextJob && (
        <Card className="mt-5 overflow-hidden border-0 bg-green">
          <View className="flex-row items-center gap-3 p-5">
            <View className="size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <Wrench size={24} color="#ffffff" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-xs text-white/80">Up next</Text>
              <Text className="truncate font-bold leading-tight text-white" numberOfLines={1}>
                {nextJob.type} · {nextJob.vehicle.plate}
              </Text>
              <Text className="text-xs text-white/80">
                {nextJob.scheduledTime} · {nextJob.customer.name}
              </Text>
            </View>
            <ActionButton variant="mint" className="px-3 py-2" onPress={handleStartNext}>
              <Text className="text-sm font-semibold text-green">Start</Text>
              <ArrowRight size={16} color="#145413" />
            </ActionButton>
          </View>
        </Card>
      )}

      <View className="mt-5">
        <SectionHeader title="Upcoming today" action="See all" onAction={() => router.push('/mechanic/(tabs)/jobs')} />
        {upcomingTodayJobs.length === 0 ? (
          <Card className="p-6">
            <Text className="text-center text-sm text-muted-foreground">
              No more jobs scheduled for today. Nice work!
            </Text>
          </Card>
        ) : (
          <View className="gap-3">
            {upcomingTodayJobs.slice(0, 3).map((j) => (
              <Pressable key={j.id} onPress={() => router.push({ pathname: '/mechanic/jobs/detail', params: { id: j.id } })}>
                <JobCard job={j} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: 'amber' | 'blue' | 'green';
}) {
  const toneStyles = {
    amber: 'bg-amber-500/15',
    blue: 'bg-primary/10',
    green: 'bg-green/10',
  };
  const iconColor = {
    amber: '#d97706',
    blue: '#1974f7',
    green: '#145413',
  };
  return (
    <Card className="flex-1 p-3">
      <View className={`size-8 items-center justify-center rounded-xl ${toneStyles[tone]}`}>
        <Icon size={16} color={iconColor[tone]} />
      </View>
      <Text className="mt-2 text-xl font-bold text-foreground">{value}</Text>
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
    </Card>
  );
}
