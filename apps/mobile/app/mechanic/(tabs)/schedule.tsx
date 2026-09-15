import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Calendar as CalIcon, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMechanicApp } from '@/contexts/mechanic-app-context';
import { AppHeader } from '@/components/ui/app-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BASE_WEEK_START = '2026-07-13';

function shiftDate(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function MechanicScheduleScreen() {
  const { scheduleSlots, getJob } = useMechanicApp();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(
    () => shiftDate(BASE_WEEK_START, weekOffset * 7),
    [weekOffset],
  );
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i)),
    [weekStart],
  );

  const timeSlots = useMemo(() => {
    const set = new Set<string>();
    scheduleSlots.forEach((s) => set.add(s.time));
    return Array.from(set).sort();
  }, [scheduleSlots]);

  const slotsByDateTime = useMemo(() => {
    const map = new Map<string, (typeof scheduleSlots)[number]>();
    scheduleSlots.forEach((s) => {
      map.set(`${s.date}__${s.time}`, s);
    });
    return map;
  }, [scheduleSlots]);

  const weekRange = `${getDayLabel(weekDates[0])} – ${getDayLabel(weekDates[6])}`;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Schedule"
        subtitle={weekRange}
        right={
          <Pressable
            accessibilityLabel="Calendar"
            className="size-9 items-center justify-center rounded-full bg-secondary active:opacity-60"
          >
            <CalIcon size={18} color="#16202f" />
          </Pressable>
        }
      />
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable
          onPress={() => setWeekOffset((w) => w - 1)}
          accessibilityLabel="Previous week"
          className="size-9 items-center justify-center rounded-full bg-secondary active:opacity-60"
        >
          <ChevronLeft size={18} color="#16202f" />
        </Pressable>
        <Text className="text-sm font-semibold text-foreground">
          Week{' '}
          {weekOffset === 0 ? 'current' : weekOffset > 0 ? `+${weekOffset}` : weekOffset}
        </Text>
        <Pressable
          onPress={() => setWeekOffset((w) => w + 1)}
          accessibilityLabel="Next week"
          className="size-9 items-center justify-center rounded-full bg-secondary active:opacity-60"
        >
          <ChevronRight size={18} color="#16202f" />
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      >
        <Card className="overflow-hidden p-0">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View className="flex-row border-b border-border bg-secondary/40 px-2 py-2">
                <Text className="w-16 px-1 text-[11px] font-semibold text-muted-foreground">Time</Text>
                {weekDates.map((d, i) => (
                  <View key={d} className="w-20 items-center px-1">
                    <Text className="text-[11px] font-semibold text-muted-foreground">{WEEKDAY_LABELS[i]}</Text>
                    <Text className="text-[10px] font-normal text-muted-foreground">{getDayLabel(d)}</Text>
                  </View>
                ))}
              </View>
              {timeSlots.map((time) => (
                <View key={time} className="flex-row border-b border-border px-2 py-1.5 last:border-b-0">
                  <View className="w-16 justify-start px-1">
                    <Text className="text-[11px] font-semibold text-muted-foreground">{time}</Text>
                  </View>
                  {weekDates.map((date) => {
                    const slot = slotsByDateTime.get(`${date}__${time}`);
                    const status = slot?.status ?? 'available';
                    const job = slot?.jobId ? getJob(slot.jobId) : undefined;

                    const isWorking = job && status === 'working';
                    const isAwaiting = job && status === 'available';
                    const isOffEmpty = !job && status === 'off';
                    const isAvailableEmpty = !job && status !== 'off';

                    return (
                      <View key={date} className="w-20 px-1">
                        {job ? (
                          <Pressable
                            onPress={() =>
                              router.push({ pathname: '/mechanic/jobs/detail', params: { id: job.id } })
                            }
                            className={cn(
                              'min-h-[44px] items-center justify-center rounded-xl border px-1 py-1 active:scale-95',
                              isWorking && 'border-primary bg-primary',
                              isAwaiting && 'border-amber-500/50 bg-amber-500/10',
                            )}
                          >
                            <Text
                              className={cn(
                                'truncate text-[10px] font-bold',
                                isWorking && 'text-primary-foreground',
                                isAwaiting && 'text-amber-700',
                              )}
                            >
                              {job.type}
                            </Text>
                            <Text
                              className={cn(
                                'truncate text-[10px] opacity-80',
                                isWorking && 'text-primary-foreground',
                                isAwaiting && 'text-amber-700',
                              )}
                            >
                              {job.vehicle.plate}
                            </Text>
                          </Pressable>
                        ) : (
                          <View
                            className={cn(
                              'min-h-[44px] items-center justify-center rounded-xl border border-dashed px-1 py-1',
                              isOffEmpty && 'border-border bg-secondary/30',
                              isAvailableEmpty && 'border-border bg-background',
                            )}
                          >
                            <Text
                              className={cn(
                                'text-[10px]',
                                isOffEmpty ? 'text-muted-foreground' : 'text-muted-foreground',
                              )}
                            >
                              {isOffEmpty ? 'Off' : 'Open'}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>

        <View className="mt-3 flex-row flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <LegendDot className="bg-primary" label="Working" />
          <LegendDot className="bg-amber-500/40 border border-amber-500/50" label="Awaiting" />
          <LegendDot className="border border-dashed border-border bg-secondary/30" label="Available / Off" />
        </View>

        <Card className="mt-3 bg-primary/5 p-4">
          <View className="flex-row items-center gap-2">
            <Badge tone="blue" className="self-start">
              <Text className="text-xs font-semibold text-primary">Tip</Text>
            </Badge>
            <Text className="flex-1 text-xs text-muted-foreground">
              Tap any job slot to open its full details.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('size-3 rounded-full', className)} />
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}
