import { describe, expect, it } from "vitest";

import { readLiveTrackingConfig } from "../live-tracking.schemas";

describe("live tracking configuration", () => {
  it("defaults disabled without inventing a retention period", () => {
    expect(readLiveTrackingConfig({})).toEqual({
      enabled: false,
      maxLocationAgeSeconds: 30,
      maxFutureSkewSeconds: 5,
      minUpdateIntervalSeconds: 5,
      maxAccuracyMeters: 100
    });
  });

  it("requires explicit bounded retention before enabling", () => {
    expect(() => readLiveTrackingConfig({ LIVE_TRACKING_ENABLED: "true" }))
      .toThrow("LIVE_TRACKING_RETENTION_MINUTES");
    expect(() => readLiveTrackingConfig({
      LIVE_TRACKING_ENABLED: "true",
      LIVE_TRACKING_RETENTION_MINUTES: "1441"
    })).toThrow("1 to 1440");
    expect(readLiveTrackingConfig({
      LIVE_TRACKING_ENABLED: "true",
      LIVE_TRACKING_RETENTION_MINUTES: "15"
    })).toMatchObject({ enabled: true, retentionMinutes: 15 });
  });
});
