import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar, Clock, X } from 'lucide-react-native';

import { cn } from '@/lib/utils';
import {
  formatDdMmYyyy,
  formatDdMmYyyyHHmm,
  formatHHmm,
  toIsoDate,
  toIsoTime,
} from '@/lib/format';

type Mode = 'date' | 'time' | 'datetime';

type CommonProps = {
  /** Mode hiển thị của picker. */
  mode: Mode;
  /** Giá trị hiện tại (Date). Nếu `null` sẽ hiển thị placeholder. */
  value: Date | null;
  /** Callback khi user chọn giá trị mới. */
  onChange: (date: Date) => void;
  /** Ngày tối thiểu được phép chọn (mặc định = hôm nay). */
  minimumDate?: Date;
  /** Ngày tối đa được phép chọn. */
  maximumDate?: Date;
  /** Placeholder khi chưa có giá trị. */
  placeholder?: string;
  /** Inline error styling. */
  error?: boolean;
  /** Label icon trái (calendar / clock). Mặc định tự chọn theo mode. */
  icon?: 'calendar' | 'clock';
  /** Accessibility label. */
  accessibilityLabel?: string;
  /** Minute interval cho time picker. Mặc định = 1. */
  minuteInterval?: 1 | 5 | 10 | 15 | 20 | 30;
};

const BUTTON_CLASS =
  'flex-row items-center justify-between rounded-2xl border bg-background px-4 py-3 active:scale-[0.99]';
const BORDER_NORMAL = 'border-input';
const BORDER_ERROR = 'border-destructive';

/**
 * Pressable field mở DateTimePicker native khi tap.
 *
 * - iOS: hiển thị inline modal (compact) hoặc spinner tuỳ `display`.
 * - Android: mặc định dùng `DateTimePickerAndroid.open()` để mở dialog native.
 *
 * Component chỉ thuần wrapper, mọi logic state nằm ở parent (controlled).
 */
