"use client";

import { CommandForm, type CommandFormState } from "@/components/admin/command-form";

/**
 * The device revoke form.
 *
 * Revoking a device disables its push credentials. The device id is global
 * in the backend (`/api/v1/admin/devices/[deviceId]/revoke`), so it is sent
 * as a hidden field.
 */
export function UserDeviceForm({
  deviceId,
  deviceLabel,
  enabled,
  action
}: {
  deviceId: string;
  deviceLabel: string;
  enabled: boolean;
  action: (previous: CommandFormState, formData: FormData) => Promise<CommandFormState>;
}) {
  return (
    <CommandForm
      action={action}
      label="Thu hồi thiết bị"
      confirmText="Thu hồi thiết bị"
      variant="danger"
      disabled={!enabled}
      disabledHint={
        enabled
          ? undefined
          : "Thiết bị đã bị thu hồi hoặc không còn hoạt động."
      }
      description={`Thu hồi quyền nhận thông báo của ${deviceLabel}.`}
    >
      <input type="hidden" name="deviceId" value={deviceId} />
    </CommandForm>
  );
}
