"use client";

import { CommandForm } from "@/components/admin/command-form";

import {
  addServiceRequestNoteAction,
  cancelServiceRequestAction,
  cancelServiceRequestDispatchAction,
  manuallyEscalateServiceRequestAction,
  manualAssignServiceRequestAction,
  repairServiceRequestCancellationAction,
  repairServiceRequestReservationAction,
  retryServiceRequestDispatchAction
} from "../actions";

/**
 * The request lifecycle commands.
 *
 * The backend owns the request state machine, so the page renders a command
 * only when the backend reported it as legal. This form set mirrors the
 * generic "reason only" command shape.
 */
export function RequestCommandForms({
  requestId,
  canCancel,
  canEscalate,
  canRetryDispatch,
  canCancelDispatch,
  canManualAssign
}: {
  requestId: string;
  canCancel: boolean;
  canEscalate: boolean;
  canRetryDispatch: boolean;
  canCancelDispatch: boolean;
  canManualAssign: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CommandForm
        action={cancelServiceRequestAction}
        label="Huỷ yêu cầu"
        confirmText="Huỷ yêu cầu"
        variant="danger"
        disabled={!canCancel}
        disabledHint={canCancel ? undefined : "Yêu cầu không ở trạng thái có thể huỷ."}
        description="Huỷ yêu cầu và giải phóng kỹ thuật viên đã được phân công."
      >
        <input type="hidden" name="requestId" value={requestId} />
      </CommandForm>

      <CommandForm
        action={manuallyEscalateServiceRequestAction}
        label="Chuyển cấp can thiệp"
        confirmText="Chuyển cấp can thiệp"
        variant="danger"
        disabled={!canEscalate}
        disabledHint={
          canEscalate ? undefined : "Yêu cầu đã ở trạng thái cần can thiệp."
        }
        description="Đánh dấu yêu cầu cần quản trị viên trực tiếp xử lý."
      >
        <input type="hidden" name="requestId" value={requestId} />
      </CommandForm>

      <CommandForm
        action={retryServiceRequestDispatchAction}
        label="Thử điều phối lại"
        confirmText="Thử điều phối lại"
        disabled={!canRetryDispatch}
        disabledHint={
          canRetryDispatch
            ? undefined
            : "Đã hết lượt thử lại cho chu kỳ điều phối này."
        }
        description="Mở vòng điều phối mới cho yêu cầu. Bị giới hạn bởi ngân sách thử lại của backend."
      >
        <input type="hidden" name="requestId" value={requestId} />
      </CommandForm>

      <CommandForm
        action={cancelServiceRequestDispatchAction}
        label="Huỷ điều phối"
        confirmText="Huỷ điều phối"
        variant="danger"
        disabled={!canCancelDispatch}
        disabledHint={
          canCancelDispatch ? undefined : "Không có vòng điều phối nào đang hoạt động."
        }
        description="Kết thúc vòng điều phối hiện tại và rút lại các đề nghị đang chờ."
      >
        <input type="hidden" name="requestId" value={requestId} />
      </CommandForm>

      <CommandForm
        action={manualAssignServiceRequestAction}
        label="Phân công thủ công"
        confirmText="Phân công thủ công"
        disabled={!canManualAssign}
        disabledHint={
          canManualAssign
            ? undefined
            : "Backend không cho phép phân công thủ công ở trạng thái hiện tại."
        }
        description="Bypass xếp hạng điều phối và gán trực tiếp một kỹ thuật viên. Lịch sử phân công cũ được giữ lại."
      >
        <input type="hidden" name="requestId" value={requestId} />
        <label className="flex flex-col gap-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            Mã kỹ thuật viên
          </span>
          <input
            type="text"
            name="mechanic_id"
            required
            placeholder="UUID kỹ thuật viên"
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              border: "1px solid #e5e9ef",
              backgroundColor: "#fff",
              color: "#162130"
            }}
          />
        </label>
      </CommandForm>
    </div>
  );
}

