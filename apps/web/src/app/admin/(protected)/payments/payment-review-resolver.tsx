"use client";

import { useState } from "react";

import { CommandForm } from "@/components/admin/command-form";

import { resolvePaymentReviewAction } from "./actions";

/**
 * The payment review resolver.
 *
 * This is the ONLY administrative command that touches real money: the
 * backend calls payOS to reconcile the order before confirming it, and then
 * confirms a real order or closes an unpaid one.
 *
 * Therefore the form requires an explicit two-step confirmation:
 *  1. the admin picks the resolution;
 *  2. the admin types the exact confirmation phrase.
 *
 * `close_unpaid` is the destructive branch — it cancels the order and the
 * rider can no longer pay it through that link — so it gets the danger
 * styling and a separate confirmation phrase.
 */
const CONFIRM_PHRASE = {
  confirm_received: "XAC NHAN DA NHAN",
  close_unpaid: "HUY DON CHUA THANH TOAN"
} as const;

type Resolution = keyof typeof CONFIRM_PHRASE;

export function PaymentReviewResolver({
  paymentOrderId
}: {
  paymentOrderId: string;
}) {
  const [action, setAction] = useState<Resolution>("confirm_received");
  const [phrase, setPhrase] = useState("");

  const expected = CONFIRM_PHRASE[action];
  const phraseMatches = phrase.trim().toUpperCase() === expected;

  return (
    <CommandForm
      action={async (previous, formData) =>
        resolvePaymentReviewAction(previous, formData)
      }
      label="Gửi yêu cầu đối soát"
      confirmText={
        action === "confirm_received"
          ? "Xác nhận đã nhận tiền"
          : "Huỷ đơn chưa thanh toán"
      }
      variant={action === "close_unpaid" ? "danger" : "default"}
      disabled={!phraseMatches}
      disabledHint={
        phraseMatches
          ? undefined
          : `Nhập chính xác cụm từ xác nhận: ${expected}`
      }
      description="Backend sẽ gọi payOS để đối soát đơn trước khi xác nhận. Nếu dữ liệu không khớp, lệnh bị từ chối và cần điều tra thủ công."
    >
      <input type="hidden" name="paymentOrderId" value={paymentOrderId} />
      <input type="hidden" name="action" value={action} />

      <div className="flex flex-col gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Cách xử lý
        </span>
        <div className="flex flex-wrap gap-2">
          {(["confirm_received", "close_unpaid"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setAction(option);
                setPhrase("");
              }}
              className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={
                action === option
                  ? { backgroundColor: "#162130", color: "#fff" }
                  : { backgroundColor: "#e5e9ef", color: "#162130" }
              }
            >
              {option === "confirm_received"
                ? "Xác nhận đã nhận tiền"
                : "Huỷ đơn chưa thanh toán"}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Cụm từ xác nhận <span style={{ color: "#b3131d" }}>*</span>
        </span>
        <input
          type="text"
          name="confirmationPhrase"
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          placeholder={expected}
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            border: `1px solid ${phrase.length > 0 && !phraseMatches ? "#fc555f" : "#e5e9ef"}`,
            backgroundColor: "#fff",
            color: "#162130"
          }}
        />
        <span
          className="text-[11px]"
          style={{ color: phrase.length > 0 && !phraseMatches ? "#b3131d" : "#6b7a8d" }}
        >
          {phraseMatches
            ? "Đã xác nhận đúng cụm từ."
            : `Bắt buộc nhập: ${expected}`}
        </span>
      </label>
    </CommandForm>
  );
}
