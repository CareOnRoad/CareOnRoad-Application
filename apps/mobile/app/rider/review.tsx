import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Star } from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { createReview, listAssignments } from '@/lib/assignments-service';
import { getServiceRequest, type ServiceRequestResponse } from '@/lib/service-requests-service';

/**
 * ReviewScreen - tạo review cho assignment sau khi hoàn tất.
 *
 * Flow:
 *  1. Fetch service-request → lấy assignmentId (cần lấy từ /api/v1/assignments).
 *  2. Chọn rating 1-5 sao + nhập comment.
 *  3. POST /api/v1/assignments/{id}/review (idempotent qua X-Idempotency-Key).
 *
 * BE: review là immutable - 1 rider / 1 assignment / 1 review. Nếu đã review → BE 409.
 */
export default function ReviewScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const [request, setRequest] = useState<ServiceRequestResponse | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getServiceRequest(requestId);
        if (!cancelled) setRequest(r);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Không thể tải yêu cầu');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const submit = async () => {
    if (!requestId) return;
    if (rating < 1 || rating > 5) {
      setError('Vui lòng chọn số sao đánh giá.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Service-request id không phải assignment id; phân trang tìm assignment
      // khớp request_id. BE không filter theo request_id, nên duyệt cursor đến khi
      // tìm thấy hoặc hết page.
      let cursor: string | undefined;
      let assignmentId: string | null = null;
      let safetyCounter = 0;
      while (safetyCounter < 20) {
        safetyCounter += 1;
        const page = await listAssignments({ limit: 50, cursor });
        const match = page.items.find((x) => x.request_id === requestId);
        if (match) {
          assignmentId = match.id;
          break;
        }
        if (!page.next_cursor) break;
        cursor = page.next_cursor;
      }
      if (!assignmentId) {
        setError('Không tìm thấy assignment để đánh giá.');
        return;
      }
      await createReview(assignmentId, { rating, comment: comment.trim() || undefined });
      router.replace('/rider/(tabs)/rescue');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <AppHeader title="Đánh giá thợ" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1974f7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <AppHeader title="Đánh giá thợ" onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {request && (
          <Card className="mb-4 p-4">
            <Text className="text-xs text-muted-foreground">Yêu cầu</Text>
            <Text className="font-mono text-sm font-bold text-foreground">
              {request.request_code}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
              {request.problem_description}
            </Text>
          </Card>
        )}

        <Text className="mb-3 font-bold text-foreground">Bạn thấy dịch vụ thế nào?</Text>
        <View className="flex-row items-center justify-center gap-2 py-4">
          {[1, 2, 3, 4, 5].map((s) => {
            const active = rating >= s;
            return (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`${s} sao`}
                accessibilityState={{ selected: active }}
                onPress={() => setRating(s)}
                className="active:scale-90"
              >
                <Star
                  size={40}
                  color={active ? '#fbbf24' : '#cbd5e1'}
                  fill={active ? '#fbbf24' : 'transparent'}
                />
              </Pressable>
            );
          })}
        </View>
        <Text className="text-center text-xs text-muted-foreground">
          {rating === 0
            ? 'Chạm để chọn số sao'
            : rating <= 2
              ? 'Rất tệ'
              : rating === 3
                ? 'Tạm ổn'
                : rating === 4
                  ? 'Tốt'
                  : 'Tuyệt vời'}
        </Text>

        <Card className="mt-5 p-4">
          <Text className="mb-2 text-sm font-bold text-foreground">Nhận xét (không bắt buộc)</Text>
          <View className="rounded-xl border border-border bg-background px-3 py-2">
            <TextInput
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
              placeholder="Chia sẻ trải nghiệm của bạn để giúp cộng đồng CareOnRoad..."
              placeholderTextColor="#94a3b8"
              className="min-h-[100px] text-sm text-foreground"
              accessibilityLabel="Nhận xét"
            />
          </View>
        </Card>

        {error && (
          <View className="mt-4">
            <Banner tone="error" description={error} />
          </View>
        )}

        <ActionButton
          fullWidth
          className="mt-6 py-4"
          disabled={rating === 0 || submitting}
          onPress={submit}
          accessibilityLabel="Gửi đánh giá"
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">Gửi đánh giá</Text>
          )}
        </ActionButton>

        <ActionButton
          fullWidth
          variant="outline"
          className="mt-3"
          onPress={() => router.back()}
          accessibilityLabel="Để sau"
        >
          <Text className="text-sm font-semibold text-foreground">Để sau</Text>
        </ActionButton>
      </ScrollView>
    </SafeAreaView>
  );
}
