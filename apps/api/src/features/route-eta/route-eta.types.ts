import type { GeoPoint } from "@/server/repositories/contracts/mechanic.repository";

export type RouteEtaProviderFailureReason =
  | "provider_disabled"
  | "provider_timeout"
  | "provider_quota"
  | "provider_auth"
  | "provider_error"
  | "provider_invalid_response"
  | "no_route";

export type RouteEtaUnavailableReason =
  | RouteEtaProviderFailureReason
  | "origin_missing"
  | "origin_stale"
  | "destination_missing";

export type RouteEtaProviderInput = {
  origin: GeoPoint;
  destination: GeoPoint;
};

export type RouteEtaProviderResult = {
  distanceMeters: number;
  durationSeconds: number;
};

export type RouteEtaResponse = {
  assignment_id: string;
  status: "available" | "fallback" | "unavailable";
  source: "google_routes" | "straight_line_fallback" | "none";
  distance_meters?: number;
  duration_seconds?: number;
  calculated_at: string;
  expires_at: string;
  unavailable_reason?: RouteEtaUnavailableReason;
  advisory: {
    code: "TWO_WHEELER_ROUTE_ESTIMATE";
    message: string;
  };
};
