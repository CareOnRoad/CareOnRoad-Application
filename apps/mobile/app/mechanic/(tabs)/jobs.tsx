import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Inbox } from 'lucide-react-native';

import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { JobCard } from '@/components/mechanic/cards/job-card';
import { cn } from '@/lib/utils';
import {
  MECHANIC_JOB_FILTERS,
  type MechanicJobFilter,
} from '@/lib/mechanic-types';

/**
 * MechanicJobsScreen - danh sách công việc của thợ.
 *
 * Horizontal filter chips (pill) với count badge. Mỗi job card là pressable
 * mở chi tiết job.
 */
export default function MechanicJobsScreen() {
  const { jobs, getAssignmentStatus } = useMechanicApp();
  const [filter, setFilter] = useState<MechanicJobFilter>('all');

  /**
   * Filter theo BE assignment status (raw) thay vì UI MechanicJobStatus gộp.
   * UI status vẫn hiển thị trên JobCard (logic cũ không đổi).
   */
  const filtered = jobs
    .filter((j) => {
      if (filter === 'all') return true;
      const beStatus = getAssignmentStatus(j.id);
      return beStatus === filter;
    })
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return `${b.scheduledDate} ${b.scheduledTime}`.localeCompare(
        `${a.scheduledDate} ${a.scheduledTime}`,
      );
    });

  const counts: Record<MechanicJobFilter, number> = { all: 0, accepted: 0, en_route: 0, on_site: 0, diagnosis: 0, quoted: 0, awaiting_payment: 0, in_progress: 0, completed: 0, canceled: 0 };
  for (const j of jobs) {
    counts.all += 1;
    const beStatus = getAssignmentStatus(j.id);
    if (beStatus && beStatus in counts) {
      counts[beStatus as MechanicJobFilter] += 1;
    }
  }

  const activeCount =
    counts.accepted +
    counts.en_route +
    counts.on_site +
    counts.diagnosis +
    counts.quoted +
    counts.awaiting_payment +
    counts.in_progress;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Công việc" subtitle={`${activeCount} đang hoạt động`} />
      <View className="border-b border-border bg-background px-5 py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {MECHANIC_JOB_FILTERS.map((f) => (
            <Pressable
              key={f.id}
              accessibilityRole="button"
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
      <ScreenScroll>
        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Không có công việc nào"
            description={
              filter === 'all'
                ? 'Bạn chưa nhận job nào. Hệ thống sẽ gửi offer khi có yêu cầu cứu hộ hoặc bảo dưỡng gần bạn. Hãy bật trạng thái "Sẵn sàng" và đảm bảo vị trí GPS đã được cập nhật.'
                : 'Không có công việc nào ở trạng thái này. Thử bỏ filter hoặc chọn tab khác để xem thêm.'
            }
            action={
              <Card
                className="border-dashed bg-secondary/40 p-3"
              >
                <Text className="text-center text-xs text-muted-foreground">
                  Jobs bảo dưỡng đặt lịch sẽ xuất hiện khi tới giờ hẹn (khoảng 15 phút
                  trước) — worker tự động gửi offer cho các thợ sẵn sàng.
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
      </ScreenScroll>
    </View>
  );
}
