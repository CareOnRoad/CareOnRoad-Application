import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import {
  Award,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Star,
  TrendingUp,
  XCircle,
} from 'lucide-react-native';

import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { AppHeader } from '@/components/ui/app-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { StatTile } from '@/components/ui/stat-tile';
import { cn } from '@/lib/utils';

type Filter = '7d' | '30d' | 'all';

const filterOptions: { id: Filter; label: string }[] = [
  { id: '7d', label: '7 ngày qua' },
  { id: '30d', label: '30 ngày qua' },
  { id: 'all', label: 'Toàn thời gian' },
];

function rangeFor(filter: Filter): { date_from?: string } {
  if (filter === 'all') return {};
  const days = filter === '7d' ? 7 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return { date_from: d.toISOString() };
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}p`;
}

/**
 * MechanicPerformanceScreen - tab "Hiệu suất" cho thợ.
 *
 * Hiển thị các metrics tổng hợp từ BE:
 *  - Hero: rating + total jobs
 *  - Stats: completed / canceled / quote approval rate
 *  - Stats: acceptance / decline rate
 *  - Optional: avg accept time + avg workflow duration
 *
 * Filter thời gian: 7 ngày / 30 ngày / Toàn thời gian (gọi
 * `reloadPerformance(date_from)` tương ứng).
 */
export default function MechanicPerformanceScreen() {
  const { performance, performanceLoading, reloadPerformance } = useMechanicApp();
  const [filter, setFilter] = useState<Filter>('all');

  const handleFilterChange = (next: Filter) => {
    setFilter(next);
    void reloadPerformance(rangeFor(next));
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Hiệu suất" subtitle="Tổng quan công việc của bạn" />

      {/* Filter chips */}
      <View className="border-b border-border bg-background px-5 py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {filterOptions.map((opt) => (
            <Pressable
              key={opt.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === opt.id }}
              accessibilityLabel={`Lọc ${opt.label}`}
              onPress={() => handleFilterChange(opt.id)}
              className={cn(
                'flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-70',
                filter === opt.id ? 'border-primary bg-primary' : 'border-border bg-card',
              )}
            >
              <Text
                className={cn(
                  'text-xs font-semibold',
                  filter === opt.id ? 'text-primary-foreground' : 'text-foreground',
                )}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScreenScroll>
        {performanceLoading && !performance ? (
          <View className="items-center py-12">
            <ActivityIndicator color="#1974f7" />
          </View>
        ) : !performance ? (
          <EmptyState
            icon={TrendingUp}
            tone="primary"
            title="Chưa có dữ liệu hiệu suất"
            description="Hoàn thành thêm công việc để thấy thống kê chi tiết."
          />
        ) : (
          <View className="gap-4">
            {/* Hero card: rating + total jobs */}
            <Card className="p-5">
              <View className="flex-row items-center gap-4">
                <View className="size-16 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
                  <Award size={32} color="#d97706" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-3xl font-bold text-foreground">
                      {performance.rating.average.toFixed(1)}
                    </Text>
                    <Text className="text-sm text-muted-foreground">/ 5</Text>
                  </View>
                  <Text className="mt-0.5 text-xs text-muted-foreground">
                    {performance.rating.count} đánh giá từ khách hàng
                  </Text>
                  <View className="mt-2 flex-row items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={12}
                        color={s <= Math.round(performance.rating.average) ? '#d97706' : '#cbd5e1'}
                        fill={s <= Math.round(performance.rating.average) ? '#d97706' : 'transparent'}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </Card>

            {/* Stats: completed / canceled / quote approval */}
            <View className="flex-row gap-3">
              <StatTile
                icon={CheckCircle2}
                tone="green"
                label="Hoàn thành"
                value={performance.completed_jobs.toString()}
              />
              <StatTile
                icon={XCircle}
                tone="red"
                label="Đã huỷ"
                value={performance.canceled_jobs.toString()}
              />
              <StatTile
                icon={ClipboardList}
                tone="blue"
                label="Duyệt giá"
                value={percent(performance.quote_approval_rate)}
                small
              />
            </View>

            {/* Stats: acceptance / decline rate */}
            <View className="flex-row gap-3">
              <StatTile
                icon={CheckCircle2}
                tone="blue"
                label="Chấp nhận"
                value={percent(performance.acceptance_rate)}
                small
              />
              <StatTile
                icon={XCircle}
                tone="amber"
                label="Từ chối"
                value={percent(performance.decline_rate)}
                small
              />
              <StatTile
                icon={Star}
                tone="amber"
                label="Đánh giá"
                value={performance.rating.count.toString()}
              />
            </View>

            {/* Optional: thời gian */}
            {(performance.average_accept_time_seconds !== undefined ||
              performance.average_workflow_duration_seconds !== undefined) && (
              <Card className="gap-3 p-4">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Thời gian trung bình
                </Text>
                <View className="flex-row gap-3">
                  {performance.average_accept_time_seconds !== undefined && (
                    <View className="flex-1 rounded-2xl bg-secondary p-3">
                      <View className="mb-1 flex-row items-center gap-1.5">
                        <Calendar size={12} color="#64748b" />
                        <Text className="text-[11px] uppercase text-muted-foreground">
                          Phản hồi offer
                        </Text>
                      </View>
                      <Text className="text-lg font-bold text-foreground">
                        {formatSeconds(performance.average_accept_time_seconds)}
                      </Text>
                    </View>
                  )}
                  {performance.average_workflow_duration_seconds !== undefined && (
                    <View className="flex-1 rounded-2xl bg-secondary p-3">
                      <View className="mb-1 flex-row items-center gap-1.5">
                        <TrendingUp size={12} color="#64748b" />
                        <Text className="text-[11px] uppercase text-muted-foreground">
                          Hoàn thành job
                        </Text>
                      </View>
                      <Text className="text-lg font-bold text-foreground">
                        {formatSeconds(performance.average_workflow_duration_seconds)}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            )}

            <Text className="px-1 text-[11px] text-muted-foreground">
              Dữ liệu cập nhật từ máy chủ. Nếu con số chưa khớp, hãy kéo xuống để tải lại.
            </Text>
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}
