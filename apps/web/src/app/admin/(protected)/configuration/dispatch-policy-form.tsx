"use client";

import { useState } from "react";

import { CommandForm } from "@/components/admin/command-form";

import { updateDispatchConfigurationAction } from "./actions";

import type { AdminDispatchPolicyShape } from "@careonroad/api-contract/admin/configuration";

/**
 * The dispatch policy editor.
 *
 * The policy change is LIVE but only applies to NEW dispatch episodes, so
 * the form states that explicitly before the admin touches anything.
 *
 * Every field is held as RAW TEXT and parsed on submit, so a half-typed
 * value never becomes `NaN` in the DOM. The client-side guard mirrors the
 * backend rule: the radius steps must stay strictly ascending, and the total
 * wait must cover at least one offer window. The submit button is disabled
 * while the proposed policy is invalid, so an invalid combination cannot be
 * sent.
 */
export function DispatchPolicyForm({
  current
}: {
  current: AdminDispatchPolicyShape;
}) {
  const [radiusSteps, setRadiusSteps] = useState(
    current["dispatch.radius_steps_km"].join(", ")
  );
  const [offerExpiry, setOfferExpiry] = useState(
    String(current["dispatch.offer_expiry_seconds"])
  );
  const [maxRounds, setMaxRounds] = useState(
    String(current["dispatch.max_rounds"])
  );
  const [totalWait, setTotalWait] = useState(
    String(current["dispatch.total_wait_seconds"])
  );

  const parsedSteps = radiusSteps
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  const offerExpiryNumber = Number(offerExpiry);
  const maxRoundsNumber = Number(maxRounds);
  const totalWaitNumber = Number(totalWait);

  const stepsAscending = parsedSteps.every(
    (value, index) => index === 0 || value > parsedSteps[index - 1]
  );
  const waitCoversOffer =
    Number.isFinite(totalWaitNumber) &&
    Number.isFinite(offerExpiryNumber) &&
    totalWaitNumber >= offerExpiryNumber;

  const valid =
    parsedSteps.length > 0 &&
    parsedSteps.length <= 8 &&
    parsedSteps.every((value) => value >= 1 && value <= 100) &&
    stepsAscending &&
    Number.isFinite(offerExpiryNumber) &&
    offerExpiryNumber >= 30 &&
    offerExpiryNumber <= 300 &&
    Number.isFinite(maxRoundsNumber) &&
    maxRoundsNumber >= 1 &&
    maxRoundsNumber <= 8 &&
    Number.isFinite(totalWaitNumber) &&
    totalWaitNumber >= 60 &&
    totalWaitNumber <= 1800 &&
    waitCoversOffer;

  return (
    <CommandForm
      action={async (previous, formData) =>
        updateDispatchConfigurationAction(previous, formData, current)
      }
      label="Lưu cấu hình"
      confirmText="Cập nhật chính sách điều phối"
      disabled={!valid}
      disabledHint={
        valid
          ? undefined
          : "Cấu hình chưa hợp lệ: các bán kính phải tăng dần và tổng thời gian chờ phải đủ cho một cửa sổ đề nghị."
      }
      description="Thay đổi có hiệu lực với các chu kỳ điều phối MỚI. Các chu kỳ đang chạy giữ nguyên chính sách cũ."
    >
      <div className="flex flex-col gap-3">
        <TextField
          label="Các bán kính điều phối (km, cách nhau bằng dấu phẩy)"
          name="radius_steps_km"
          value={radiusSteps}
          onChange={setRadiusSteps}
          hint={`Hiện tại: ${current["dispatch.radius_steps_km"].join(", ")} km — phải tăng dần, tối đa 8 bước.`}
          invalid={!stepsAscending || parsedSteps.length === 0}
        />

        <TextField
          label="Thời hạn đề nghị (giây)"
          name="offer_expiry_seconds"
          value={offerExpiry}
          onChange={setOfferExpiry}
          hint="Từ 30 đến 300 giây."
          invalid={!Number.isFinite(offerExpiryNumber)}
        />

        <TextField
          label="Số vòng điều phối tối đa"
          name="max_rounds"
          value={maxRounds}
          onChange={setMaxRounds}
          hint="Từ 1 đến 8 vòng."
          invalid={!Number.isFinite(maxRoundsNumber)}
        />

        <TextField
          label="Tổng thời gian chờ (giây)"
          name="total_wait_seconds"
          value={totalWait}
          onChange={setTotalWait}
          hint={`Từ 60 đến 1800 giây, và phải đủ bao phủ thời hạn đề nghị (${offerExpiry} giây).`}
          invalid={!waitCoversOffer}
        />
      </div>
    </CommandForm>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  hint,
  invalid
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
  invalid?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "#3d4d63" }}
      >
        {label}
      </span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          border: `1px solid ${invalid ? "#fc555f" : "#e5e9ef"}`,
          backgroundColor: "#fff",
          color: "#162130"
        }}
      />
      <span className="text-[11px]" style={{ color: invalid ? "#b3131d" : "#6b7a8d" }}>
        {hint}
      </span>
    </label>
  );
}
