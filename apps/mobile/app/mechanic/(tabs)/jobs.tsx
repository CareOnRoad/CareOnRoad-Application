import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Inbox } from 'lucide-react-native';

import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { JobCard } from '@/components/mechanic/cards/job-card';
import { cn } from '@/lib/utils';
import type { MechanicJobStatus } from '@/lib/mechanic-types';

type Filter = 'all' | MechanicJobStatus;

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ' },
  { id: 'in_progress', label: 'Đang làm' },
  { id: 'awaiting_parts', label: 'Chờ phụ tùng' },
  { id: 'completed', label: 'Hoàn tất' },
];

/**
 * MechanicJobsScreen - danh sách công việc của thợ.
 *
 * Horizontal filter chips (pill) với count badge. Mỗi job card là pressable
 * mở chi tiết job.
 */
export default function MechanicJobsScreen() {
  const { jobs } = useMechanicApp();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = jobs
    .filter((j) => (filter === 'all' ? true : j.status === filter))
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return `${b.scheduledDate} ${b.scheduledTime}`.localeCompare(
        `${a.scheduledDate} ${a.scheduledTime}`,
      );
    });

  const counts: Record<Filter, number> = {
    all: jobs.length,
    pending: jobs.filter((j) => j.status === 'pending').length,
    in_progress: jobs.filter((j) => j.status === 'in_progress').length,
    awaiting_parts: jobs.filter((j) => j.status === 'awaiting_parts').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  };

  const activeCount = counts.pending + counts.in_progress + counts.awaiting_parts;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Công việc" subtitle={`${activeCount} đang hoạt động`} />
      <View className="border-b border-border bg-background px-5 py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {filters.map((f) => (
            <Pressable
              key={f.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === f.id }}
              accessibilityLabel={`Lọc ${f.label}`}
              onPress={() => setFilter(f.id)}
              className={cn(
                'flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-70',
                filter === f.id ? 'border-primary bg-primary' : 'border-border bg-card',
              )}
            >
              <Text
                className={cn(
                  'text-xs font-semibold',
                  filter === f.id ? 'text-primary-foreground' : 'text-foreground',
                )}
              >
                {f.label}
              </Text>
              <View
                className={cn(
                  'rounded-full px-1.5 py-0',
                  filter === f.id ? 'bg-white/20' : 'bg-secondary',
                )}
              >
                <Text
                  className={cn(
                    'text-[10px] font-bold',
                    filter === f.id ? 'text-white' : 'text-muted-foreground',
                  )}
                >
                  {counts[f.id]}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Không có công việc nào"
            description="Thử bỏ filter hoặc chọn tab khác để xem thêm."
            action={
              <Card
                className="border-dashed bg-secondary/40 p-3"
              >
                <Text className="text-center text-xs text-muted-foreground">
                  Khi tích hợp backend, danh sách sẽ đồng bộ với máy chủ theo thời gian thực.
                </Text>
              </Card>
            }
          />
        ) : (
          <View className="gap-3">
            {filtered.map((j) => (
              <JobCard
                key={j.id}
                job={j}
                onPress={() => router.push({ pathname: '/mechanic/jobs/detail', params: { id: j.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
