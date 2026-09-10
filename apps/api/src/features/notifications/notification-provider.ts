import type { JsonObject } from "@/server/repositories/contracts/idempotency.repository";
import type { PushProvider } from "@/server/repositories/contracts/device-delivery-credential.repository";

export type NotificationProviderInput = {
  provider: PushProvider;
  credential: string;
  title: string;
  body: string;
  data: JsonObject;
  deliveryId: string;
};

export type NotificationProviderOutcome =
  | { kind: "success"; providerMessageId?: string }
  | { kind: "invalid_credential"; errorCode: string }
  | { kind: "permanent_failure"; errorCode: string }
  | { kind: "throttled"; errorCode: string; retryAfter?: Date }
  | { kind: "timeout"; errorCode: string }
  | { kind: "temporary_failure"; errorCode: string };

export interface NotificationProvider {
  send(input: NotificationProviderInput): Promise<NotificationProviderOutcome>;
}

export class NotificationDeliveryError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string) {
    super("Notification delivery could not be completed.");
    this.name = "NotificationDeliveryError";
    this.errorCode = errorCode;
  }
}
