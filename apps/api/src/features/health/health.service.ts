export type HealthCheckName = "database" | "workers" | "notifications" | "media" | "payments";
export type HealthCheckStatus = "up" | "configured" | "disabled" | "down" | "invalid";
export type HealthCheck = { name: HealthCheckName; status: HealthCheckStatus };
export type HealthProbe = { name: HealthCheckName; run(): Promise<void> };

export type ReadinessSnapshot = {
  status: "ready" | "not_ready";
  checks: HealthCheck[];
};

export class HealthService {
  constructor(
    private readonly options: {
      probes?: HealthProbe[];
      configurationChecks?: HealthCheck[];
      timeoutMs?: number;
    } = {}
  ) {}

  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  async readiness(): Promise<ReadinessSnapshot> {
    const timeoutMs = clampTimeout(this.options.timeoutMs ?? 1500);
    const probeChecks = await Promise.all(
      (this.options.probes ?? []).map(async (probe): Promise<HealthCheck> => {
        try {
          await withTimeout(probe.run(), timeoutMs);
          return { name: probe.name, status: "up" };
        } catch {
          return { name: probe.name, status: "down" };
        }
      })
    );
    const checks = [...probeChecks, ...(this.options.configurationChecks ?? [])]
      .sort((left, right) => left.name.localeCompare(right.name));
    return {
      status: checks.every((check) => !["down", "invalid"].includes(check.status))
        ? "ready"
        : "not_ready",
      checks
    };
  }
}

export function clampTimeout(value: number): number {
  if (!Number.isFinite(value)) return 1500;
  return Math.min(5000, Math.max(100, Math.trunc(value)));
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("HEALTH_PROBE_TIMEOUT")), timeoutMs);
    work.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error) => { clearTimeout(timeout); reject(error); }
    );
  });
}
