import { z } from "zod";

import {
  DisabledRouteEtaProvider,
  RouteEtaProviderError,
  type RouteEtaProvider
} from "./route-eta.provider";
import type { RouteEtaProviderInput, RouteEtaProviderResult } from "./route-eta.types";

const responseSchema = z.object({
  routes: z.array(z.object({
    distanceMeters: z.number().finite().positive(),
    duration: z.string().regex(/^\d+(?:\.\d+)?s$/)
  })).min(1)
});

export type GoogleRoutesProviderOptions = {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
};

export class GoogleRoutesProvider implements RouteEtaProvider {
  readonly source = "google_routes" as const;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: GoogleRoutesProviderOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async compute(input: RouteEtaProviderInput): Promise<RouteEtaProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await this.fetchFn(
        `${this.options.baseUrl.replace(/\/$/, "")}/directions/v2:computeRoutes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.options.apiKey,
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration"
          },
          body: JSON.stringify({
            origin: { location: { latLng: input.origin } },
            destination: { location: { latLng: input.destination } },
            travelMode: "TWO_WHEELER",
            routingPreference: "TRAFFIC_UNAWARE",
            computeAlternativeRoutes: false
          }),
          signal: controller.signal
        }
      );
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new RouteEtaProviderError("provider_auth");
        }
        if (response.status === 429) {
          throw new RouteEtaProviderError("provider_quota");
        }
        throw new RouteEtaProviderError("provider_error");
      }
      const raw: unknown = await response.json().catch(() => undefined);
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success) {
        if (raw && typeof raw === "object" && "routes" in raw && Array.isArray(raw.routes) && raw.routes.length === 0) {
          throw new RouteEtaProviderError("no_route");
        }
        throw new RouteEtaProviderError("provider_invalid_response");
      }
      const route = parsed.data.routes[0]!;
      return {
        distanceMeters: Math.round(route.distanceMeters),
        durationSeconds: Math.ceil(Number(route.duration.slice(0, -1)))
      };
    } catch (error) {
      if (error instanceof RouteEtaProviderError) {
        throw error;
      }
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw new RouteEtaProviderError("provider_timeout");
      }
      throw new RouteEtaProviderError("provider_error");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createRouteEtaProviderFromEnv(
  environment: NodeJS.ProcessEnv = process.env
): RouteEtaProvider {
  const provider = environment.ROUTE_ETA_PROVIDER?.trim().toLowerCase() ?? "disabled";
  const apiKey = environment.GOOGLE_ROUTES_API_KEY?.trim();
  if (provider !== "google_routes" || !apiKey) {
    return new DisabledRouteEtaProvider();
  }
  return new GoogleRoutesProvider({
    apiKey,
    baseUrl: environment.GOOGLE_ROUTES_BASE_URL?.trim() || "https://routes.googleapis.com",
    timeoutMs: boundedInteger(environment.ROUTE_ETA_TIMEOUT_MS, 3000, 1000, 10_000)
  });
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
