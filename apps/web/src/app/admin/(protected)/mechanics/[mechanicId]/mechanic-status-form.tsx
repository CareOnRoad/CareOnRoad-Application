"use client";

import { CommandForm } from "@/components/admin/command-form";

import { changeMechanicStatusAction } from "../actions";

/**
 * A mechanic status command (approve / reject / suspend / ban / reactivate).
 *
 * The action name travels in a hidden field so a single Server Action can
 * serve all five states, while each form still owns its own idempotency key.
 */
export function MechanicStatusForm({
  mechanicId,
  action,
  label,
  description,
  variant = "default",
  disabled,
  disabledHint
}: {
  mechanicId: string;
  action: string;
  label: string;
  description?: string;
  variant?: "default" | "danger";
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <CommandForm
      action={changeMechanicStatusAction}
      label={label}
      confirmText={label}
      description={description}
      variant={variant}
      disabled={disabled}
      disabledHint={disabledHint}
    >
      <input type="hidden" name="mechanicId" value={mechanicId} />
      <input type="hidden" name="action" value={action} />
    </CommandForm>
  );
}
