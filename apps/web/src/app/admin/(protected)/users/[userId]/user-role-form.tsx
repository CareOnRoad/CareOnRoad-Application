"use client";

import { useState } from "react";

import {
  CommandForm,
  type CommandFormState
} from "@/components/admin/command-form";

/**
 * The role grant / revoke form for one user.
 *
 * Granting and revoking are DIFFERENT backend scopes, so they must not share
 * an idempotency key. Two separate `CommandForm` instances give each its own
 * key by construction.
 */
export function UserRoleForm({
  userId,
  grantedRoles,
  grantAction,
  revokeAction
}: {
  userId: string;
  grantedRoles: string[];
  grantAction: (
    previous: CommandFormState,
    formData: FormData
  ) => Promise<CommandFormState>;
  revokeAction: (
    previous: CommandFormState,
    formData: FormData
  ) => Promise<CommandFormState>;
}) {
  const [mode, setMode] = useState<"grant" | "revoke">("grant");
  const isGrant = mode === "grant";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <ModeButton active={isGrant} onClick={() => setMode("grant")}>
          Cấp vai trò
        </ModeButton>
        <ModeButton active={!isGrant} onClick={() => setMode("revoke")}>
          Thu hồi vai trò
        </ModeButton>
      </div>

      <CommandForm
        key={isGrant ? "grant" : "revoke"}
        action={isGrant ? grantAction : revokeAction}
        label={isGrant ? "Cấp vai trò" : "Thu hồi vai trò"}
        confirmText={isGrant ? "Cấp vai trò" : "Thu hồi vai trò"}
        description={
          isGrant
            ? "Thêm vai trò cho tài khoản. Vai trò quản trị cho toàn quyền trên hệ thống."
            : "Thu hồi vai trò khỏi tài khoản. Không thể thu hồi vai trò cuối cùng còn lại."
        }
      >
        <input type="hidden" name="userId" value={userId} />
        <label className="flex flex-col gap-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d4d63" }}
          >
            Vai trò
          </span>
          <select
            name="role"
            defaultValue=""
            required
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              border: "1px solid #e5e9ef",
              backgroundColor: "#fff",
              color: "#162130"
            }}
          >
            <option value="" disabled>
              Chọn vai trò…
            </option>
            <option value="rider">Rider</option>
            <option value="mechanic">Kỹ thuật viên</option>
            <option value="admin">Quản trị</option>
          </select>
        </label>
        {grantedRoles.length > 0 ? (
          <p className="text-[11px]" style={{ color: "#6b7a8d" }}>
            Vai trò hiện có: {grantedRoles.join(", ")}
          </p>
        ) : null}
      </CommandForm>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
      style={
        active
          ? { backgroundColor: "#162130", color: "#fff" }
          : { backgroundColor: "#e5e9ef", color: "#162130" }
      }
    >
      {children}
    </button>
  );
}