export function DateTimePickerField({
  mode,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder,
  error,
  icon,
  accessibilityLabel,
  minuteInterval = 1,
}: CommonProps) {
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const [androidStage, setAndroidStage] = useState<'date' | 'time'>(
    mode === 'time' ? 'time' : 'date',
  );
  const [androidTemp, setAndroidTemp] = useState<Date | null>(value ?? null);
  const [iosModalOpen, setIosModalOpen] = useState(false);

  const displayValue = useMemo(() => {
    if (!value) return '';
    if (mode === 'date') return formatDdMmYyyy(value);
    if (mode === 'time') return formatHHmm(value);
    return formatDdMmYyyyHHmm(value);
  }, [mode, value]);

  const Icon = icon
    ? icon === 'clock'
      ? Clock
      : Calendar
    : mode === 'time'
      ? Clock
      : Calendar;

  const open = useCallback(() => {
    if (Platform.OS === 'android') {
      setAndroidTemp(value ?? new Date());
      setAndroidStage(mode === 'time' ? 'time' : 'date');
      setAndroidPickerOpen(true);
    } else {
      setIosModalOpen(true);
    }
  }, [mode, value]);

  const handleIosChange = useCallback(
    (_event: DateTimePickerEvent, selected?: Date) => {
      if (!selected) return;
      onChange(selected);
    },
    [onChange],
  );

  const handleAndroidChange = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      if (event.type === 'dismissed' || !selected) {
        setAndroidPickerOpen(false);
        return;
      }
      if (mode === 'datetime') {
        if (androidStage === 'date') {
          setAndroidTemp(selected);
          setAndroidStage('time');
          // Reopen native picker for time stage
          setTimeout(() => setAndroidPickerOpen(true), 50);
          return;
        }
        onChange(selected);
        setAndroidPickerOpen(false);
        return;
      }
      onChange(selected);
      setAndroidPickerOpen(false);
    },
    [androidStage, mode, onChange],
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityState={{ disabled: false }}
        onPress={open}
        className={cn(BUTTON_CLASS, error ? BORDER_ERROR : BORDER_NORMAL)}
      >
        <View className="flex-row items-center gap-2.5">
          <Icon size={18} color="#64748b" />
          <Text
            className={cn(
              'text-sm',
              displayValue ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {displayValue || placeholder || 'Chọn...'}
          </Text>
        </View>
      </Pressable>

      {/* Android inline picker (managed manually because Android uses native dialog) */}
      {Platform.OS === 'android' && androidPickerOpen && (
        <DateTimePicker
          mode={androidStage}
          value={androidTemp ?? value ?? new Date()}
          onChange={handleAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          minuteInterval={minuteInterval}
          is24Hour
        />
      )}

      {/* iOS modal picker */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={iosModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIosModalOpen(false)}
        >
          <View className="flex-1 items-center justify-end bg-black/40">
            <Pressable
              className="absolute inset-0"
              onPress={() => setIosModalOpen(false)}
            />
            <View className="w-full rounded-t-3xl bg-card p-4 pb-8">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-base font-bold text-foreground">
                  {mode === 'date'
                    ? 'Chọn ngày'
                    : mode === 'time'
                      ? 'Chọn giờ'
                      : 'Chọn ngày & giờ'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng"
                  onPress={() => setIosModalOpen(false)}
                  className="rounded-full bg-secondary p-1.5 active:scale-95"
                >
                  <X size={18} color="#16202f" />
                </Pressable>
              </View>
              <DateTimePicker
                mode={mode}
                value={value ?? new Date()}
                onChange={handleIosChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                minuteInterval={minuteInterval}
                display="spinner"
                is24Hour
                locale="vi-VN"
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

/**
 * Helper để chuyển `Date | null` thành ISO date (`YYYY-MM-DD`) - format BE.
 *
 * Trả về chuỗi rỗng khi `date == null` để dễ bind vào state controlled.
 */
export function dateToIsoDate(date: Date | null): string {
  if (!date) return '';
  return toIsoDate(date);
}

/**
 * Helper để chuyển `Date | null` thành ISO time (`HH:mm`) - format BE.
 */
export function dateToIsoTime(date: Date | null): string {
  if (!date) return '';
  return toIsoTime(date);
}

/**
 * Ghép 2 input ngày + giờ thành Date an toàn.
 *
 * - Nếu date string rỗng hoặc không hợp lệ → trả `null`.
 * - Nếu time string rỗng → dùng 00:00.
 */
export function combineDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  // dateStr expected `YYYY-MM-DD`
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
}

/**
 * Scroll-based mini calendar dùng cho mode 'date' khi muốn lightweight UX
 * không cần native spinner (fallback nếu native picker không khả dụng).
 *
 * Hiển thị tháng hiện tại với 6 tuần (42 ô) để giữ layout cố định.
 */
export function MiniMonthCalendar({
  value,
  minimumDate,
  onChange,
}: {
  value: Date | null;
  minimumDate?: Date;
  onChange: (d: Date) => void;
}) {
  const initial = value ?? new Date();
  const [cursor, setCursor] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const monthLabel = cursor.toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });
  const startWeekday = (cursor.getDay() + 6) % 7; // tuần bắt đầu T2
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (cells.length < 42) cells.push(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = minimumDate ? new Date(minimumDate) : undefined;
  if (minDate) minDate.setHours(0, 0, 0, 0);

  const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  return (
    <View className="rounded-2xl border border-border bg-card p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="Tháng trước"
          accessibilityRole="button"
          onPress={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
          className="rounded-lg bg-secondary px-3 py-1 active:scale-95"
        >
          <Text className="text-xs font-semibold text-foreground">‹</Text>
        </Pressable>
        <Text className="text-sm font-bold text-foreground capitalize">
          {monthLabel}
        </Text>
        <Pressable
          accessibilityLabel="Tháng sau"
          accessibilityRole="button"
          onPress={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
          className="rounded-lg bg-secondary px-3 py-1 active:scale-95"
        >
          <Text className="text-xs font-semibold text-foreground">›</Text>
        </Pressable>
      </View>
      <View className="mb-1 flex-row">
        {weekdayLabels.map((w) => (
          <Text
            key={w}
            className="flex-1 text-center text-[10px] font-semibold text-muted-foreground"
          >
            {w}
          </Text>
        ))}
      </View>
      <ScrollView>
        <View className="flex-row flex-wrap">
          {cells.map((d, idx) => {
            if (!d) {
              return <View key={`empty-${idx}`} className="h-10 w-[14.28%]" />;
            }
            const isPast = minDate ? d.getTime() < minDate.getTime() : false;
            const isToday = d.getTime() === today.getTime();
            const isSelected =
              value && d.getTime() === new Date(value).setHours(0, 0, 0, 0);
            return (
              <Pressable
                key={d.toISOString()}
                accessibilityRole="button"
                accessibilityState={{ disabled: isPast, selected: !!isSelected }}
                disabled={isPast}
                onPress={() => onChange(d)}
                className={cn(
                  'h-10 w-[14.28%] items-center justify-center rounded-md',
                  isSelected
                    ? 'bg-primary'
                    : isToday
                      ? 'bg-secondary'
                      : 'bg-transparent active:bg-secondary',
                  isPast && 'opacity-30',
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-semibold',
                    isSelected ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {d.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
