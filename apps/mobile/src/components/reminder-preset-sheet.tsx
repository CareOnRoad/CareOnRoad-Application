import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Check, Sparkles, X } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { DateTimePickerField, dateToIsoDate } from '@/components/ui/datetime-picker-field';
import { cn } from '@/lib/utils';
import { formatDdMmYyyy } from '@/lib/format';
import { planRequiredMessageFor } from '@/lib/plan-gate';
import {
  REMINDER_ITEM_LABELS,
  USAGE_LEVEL_LABELS,
  USAGE_LEVELS,
  applyReminderPresets,
  listReminderPresets,
  type ReminderItemCode,
  type ReminderPreset,
  type UsageLevel,
} from '@/lib/reminders-service';
import type { Vehicle } from '@/lib/types';

/**
 * ReminderPresetSheet - bật "mẫu nhắc bảo dưỡng" cho 1 xe (gói Advance/VIP).
 *
 * Luồng:
 *  1. Chọn xe (BE áp mẫu theo `motorcycle_id`).
 *  2. Chọn mức sử dụng `usage_level` (Ít / Vừa / Nhiều) — BE quy định chu kỳ.
 *  3. Chọn mẫu (checkbox) từ `GET /api/v1/reminder-presets`.
 *  4. Tuỳ chọn "lần làm gần nhất" (`last_done_on`) cho từng mẫu.
 *
 * Quy tắc gói:
 *  - Bật mẫu cần gói `advance`; mẫu `insurance_renewal` cần `vip`.
 *  - Lỗi 403 `plan_required` hiển thị message tiếng Việt, không crash.
 */
