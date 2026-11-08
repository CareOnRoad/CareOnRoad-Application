import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar, Clock, X } from 'lucide-react-native';

import { cn } from '@/lib/utils';
import {
  mergeSelectedTime,
  resolveAndroidPickerMode,
  startOfDay,
} from '@/lib/datetime-picker';
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
 * - Android: dùng imperative API `DateTimePickerAndroid.open()` để mở
 *   dialog native (Android KHÔNG hỗ trợ `mode='datetime'` → mode 'datetime'
 *   được tách thành 2 bước: chọn ngày rồi chọn giờ).
 *
 * Component chỉ thuần wrapper, mọi logic state nằm ở parent (controlled).
 *
 * LƯU Ý (rất quan trọng — xem AGENTS.md 4.11):
 * `className` (kể cả variant `active:`) PHẢI nằm trên `<Pressable>` GỐC.
 * Nếu đặt class có pseudo-class (`active:`/`hover:`/`focus:`) lên một
 * `<View>` con, NativeWind sẽ tự nâng `<View>` đó thành `Pressable`
 * (react-native-css-interop `native-interop.ts` → `UpgradeState.SHOULD_UPGRADE`).
 * `Pressable` sâu hơn sẽ cướm responder của `Pressable` cha trong quá trình
 * `onStartShouldSetResponder` negotiation → `onPress` của cha không bao giờ
 * chạy → "bấm vào không hiện modal".
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

  const handleIosChange = useCallback(
    (_event: DateTimePickerEvent, selected?: Date) => {
      if (!selected) return;
      onChange(selected);
    },
    [onChange],
  );

  /**
   * Android imperative API.
   *
   * - mode 'date'  → mở dialog chọn ngày.
   * - mode 'time'  → mở dialog chọn giờ.
   * - mode 'datetime' → mở dialog chọn ngày trước; khi user chốt ngày thì
   *   mở tiếp dialog chọn giờ với ngày vừa chọn làm mốc.
   *
   * Dùng `onValueChange` / `onDismiss` (không dùng `onChange` vì `onChange`
   * đã bị thư viện đánh dấu deprecated).
   */
  const openAndroid = useCallback(() => {
    const androidMode = resolveAndroidPickerMode(mode);

    if (androidMode === 'time') {
      DateTimePickerAndroid.open({
        value: value ?? new Date(),
        mode: 'time',
        is24Hour: true,
        minuteInterval,
        onValueChange: (_event, selected) => onChange(selected),
      });
      return;
    }

    DateTimePickerAndroid.open({
      value: value ?? new Date(),
      mode: 'date',
      minimumDate,
      maximumDate,
      onValueChange: (_event, selected) => {
        const pickedDay = startOfDay(selected);
        if (mode === 'datetime') {
          // Bước 2: chọn giờ, giữ nguyên ngày vừa chọn làm mốc.
          DateTimePickerAndroid.open({
            value: pickedDay,
            mode: 'time',
            is24Hour: true,
            minuteInterval,
            onValueChange: (_timeEvent, timeSelected) => {
              onChange(mergeSelectedTime(pickedDay, timeSelected));
            },
          });
          return;
        }
        onChange(pickedDay);
      },
    });
  }, [mode, value, minimumDate, maximumDate, minuteInterval, onChange]);

  const open = useCallback(() => {
    if (Platform.OS === 'android') {
      openAndroid();
      return;
    }
    if (Platform.OS === 'ios') {
      setIosModalOpen(true);
    }
  }, [openAndroid]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        onPress={open}
        hitSlop={8}
        // `className` (kèm `active:`) phải nằm TRỰC TIẾP trên Pressable gốc.
        // Không bọc View con mang class có pseudo-class, nếu không NativeWind
        // sẽ nâng View con thành Pressable và cướm responder (mất onPress).
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
                  className="rounded-full active:scale-95"
                >
                  <View className="rounded-full bg-secondary p-1.5">
                    <X size={18} color="#16202f" />
                  </View>
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
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <View className="rounded-lg bg-secondary px-3 py-1">
            <Text className="text-xs font-semibold text-foreground">‹</Text>
          </View>
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
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <View className="rounded-lg bg-secondary px-3 py-1">
            <Text className="text-xs font-semibold text-foreground">›</Text>
          </View>
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
              >
                <View
                  className={cn(
                    'h-10 w-[14.28%] items-center justify-center rounded-md',
                    isSelected
                      ? 'bg-primary'
                      : isToday
                        ? 'bg-secondary'
                        : 'bg-transparent',
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
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
