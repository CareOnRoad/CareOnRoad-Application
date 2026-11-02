"use client";

import { useState } from "react";

import { CommandForm } from "@/components/admin/command-form";

import { resolveQuoteDisputeAction } from "./actions";

/**
 * The quote dispute resolver.
 *
 * The dispute is resolved against the LATEST quote of the request — the
 * backend refuses anything else (`quote_not_current`). Three resolutions
 * are possible:
 *
 *  - `uphold_latest_quote`: giữ báo giá hiện tại (báo giá đã được duyệt hoặc
 *    đang chờ). Bản ghi giám sát vẫn được ghi lại.
 *  - `void_pending_quote`: vô hiệu báo giá đang chờ — chỉ hợp lệ khi báo giá
 *    chưa có khoản thanh toán chưa xử lý và không bị gắn với thoả thuận
 *    lao động.
 *  - `request_revision`: gửi báo giá trở lại kỹ thuật viên để lập phiên bản
 *    sửa đổi.
 *
 * The choice is a two-step confirmation: the admin picks a resolution, then
 * the command is sent with the reason.
 */
const RESOLUTIONS = [
  {
    value: "uphold_latest_quote",
    label: "Giữ báo giá hiện tại",
    description: "Ghi nhận kết luận giám sát, giữ nguyên báo giá mới nhất."
  },
  {
    value: "void_pending_quote",
    label: "Vô hiệu báo giá đang chờ",
    description:
      "Vô hiệu báo giá mới nhất và đưa phân công về trạng thái chờ chẩn đoán."
  },
  {
    value: "request_revision",
    label: "Yêu cầu sửa báo giá",
    description: "Gửi báo giá trở lại kỹ thuật viên để lập phiên bản sửa đổi."
  }
] as const;

export function QuoteDisputeForm({ requestId }: { requestId: string }) {
  const [resolution, setResolution] = useState<string>(RESOLUTIONS[0].value);
  const selected = RESOLUTIONS.find((item) => item.value === resolution);

  return (
    <CommandForm
      action={resolveQuoteDisputeAction}
      label="Xử lý tranh chấp báo giá"
      confirmText="Gửi kết luận giám sát"
      variant={resolution === "void_pending_quote" ? "danger" : "default"}
      description={selected?.description}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="resolution" value={resolution} />

      <div className="flex flex-col gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Cách xử lý
        </span>
        <div className="flex flex-wrap gap-2">
          {RESOLUTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setResolution(item.value)}
              className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={
                resolution === item.value
                  ? { backgroundColor: "#162130", color: "#fff" }
                  : { backgroundColor: "#e5e9ef", color: "#162130" }
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </CommandForm>
  );
}
