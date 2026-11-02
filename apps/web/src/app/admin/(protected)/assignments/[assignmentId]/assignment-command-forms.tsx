"use client";

import { useState } from "react";

import { CommandForm } from "@/components/admin/command-form";

import {
  addAssignmentNoteAction,
  cancelAssignmentAction,
  reassignAssignmentAction,
  resolveStuckAssignmentAction
} from "../actions";

/**
 * The assignment command forms.
 *
 * Which buttons appear is decided by the BACKEND's `next_action_codes`
 * (passed in as a prop), never by re-deriving the rules on the client.
 *
 * Each command is a separate form, so each one owns its own idempotency key:
 * the backend scopes idempotency by `(actor, scope, key)`, and a shared key
 * under two scopes would run BOTH commands.
 */
export function AssignmentCommandForms({
  assignmentId,
  requestId,
  nextActionCodes
}: {
  assignmentId: string;
  requestId: string;
  nextActionCodes: string[];
}) {
  const allowed = new Set(nextActionCodes);
  const [stuckMode, setStuckMode] = useState<"investigate" | "reassign" | "cancel">(
    "investigate"
  );

  return (
    <div className="flex flex-col gap-6">
      <CommandForm
        action={addAssignmentNoteAction}
        label="Thêm ghi chú nội bộ"
        confirmText="Thêm ghi chú"
        description="Ghi chú nội bộ chỉ hiển thị với quản trị viên và được ghi vào nhật ký kiểm toán."
      >
        <input type="hidden" name="assignmentId" value={assignmentId} />
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
            rows={3}
            required
            maxLength={2000}
            placeholder="Ghi chú nội bộ về phân công này…"
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

      <CommandForm
        action={cancelAssignmentAction}
        label="Huỷ phân công"
        confirmText="Huỷ phân công"
        variant="danger"
        disabled={!allowed.has("cancel")}
        disabledHint={
          allowed.has("cancel")
            ? undefined
            : "Phân công đã cam kết công việc hoặc không còn huỷ được."
        }
        description="Huỷ phân công và chuyển yêu cầu về trạng thái đã huỷ."
      >
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="requestId" value={requestId} />
      </CommandForm>

      <CommandForm
        action={reassignAssignmentAction}
        label="Đổi kỹ thuật viên"
        confirmText="Đổi kỹ thuật viên"
        disabled={!allowed.has("reassign")}
        disabledHint={
          allowed.has("reassign")
            ? undefined
            : "Chỉ đổi được khi phân công đang ở trạng thái đã nhận hoặc đang đến."
        }
        description="Phân công cũ được giữ lại lịch sử ở trạng thái đã huỷ khôi phục."
      >
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="requestId" value={requestId} />
        <label className="flex flex-col gap-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            Mã kỹ thuật viên mới
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

      <div className="flex flex-col gap-3">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "#3d4d63" }}
        >
          Xử lý phân công bị kẹt
        </span>
        <div className="flex gap-2">
          {(["investigate", "reassign", "cancel"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setStuckMode(mode)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={
                stuckMode === mode
                  ? { backgroundColor: "#162130", color: "#fff" }
                  : { backgroundColor: "#e5e9ef", color: "#162130" }
              }
            >
              {mode === "investigate"
                ? "Điều tra"
                : mode === "reassign"
                  ? "Đổi kỹ thuật viên"
                  : "Huỷ"}
            </button>
          ))}
        </div>

        <CommandForm
          key={stuckMode}
          action={resolveStuckAssignmentAction}
          label="Xử lý phân công bị kẹt"
          confirmText="Thực hiện"
          variant={stuckMode === "cancel" ? "danger" : "default"}
          description={
            stuckMode === "investigate"
              ? "Ghi lại kết quả điều tra. Bắt buộc có ghi chú."
              : stuckMode === "reassign"
                ? "Đổi sang kỹ thuật viên khác. Cần mã kỹ thuật viên hợp lệ."
                : "Huỷ phân công bị kẹt."
          }
        >
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="action" value={stuckMode} />

          {stuckMode === "reassign" ? (
            <label className="flex flex-col gap-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#3d4d63" }}
              >
                Mã kỹ thuật viên mới
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
          ) : null}

          {stuckMode === "investigate" ? (
            <label className="flex flex-col gap-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#3d4d63" }}
              >
                Kết quả điều tra <span style={{ color: "#b3131d" }}>*</span>
              </span>
              <textarea
                name="note"
                rows={3}
                required
                maxLength={2000}
                placeholder="Điều tra đã kiểm tra gì, kết luận ra gì…"
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  border: "1px solid #e5e9ef",
                  backgroundColor: "#fff",
                  color: "#162130",
                  resize: "vertical"
                }}
              />
            </label>
          ) : null}
        </CommandForm>
      </div>
    </div>
  );
}
