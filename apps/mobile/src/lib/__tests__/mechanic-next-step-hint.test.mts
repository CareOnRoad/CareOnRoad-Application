import assert from "node:assert/strict";
import test from "node:test";

import {
  nextAllowedStatuses,
  nextStepHint,
  type AssignmentStatus,
} from "@/lib/mechanic-jobs-service";

/**
 * Regression test cho màn "Cập nhật công việc" của mechanic.
 *
 * Vấn đề: ở trạng thái `diagnosis`, BE KHÔNG cho mechanic chuyển trạng thái
 * thủ công (BE tự set `quoted` khi tạo quote version đầu tiên). UI cũ chỉ
 * hiện "Không có bước chuyển trạng thái nào khả dụng" → mechanic tưởng app
 * lỗi. `nextStepHint` phải luôn chỉ rõ bước tiếp theo.
 */

test("diagnosis không có transition thủ công khi chưa có quote cuối được duyệt", () => {
  assert.deepEqual(nextAllowedStatuses("diagnosis"), ["canceled"]);
});

test("diagnosis mở 'Bắt đầu sửa' cho workflow nhiều bước khi quote cuối đã duyệt", () => {
  assert.deepEqual(
    nextAllowedStatuses("diagnosis", {
      serviceType: "emergency_rescue",
      hasApprovedFinalQuote: true,
    }),
    ["in_progress", "canceled"],
  );
  assert.deepEqual(
    nextAllowedStatuses("diagnosis", {
      serviceType: "periodic_maintenance",
      hasApprovedFinalQuote: true,
    }),
    ["in_progress", "canceled"],
  );
});

test("nextStepHint luôn có hướng dẫn cho các trạng thái không có transition thủ công", () => {
  for (const status of ["accepted", "en_route", "on_site", "diagnosis", "quoted", "awaiting_payment", "in_progress"] as AssignmentStatus[]) {
    const hint = nextStepHint(status);
    assert.ok(hint && hint.length > 0, `thiếu hint cho status ${status}`);
    // Không được dùng lại câu "không có bước chuyển trạng thái khả dụng".
    assert.doesNotMatch(hint, /không có bước chuyển trạng thái/i);
  }
});

test("hint ở diagnosis hướng dẫn gửi báo giá khi chưa có quote cuối", () => {
  const hint = nextStepHint("diagnosis", { serviceType: "emergency_rescue" });
  assert.ok(hint);
  assert.match(hint, /chẩn đoán/i);
  assert.match(hint, /báo giá/i);
});

test("hint ở diagnosis hướng dẫn bắt đầu sửa khi quote cuối đã được duyệt", () => {
  const hint = nextStepHint("diagnosis", {
    serviceType: "emergency_rescue",
    hasApprovedFinalQuote: true,
  });
  assert.ok(hint);
  assert.match(hint, /bắt đầu sửa/i);
});

test("hint ở accepted của workflow nhiều bước nhắc gửi báo giá tiền công", () => {
  const hint = nextStepHint("accepted", { serviceType: "periodic_maintenance" });
  assert.ok(hint);
  assert.match(hint, /báo giá tiền công/i);
});

test("trạng thái kết thúc không có hint", () => {
  assert.equal(nextStepHint("completed"), "Công việc đã hoàn tất.");
  assert.equal(nextStepHint("canceled"), "Công việc đã kết thúc.");
  assert.equal(nextStepHint("unknown_status"), null);
});
