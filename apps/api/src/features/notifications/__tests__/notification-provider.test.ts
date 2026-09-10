import { describe, expect, it } from "vitest";

import type {
  NotificationProvider,
  NotificationProviderOutcome
} from "../notification-provider";

describe("NotificationProvider contract", () => {
  it("supports typed fake outcomes without provider network calls", async () => {
    const outcome: NotificationProviderOutcome = {
      kind: "temporary_failure",
      errorCode: "FAKE_UNAVAILABLE"
    };
    const fake: NotificationProvider = { send: async () => outcome };
    await expect(
      fake.send({
        provider: "fcm",
        credential: "test-device-token",
        title: "Title",
        body: "Body",
        data: {},
        deliveryId: "delivery-1"
      })
    ).resolves.toEqual(outcome);
  });
});
