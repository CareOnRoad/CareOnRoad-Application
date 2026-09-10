import type {
  RouteEtaProviderFailureReason,
  RouteEtaProviderInput,
  RouteEtaProviderResult
} from "./route-eta.types";

export interface RouteEtaProvider {
  readonly source: "google_routes" | "none";
  compute(input: RouteEtaProviderInput): Promise<RouteEtaProviderResult>;
}

export class RouteEtaProviderError extends Error {
  constructor(public readonly reason: RouteEtaProviderFailureReason) {
    super(`Route ETA provider unavailable: ${reason}`);
    this.name = "RouteEtaProviderError";
  }
}

export class DisabledRouteEtaProvider implements RouteEtaProvider {
  readonly source = "none" as const;

  async compute(): Promise<never> {
    throw new RouteEtaProviderError("provider_disabled");
  }
}

export function normalizeProviderError(error: unknown): RouteEtaProviderError {
  if (error instanceof RouteEtaProviderError) {
    return error;
  }
  return new RouteEtaProviderError("provider_error");
}
