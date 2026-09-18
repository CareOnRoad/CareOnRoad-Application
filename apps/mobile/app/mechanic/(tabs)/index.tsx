import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  LucideIcon,
  Star,
  Wrench,
} from 'lucide-react-native';

import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { useAuth } from '@/contexts/auth-context';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/form';
import { EarningsCard } from '@/components/mechanic/cards/earnings-card';
import { JobCard } from '@/components/mechanic/cards/job-card';
/**
 * MechanicDashboardScreen - dashboard cho thợ sửa xe.
 *
 * Layout:
 *  1. AppHeader với avatar.
 *  2. Hero card navy: greeting + garage + rating + active job counter.
 *  3. Stats 3 cột (Pending / In progress / Completed) với tone color semantic.
 *  4. Earnings card (this week vs last week).
 *  5. "Up next" card (CTA lên job tiếp theo).
 *  6. Danh sách upcoming jobs (3 đầu).
 */
export default function MechanicDashboardScreen() {
  const { mechanic, garage, todayJobs, upcomingTodayJobs, updateJobStatus, earnings } = useMechanicApp();
  const { user: authUser } = useAuth();

  const displayName = authUser?.name ?? mechanic.name;
  const displayAvatar = authUser?.avatar ?? mechanic.avatar;

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
    <View className="flex-1 bg-background">
      <AppHeader
        title="Dashboard"
        subtitle={greeting()}
        right={
          <View className="size-9 overflow-hidden rounded-full bg-secondary">
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} className="size-full" resizeMode="cover" />
            ) : (
              <View className="size-full items-center justify-center">
                <Text className="text-sm font-bold text-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Card className="overflow-hidden border-0 bg-navy">
          <View className="p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm text-white/70">Xin chào,</Text>
                <Text className="mt-0.5 text-2xl font-bold text-white">{displayName}</Text>
                <View className="mt-1 flex-row items-center gap-1.5">
                  <Wrench size={12} color="#a9ffad" />
                  <Text className="text-xs text-white/70">{garage.name}</Text>
                </View>
              </View>
              <View className="items-end gap-2">
                <View className="flex-row items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
                  <Star size={12} color="#a9ffad" fill="#a9ffad" />
                  <Text className="text-xs font-bold text-white">{mechanic.rating}</Text>
                </View>
                <View className="flex-row items-center gap-1.5 rounded-full bg-green/20 px-2.5 py-1">
                  <View className="size-1.5 rounded-full bg-green" />
                  <Text className="text-xs font-semibold text-white">Đang nhận việc</Text>
                </View>
              </View>
            </View>
            <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5">
              <Bell size={16} color="#a9ffad" />
              <Text className="text-xs font-medium text-white">
                {pendingCount + inProgressCount} công việc đang hoạt động hôm nay
              </Text>
            </View>
          </View>
        </Card>

        {/* Today stats */}
        <View className="mt-5">
          <SectionHeader title="Hôm nay" subtitle="Tổng quan trong ngày" />
          <View className="flex-row gap-3">
            <StatTile icon={Circle} tone="amber" label="Chờ xử lý" value={pendingCount} />
            <StatTile icon={Clock} tone="blue" label="Đang làm" value={inProgressCount} />
            <StatTile icon={CheckCircle2} tone="green" label="Hoàn tất" value={completedCount} />
          </View>
        </View>

        {/* Earnings */}
        <View className="mt-6">
          <EarningsCard
            thisWeek={earnings.thisWeek}
            lastWeek={earnings.lastWeek}
            label="Thu nhập tuần này"
          />
        </View>

        {/* Up next */}
        {nextJob && (
          <Card className="mt-5 overflow-hidden border-0 bg-green">
            <View className="flex-row items-center gap-3 p-5">
              <View className="size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <Wrench size={24} color="#ffffff" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs text-white/80">Tiếp theo</Text>
                <Text className="truncate font-bold leading-tight text-white" numberOfLines={1}>
                  {nextJob.type} · {nextJob.vehicle.plate}
                </Text>
                <Text className="text-xs text-white/80">
                  {nextJob.scheduledTime} · {nextJob.customer.name}
                </Text>
              </View>
              <ActionButton
                variant="mint"
                className="px-3 py-2"
                onPress={handleStartNext}
                accessibilityLabel={`Bắt đầu công việc ${nextJob.type}`}
              >
                <Text className="text-sm font-semibold text-green">Bắt đầu</Text>
                <ArrowRight size={16} color="#145413" />
              </ActionButton>
            </View>
          </Card>
        )}

        {/* Upcoming jobs */}
        <View className="mt-6">
          <SectionHeader
            title="Lịch hôm nay"
            action="Xem tất cả"
            onAction={() => router.push('/mechanic/(tabs)/jobs')}
          />
          {upcomingTodayJobs.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              tone="success"
              title="Đã xong việc hôm nay!"
              description="Không còn công việc nào đang chờ. Nghỉ ngơi và chuẩn bị cho ngày mai."
            />
          ) : (
            <View className="gap-3">
              {upcomingTodayJobs.slice(0, 3).map((j) => (
                <Pressable
                  key={j.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Mở chi tiết công việc ${j.type}`}
                  onPress={() => router.push({ pathname: '/mechanic/jobs/detail', params: { id: j.id } })}
                >
                  <JobCard job={j} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: 'amber' | 'blue' | 'green';
  label: string;
  value: number;
}) {
  const toneStyles = {
    amber: { bg: 'bg-amber-500/15', fg: '#d97706' },
    blue: { bg: 'bg-primary/10', fg: '#1974f7' },
    green: { bg: 'bg-green/10', fg: '#145413' },
  } as const;
  const s = toneStyles[tone];
  return (
    <Card className="flex-1 p-3">
      <View
        className="mb-2 size-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${s.fg}1a` }}
      >
        <Icon size={16} color={s.fg} />
      </View>
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      <Text className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</Text>
    </Card>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}
