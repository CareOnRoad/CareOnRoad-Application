import assert from "node:assert/strict";
import test from "node:test";

import {
  BE_JOB_TIMELINE,
  nextAllowedStatuses,
  timelineIndexForStatus,
} from "@/lib/mechanic-jobs-service";
import { quotePurposePlanFor } from "@/lib/mechanic-quotes-service";

/**
 * Regression test cho luồng mechanic: chẩn đoán + báo giá + tiến trình.
 *
 * 1. `nextAllowedStatuses` chỉ trả transition mà mechanic BẤM ĐƯỢC thật sự.
 *    BE chủ động từ chối `diagnosis → quoted`, `quoted → awaiting_payment`
 *    và `in_progress → completed` → UI không được hiện nút cho các bước này.
 * 2. Timeline phải phản ánh BE status raw (không dùng UI status gộp).
 * 3. `quotePurposePlanFor` phải trả đúng purpose theo service_type + stage.
 */
test("nextAllowedStatuses chỉ gồm transition mechanic bấm được", () => {
  assert.deepEqual(nextAllowedStatuses("accepted"), ["en_route", "canceled"]);
  assert.deepEqual(nextAllowedStatuses("en_route"), ["on_site", "canceled"]);
  assert.deepEqual(nextAllowedStatuses("on_site"), ["diagnosis", "canceled"]);
  // BE tự set `quoted` khi quote version đầu tiên được tạo.
  assert.deepEqual(nextAllowedStatuses("diagnosis"), ["canceled"]);
  // BE tự set `awaiting_payment` khi rider duyệt quote.
  assert.deepEqual(nextAllowedStatuses("quoted"), ["canceled"]);
  assert.deepEqual(nextAllowedStatuses("awaiting_payment"), [
    "in_progress",
    "canceled",
  ]);
  assert.deepEqual(nextAllowedStatuses("in_progress"), [
    "awaiting_payment",
    "canceled",
  ]);
  assert.deepEqual(nextAllowedStatuses("completed"), []);
  assert.deepEqual(nextAllowedStatuses("canceled"), []);
});

test("diagnosis → in_progress chỉ mở cho workflow nhiều bước có quote cuối", () => {
  // Không có service_type → không mở (BE sẽ trả 409).
  assert.deepEqual(nextAllowedStatuses("diagnosis"), ["canceled"]);

  // Cứu hộ: sau khi rider duyệt `rescue_final`, BE đưa assignment về
  // `diagnosis` → mechanic được chuyển `diagnosis → in_progress`.
  assert.deepEqual(
    nextAllowedStatuses("diagnosis", {
      serviceType: "emergency_rescue",
      hasApprovedFinalQuote: true,
    }),
    ["in_progress", "canceled"],
  );
  // Chưa có quote cuối được duyệt → BE từ chối ("An approved final rescue
  // quote is required before repair.") → không hiện nút.
  assert.deepEqual(
    nextAllowedStatuses("diagnosis", {
      serviceType: "emergency_rescue",
      hasApprovedFinalQuote: false,
    }),
    ["canceled"],
  );

  // Bảo dưỡng: tương tự với `maintenance_work`.
  assert.deepEqual(
    nextAllowedStatuses("diagnosis", {
      serviceType: "periodic_maintenance",
      hasApprovedFinalQuote: true,
    }),
    ["in_progress", "canceled"],
  );

  // `standard`: `diagnosis` là bước chẩn đoán, KHÔNG mở "Bắt đầu sửa".
  assert.deepEqual(
    nextAllowedStatuses("diagnosis", {
      serviceType: "standard",
      hasApprovedFinalQuote: true,
    }),
    ["canceled"],
  );
});

test("transition bị BE chặn không xuất hiện trong danh sách", () => {
  const blocked: Array<[string, string]> = [
    ["diagnosis", "quoted"],
    ["quoted", "awaiting_payment"],
    ["in_progress", "completed"],
  ];
  for (const [from, to] of blocked) {
    assert.equal(
      nextAllowedStatuses(from as never).includes(to as never),
      false,
      `${from} → ${to} phải bị loại khỏi danh sách nút bấm`,
    );
  }
});

test("timeline phản ánh BE status raw, không dùng UI status gộp", () => {
  // 5 BE state đều map về UI `pending` — timeline cũ bị kẹt ở bước 0.
  for (const status of [
    "accepted",
    "en_route",
    "on_site",
    "diagnosis",
    "quoted",
  ]) {
    const idx = timelineIndexForStatus(status);
    assert.ok(idx >= 0, `${status} phải có bước trong timeline`);
  }
  assert.equal(timelineIndexForStatus("accepted"), 0);
  assert.equal(timelineIndexForStatus("quoted"), 4);
  assert.equal(timelineIndexForStatus("in_progress"), 6);
  assert.equal(timelineIndexForStatus("completed"), BE_JOB_TIMELINE.length - 1);
});

test("trạng thái huỷ không có bước nào đạt", () => {
  assert.equal(timelineIndexForStatus("canceled"), -1);
  assert.equal(timelineIndexForStatus("recovery_canceled"), -1);
  assert.equal(timelineIndexForStatus(undefined), -1);
});

test("quotePurposePlanFor chọn đúng purpose theo service_type + stage", () => {
  // Cứu hộ: bước 1 chốt tiền công trước khi đi.
  assert.equal(
    quotePurposePlanFor("emergency_rescue", "accepted").purpose,
    "rescue_labor",
  );
  // Cứu hộ: bước 2 báo giá phụ tùng phát sinh sau khi tới nơi.
  assert.equal(
    quotePurposePlanFor("emergency_rescue", "diagnosis").purpose,
    "rescue_final",
  );
  // Bảo dưỡng: bước 1 tiền công cố định.
  assert.equal(
    quotePurposePlanFor("periodic_maintenance", "accepted").purpose,
    "maintenance_labor",
  );
  // Bảo dưỡng: bước 2 vật tư.
  assert.equal(
    quotePurposePlanFor("periodic_maintenance", "diagnosis").purpose,
    "maintenance_work",
  );
  // Bảo dưỡng: bước 3 phát sinh thêm (cần basis_quote_id).
  assert.equal(
    quotePurposePlanFor("periodic_maintenance", "in_progress").isAddition,
    true,
  );
  // Sửa chữa thường.
  assert.equal(quotePurposePlanFor("standard", "diagnosis").purpose, "standard");
});

test("báo giá tiền công trước khi đi không cho nhập hạng mục", () => {
  const plan = quotePurposePlanFor("emergency_rescue", "accepted");
  assert.equal(plan.requiresLaborPricing, true);
  assert.deepEqual(plan.allowedLineTypes, []);
  assert.equal(plan.allowDiscount, false);
});

test("báo giá phụ tùng phát sinh chỉ cho nhập phụ tùng", () => {
  const plan = quotePurposePlanFor("emergency_rescue", "diagnosis");
  assert.equal(plan.mode, "parts_only");
  assert.deepEqual(plan.allowedLineTypes, ["part"]);
  assert.equal(plan.allowDiscount, false);
});
