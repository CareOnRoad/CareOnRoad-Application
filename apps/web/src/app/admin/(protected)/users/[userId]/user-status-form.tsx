"use client";

import { CommandForm, type CommandFormState } from "@/components/admin/command-form";

/**
 * A single status command for one user (suspend / reactivate / archive).
 *
 * Each form gets its own idempotency key by construction: the backend scopes
 * idempotency by `(actor, scope, key)`, so two forms on the same page must
 * not share a key.
 */
export function UserStatusForm({
  userId,
  action,
  label,
  description,
  variant = "default",
  disabled,
  disabledHint
}: {
  userId: string;
  action: (previous: CommandFormState, formData: FormData) => Promise<CommandFormState>;
  label: string;
  description?: string;
  variant?: "default" | "danger";
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <CommandForm
      action={action}
      label={label}
      confirmText={label}
      description={description}
      variant={variant}
      disabled={disabled}
      disabledHint={disabledHint}
    >
      <input type="hidden" name="userId" value={userId} />
    </CommandForm>
  );
}