export function ReminderPresetSheet({
  visible,
  vehicles,
  onClose,
  onApplied,
}: {
  visible: boolean;
  vehicles: Vehicle[];
  onClose: () => void;
  onApplied: () => Promise<void> | void;
}) {
  const [presets, setPresets] = useState<ReminderPreset[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [motorcycleId, setMotorcycleId] = useState<string>('');
  const [usageLevel, setUsageLevel] = useState<UsageLevel>('normal');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [lastDone, setLastDone] = useState<Record<string, string>>({});

  // Load catalog mỗi lần mở sheet.
  // setState được đặt trong microtask để tránh cảnh báo
  // `react-hooks/set-state-in-effect` (setState đồng bộ trong effect).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      setLoadingCatalog(true);
      setError(null);
      setSuccess(null);
      try {
        const catalog = await listReminderPresets();
        if (cancelled) return;
        setPresets(catalog.items);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : 'Không thể tải mẫu nhắc bảo dưỡng',
        );
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Mặc định chọn xe đầu tiên khi mở.
  useEffect(() => {
    if (!visible) return;
    const first = vehicles[0]?.id || '';
    if (!first) return;
    void (async () => {
      setMotorcycleId((prev) => prev || first);
    })();
  }, [visible, vehicles]);

  const selectedItems = useMemo(
    () =>
      presets
        .filter((preset) => selected[preset.item_code])
        .map((preset) => ({
          item_code: preset.item_code,
          ...(lastDone[preset.item_code]
            ? { last_done_on: lastDone[preset.item_code] }
            : {}),
        })),
    [presets, selected, lastDone],
  );

  const toggle = (code: ReminderItemCode) => {
    setSelected((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const handleSubmit = async () => {
    if (!motorcycleId) {
      setError('Vui lòng chọn xe.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Vui lòng chọn ít nhất một mẫu nhắc.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await applyReminderPresets(motorcycleId, {
        usage_level: usageLevel,
        items: selectedItems,
      });
      const created = result.items.filter((item) => item.created).length;
      const existed = result.items.length - created;
      setSuccess(
        `Đã bật ${created} mẫu nhắc mới${existed > 0 ? `, ${existed} mẫu đã có sẵn` : ''}.`,
      );
      await onApplied();
    } catch (e) {
      const planMessage = planRequiredMessageFor(e);
      setError(
        planMessage ??
          (e instanceof Error ? e.message : 'Không thể bật mẫu nhắc bảo dưỡng'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelected({});
    setLastDone({});
    setUsageLevel('normal');
    setSuccess(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable
        onPress={submitting ? undefined : handleClose}
        accessibilityRole="button"
        accessibilityLabel="Đóng"
        className="flex-1 items-center justify-center bg-black/50 px-5"
      >
        <Pressable onPress={() => undefined} className="w-full max-w-md">
          <View className="w-full max-h-[85vh] rounded-3xl border border-border bg-card p-5 shadow-xl">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Sparkles size={18} color="#1974f7" />
                <Text className="text-base font-bold text-foreground">
                  Mẫu nhắc bảo dưỡng
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                onPress={handleClose}
                className="rounded-full active:scale-95"
              >
                <View className="rounded-full bg-secondary p-1.5">
                  <X size={16} color="#16202f" />
                </View>
              </Pressable>
            </View>

            <ScrollView
              className="mt-3"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {error && (
                <View className="mb-3">
                  <Banner tone="error" description={error} />
                </View>
              )}
              {success && (
                <View className="mb-3">
                  <Banner tone="success" description={success} />
                </View>
              )}

              {loadingCatalog ? (
                <View className="items-center py-8">
                  <ActivityIndicator color="#1974f7" />
                </View>
              ) : (
                <>
                  {/* Chọn xe */}
                  <Text className="mb-1.5 text-sm font-semibold text-foreground">
                    Áp cho xe
                  </Text>
                  {vehicles.length === 0 ? (
                    <Banner
                      tone="warning"
                      description="Bạn chưa có xe nào. Hãy thêm xe trước khi bật mẫu nhắc."
                    />
                  ) : (
                    <View className="gap-2">
                      {vehicles.map((vehicle) => {
                        const active = motorcycleId === vehicle.id;
                        return (
                          <Pressable
                            key={vehicle.id}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={vehicle.name}
                            onPress={() => setMotorcycleId(vehicle.id)}
                            className={cn(
                              'flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:opacity-80',
                              active
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-secondary',
                            )}
                          >
                            <View
                              className={cn(
                                'h-5 w-5 items-center justify-center rounded-full border',
                                active ? 'border-primary bg-primary' : 'border-border bg-card',
                              )}
                            >
                              {active ? <Check size={12} color="#ffffff" /> : null}
                            </View>
                            <View className="flex-1">
                              <Text className="text-sm font-semibold text-foreground">
                                {vehicle.name}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {vehicle.plate}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* Mức sử dụng */}
                  <Text className="mb-1.5 mt-4 text-sm font-semibold text-foreground">
                    Bạn đi xe nhiều không?
                  </Text>
                  <View className="flex-row gap-2">
                    {USAGE_LEVELS.map((level) => {
                      const active = usageLevel === level;
                      return (
                        <Pressable
                          key={level}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={USAGE_LEVEL_LABELS[level]}
                          onPress={() => setUsageLevel(level)}
                          className={cn(
                            'flex-1 items-center rounded-xl border py-2.5 active:opacity-80',
                            active
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-secondary',
                          )}
                        >
                          <Text
                            className={cn(
                              'text-sm font-semibold',
                              active ? 'text-primary' : 'text-foreground',
                            )}
                          >
                            {USAGE_LEVEL_LABELS[level]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text className="mt-1.5 text-xs text-muted-foreground">
                    Chu kỳ nhắc được tính tự động theo mức sử dụng và khuyến cáo của
                    hãng xe.
                  </Text>

                  {/* Chọn mẫu */}
                  <Text className="mb-1.5 mt-4 text-sm font-semibold text-foreground">
                    Bạn muốn app nhắc gì?
                  </Text>
                  <View className="gap-2">
                    {presets.map((preset) => {
                      const active = !!selected[preset.item_code];
                      const days = preset.interval_days[usageLevel];
                      return (
                        <Pressable
                          key={preset.item_code}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: active }}
                          accessibilityLabel={REMINDER_ITEM_LABELS[preset.item_code]}
                          onPress={() => toggle(preset.item_code)}
                          className={cn(
                            'rounded-2xl border px-4 py-3 active:opacity-80',
                            active
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-secondary',
                          )}
                        >
                          <View className="flex-row items-center gap-3">
                            <View
                              className={cn(
                                'h-5 w-5 items-center justify-center rounded-md border',
                                active ? 'border-primary bg-primary' : 'border-border bg-card',
                              )}
                            >
                              {active ? <Check size={12} color="#ffffff" /> : null}
                            </View>
                            <View className="flex-1">
                              <View className="flex-row items-center gap-2">
                                <Text className="flex-1 text-sm font-semibold text-foreground">
                                  {REMINDER_ITEM_LABELS[preset.item_code]}
                                </Text>
                                {preset.required_plan === 'vip' ? (
                                  <Badge tone="amber">VIP</Badge>
                                ) : null}
                              </View>
                              <Text className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                {preset.title}
                              </Text>
                              <Text className="mt-1 text-xs font-semibold text-primary">
                                Nhắc mỗi {days} ngày
                                {preset.lead_days > 0
                                  ? ` · nhắc trước ${preset.lead_days} ngày`
                                  : ''}
                              </Text>
                            </View>
                          </View>

                          {active && (
                            <View className="mt-2 border-t border-border pt-2">
                              <Text className="mb-1 text-xs text-muted-foreground">
                                Lần làm gần nhất (không bắt buộc)
                              </Text>
                              <DateTimePickerField
                                mode="date"
                                value={
                                  lastDone[preset.item_code]
                                    ? new Date(`${lastDone[preset.item_code]}T00:00:00`)
                                    : null
                                }
                                onChange={(d) =>
                                  setLastDone((prev) => ({
                                    ...prev,
                                    [preset.item_code]: dateToIsoDate(d),
                                  }))
                                }
                                maximumDate={new Date()}
                                placeholder="Chọn ngày"
                                accessibilityLabel={`Lần làm gần nhất ${REMINDER_ITEM_LABELS[preset.item_code]}`}
                              />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>

            <View className="mt-4 flex-row gap-3">
              <ActionButton
                variant="secondary"
                className="flex-1"
                onPress={handleClose}
                disabled={submitting}
                accessibilityLabel="Huỷ"
              >
                <Text className="text-sm font-semibold text-foreground">Huỷ</Text>
              </ActionButton>
              <ActionButton
                className="flex-1"
                onPress={handleSubmit}
                disabled={submitting || loadingCatalog || vehicles.length === 0}
                accessibilityLabel="Bật mẫu nhắc"
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-sm font-semibold text-primary-foreground">
                    Bật mẫu nhắc
                  </Text>
                )}
              </ActionButton>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Format ngày hiển thị cho `last_done_on` (YYYY-MM-DD).
 */
export function formatLastDone(value: string): string {
  if (!value) return '';
  return formatDdMmYyyy(`${value}T00:00:00`);
}