/**
 * The internal note form.
 *
 * Notes are APPEND-ONLY: they are written to a dedicated table and to the
 * audit log. Nothing is ever overwritten, so there is no edit/delete here.
 */
export function RequestNoteForm({ requestId }: { requestId: string }) {
  return (
    <CommandForm
      action={addServiceRequestNoteAction}
      label="Ghi chú nội bộ"
      confirmText="Thêm ghi chú"
      description="Ghi chú nội bộ chỉ hiển thị với quản trị viên và được ghi vào nhật ký kiểm toán."
    >
      <input type="hidden" name="requestId" value={requestId} />
      <label className="flex flex-col gap-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Nội dung ghi chú
        </span>
        <textarea
          name="note"
          rows={4}
          required
          maxLength={2000}
          placeholder="Ghi chú nội bộ về yêu cầu này…"
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            border: "1px solid #e5e9ef",
            backgroundColor: "#fff",
            color: "#162130",
            resize: "vertical"
          }}
        />
      </label>
    </CommandForm>
  );
}

/**
 * The cancellation-repair form.
 *
 * The backend treats the repair as a DRY RUN unless `dry_run` is explicitly
 * `false`. The checkbox therefore defaults to "dry run" (safe) and the admin
 * must actively opt into the real repair — the confirmation is the second
 * step of a two-step confirmation.
 */
export function RequestCancellationRepairForm({
  requestId,
  assignmentId
}: {
  requestId: string;
  assignmentId?: string;
}) {
  return (
    <CommandForm
      action={repairServiceRequestCancellationAction}
      label="Sửa trạng thái huỷ"
      confirmText="Chạy sửa trạng thái"
      disabled={!assignmentId}
      disabledHint={
        assignmentId ? undefined : "Yêu cầu chưa có phân công để sửa."
      }
      description="Đồng bộ lại trạng thái huỷ giữa yêu cầu và phân công. Mặc định chỉ chạy thử."
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="assignment_id"
        defaultValue={assignmentId ?? ""}
      />
      <label className="flex items-center gap-2 text-sm" style={{ color: "#162130" }}>
        <input type="checkbox" name="dry_run" value="true" defaultChecked />
        Chỉ chạy thử (không ghi thay đổi vào cơ sở dữ liệu)
      </label>
      <p className="text-[11px]" style={{ color: "#b3131d" }}>
        Bỏ chọn &ldquo;chạy thử&rdquo; chỉ khi bạn đã xác nhận muốn sửa dữ liệu thật.
      </p>
    </CommandForm>
  );
}

/** The reservation-repair form — the cancellation repair plus a duration. */
export function RequestReservationRepairForm({
  requestId,
  assignmentId
}: {
  requestId: string;
  assignmentId?: string;
}) {
  return (
    <CommandForm
      action={repairServiceRequestReservationAction}
      label="Sửa chỗ đặt lịch"
      confirmText="Chạy sửa chỗ đặt lịch"
      disabled={!assignmentId}
      disabledHint={
        assignmentId ? undefined : "Yêu cầu chưa có phân công để sửa."
      }
      description="Tạo lại khung thời gian đặt lịch cho phân công. Mặc định chỉ chạy thử."
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="assignment_id"
        defaultValue={assignmentId ?? ""}
      />
      <label className="flex flex-col gap-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Thời lượng ước tính (phút)
        </span>
        <input
          type="number"
          name="estimated_duration_minutes"
          min={15}
          max={480}
          step={5}
          defaultValue={60}
          required
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            border: "1px solid #e5e9ef",
            backgroundColor: "#fff",
            color: "#162130"
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-sm" style={{ color: "#162130" }}>
        <input type="checkbox" name="dry_run" value="true" defaultChecked />
        Chỉ chạy thử (không ghi thay đổi vào cơ sở dữ liệu)
      </label>
    </CommandForm>
  );
}
