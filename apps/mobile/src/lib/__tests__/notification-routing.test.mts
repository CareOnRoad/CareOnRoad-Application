import assert from "node:assert/strict";
import test from "node:test";

import { hrefFor, routeFor } from "@/lib/notification-routing";
import type { NotificationItem } from "@/lib/notifications-service";

/**
 * Regression test cho lỗi deep-link thông báo "Cần duyệt báo giá".
 *
 * Trước đây category `quote` mở thẳng màn `/rider/payments/{quoteId}`.
 * Khi quote còn `pending`, BE từ chối tạo payment order (409 "Quote is not
 * payable") → rider bị kẹt ở màn lỗi. Đúng ra phải mở màn CHI TIẾT yêu cầu,
 * nơi có card báo giá + nút Duyệt/Từ chối.
 */
function makeNotification(partial: Partial<NotificationItem>): NotificationItem {
  return {
    id: "notif-1",
    user_id: "user-1",
    category: "quote",
    title: "Cần duyệt báo giá",
    body: "Bạn có báo giá mới cần xác nhận.",
    read: false,
    created_at: "2026-01-01T00:00:00.000Z",
    data: {},
    ...partial,
  } as NotificationItem;
}

test("thông báo quote của rider mở màn chi tiết yêu cầu", () => {
  const target = routeFor(
    makeNotification({
      data: { request_id: "req-1", quote_id: "quote-1" },
    }),
    "rider",
  );
  assert.deepEqual(target, { kind: "rider-rescue", requestId: "req-1" });
});

test("href của thông báo quote không trỏ thẳng màn thanh toán", () => {
  const href = hrefFor(
    routeFor(
      makeNotification({
        data: { request_id: "req-1", quote_id: "quote-1" },
      }),
      "rider",
    ),
  );
  assert.equal(href, "/rider/rescue/req-1");
  assert.equal(href?.startsWith("/rider/payments/"), false);
});

test("thông báo quote không có request_id thì không navigate", () => {
  const target = routeFor(
    makeNotification({ data: { quote_id: "quote-1" } }),
    "rider",
  );
  assert.deepEqual(target, { kind: "none" });
  assert.equal(hrefFor(target), null);
});

test("thông báo quote cho mechanic không mở màn rider", () => {
  const target = routeFor(
    makeNotification({
      data: { request_id: "req-1", quote_id: "quote-1" },
    }),
    "mechanic",
  );
  assert.deepEqual(target, { kind: "none" });
});

test("thông báo payment vẫn mở màn chi tiết yêu cầu", () => {
  const target = routeFor(
    makeNotification({
      category: "payment",
      data: { request_id: "req-2" },
    }),
    "rider",
  );
  assert.deepEqual(target, { kind: "rider-rescue", requestId: "req-2" });
});
