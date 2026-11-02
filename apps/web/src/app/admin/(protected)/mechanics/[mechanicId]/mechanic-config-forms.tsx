"use client";

import { CommandForm } from "@/components/admin/command-form";

import {
  forceMechanicUnavailableAction,
  updateMechanicServiceRadiusAction,
  updateMechanicSkillsAction
} from "../actions";

/**
 * The service-types replacement form.
 *
 * The backend REPLACES the whole set, so the form sends every checked value.
 * The list is the shared `serviceTypes` enum — the same vocabulary the
 * dispatch policy uses, so a mechanic cannot be given a skill the dispatcher
 * does not know about.
 */
const SERVICE_TYPES = [
  { value: "emergency_rescue", label: "Cứu hộ khẩn cấp" },
  { value: "periodic_maintenance", label: "Bảo dưỡng định kỳ" },
  { value: "standard", label: "Tiêu chuẩn" }
] as const;

export function MechanicSkillsForm({
  mechanicId,
  currentServiceTypes
}: {
  mechanicId: string;
  currentServiceTypes: readonly string[];
}) {
  return (
    <CommandForm
      action={updateMechanicSkillsAction}
      label="Lưu kỹ năng"
      confirmText="Cập nhật kỹ năng"
      description="Thay thế toàn bộ danh sách dịch vụ của kỹ thuật viên."
    >
      <input type="hidden" name="mechanicId" value={mechanicId} />
      <fieldset className="flex flex-wrap gap-3">
        <legend className="sr-only">Loại dịch vụ</legend>
        {SERVICE_TYPES.map((type) => (
          <label
            key={type.value}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ border: "1px solid #e5e9ef", color: "#162130" }}
          >
            <input
              type="checkbox"
              name="service_types"
              value={type.value}
              defaultChecked={currentServiceTypes.includes(type.value)}
            />
            {type.label}
          </label>
        ))}
      </fieldset>
    </CommandForm>
  );
}

/**
 * The service radius form.
 *
 * The backend bounds the radius to `(0, 100]` km. The input mirrors that
 * bound so an out-of-range value cannot be submitted in the first place.
 */
export function MechanicRadiusForm({
  mechanicId,
  currentRadiusKm
}: {
  mechanicId: string;
  currentRadiusKm: number;
}) {
  return (
    <CommandForm
      action={updateMechanicServiceRadiusAction}
      label="Lưu bán kính"
      confirmText="Cập nhật bán kính"
      description="Bán kính phục vụ tính bằng km, tối đa 100 km."
    >
      <input type="hidden" name="mechanicId" value={mechanicId} />
      <label className="flex flex-col gap-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Bán kính phục vụ (km)
        </span>
        <input
          type="number"
          name="service_radius_km"
          min={0.1}
          max={100}
          step={0.5}
          defaultValue={currentRadiusKm}
          required
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            border: "1px solid #e5e9ef",
            backgroundColor: "#fff",
            color: "#162130"
          }}
        />
      </label>
    </CommandForm>
  );
}

/**
 * The "force unavailable" form.
 *
 * There is deliberately NO matching "restore availability" command: the
 * backend exposes none, and availability is owned by the mechanic through
 * `/api/v1/mechanics/me/availability`. Inventing a restore button would
 * create a dead end.
 */
export function MechanicForceUnavailableForm({
  mechanicId,
  isAvailable
}: {
  mechanicId: string;
  isAvailable: boolean;
}) {
  return (
    <CommandForm
      action={forceMechanicUnavailableAction}
      label="Buộc ngừng nhận việc"
      confirmText="Buộc ngừng nhận việc"
      variant="danger"
      disabled={!isAvailable}
      disabledHint={
        isAvailable
          ? undefined
          : "Kỹ thuật viên đã không nhận việc."
      }
      description="Đánh dấu kỹ thuật viên không sẵn sàng. Kỹ thuật viên tự bật lại trong ứng dụng."
    >
      <input type="hidden" name="mechanicId" value={mechanicId} />
    </CommandForm>
  );
}
