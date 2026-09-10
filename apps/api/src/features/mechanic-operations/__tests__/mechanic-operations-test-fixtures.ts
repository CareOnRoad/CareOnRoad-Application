import { AuthError, type VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

export const MECHANIC_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_MECHANIC_ID = "22222222-2222-4222-8222-222222222222";
export const RIDER_ID = "33333333-3333-4333-8333-333333333333";
export const OTHER_RIDER_ID = "44444444-4444-4444-8444-444444444444";
export const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
export const COMPLETED_REQUEST_ID = "66666666-6666-4666-8666-666666666666";
export const CANCELED_REQUEST_ID = "77777777-7777-4777-8777-777777777777";
export const OTHER_REQUEST_ID = "88888888-8888-4888-8888-888888888888";
export const ASSIGNMENT_ID = "99999999-9999-4999-8999-999999999999";
export const COMPLETED_ASSIGNMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const CANCELED_ASSIGNMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const OTHER_ASSIGNMENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const NOW = new Date("2026-07-07T08:00:00.000Z");

const motorcycleId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const otherMotorcycleId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

export function createMechanicOperationsUnitOfWork(options: { staleLocation?: boolean } = {}) {
  return new InMemoryUnitOfWork({
    users: [
      user(MECHANIC_ID),
      user(OTHER_MECHANIC_ID),
      user(RIDER_ID),
      user(OTHER_RIDER_ID)
    ],
    userRoles: [
      { userId: MECHANIC_ID, role: "mechanic" },
      { userId: OTHER_MECHANIC_ID, role: "mechanic" },
      { userId: RIDER_ID, role: "rider" },
      { userId: OTHER_RIDER_ID, role: "rider" }
    ],
    motorcycles: [
      {
        id: motorcycleId,
        riderId: RIDER_ID,
        brandText: "Honda",
        modelText: "Wave",
        createdAt: NOW,
        updatedAt: NOW
      },
      {
        id: otherMotorcycleId,
        riderId: OTHER_RIDER_ID,
        brandText: "Yamaha",
        modelText: "Sirius",
        createdAt: NOW,
        updatedAt: NOW
      }
    ],
    mechanicProfiles: [
      {
        userId: MECHANIC_ID,
        profileStatus: "active",
        isAvailable: true,
        serviceRadiusKm: 15,
        latestLocation: { latitude: 10.762622, longitude: 106.660172 },
        locationUpdatedAt: options.staleLocation
          ? new Date(NOW.getTime() - 301_000)
          : NOW,
        availabilityUpdatedAt: NOW,
        ratingAvg: 4.7,
        ratingCount: 19,
        serviceTypes: ["mobile_repair"],
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: NOW
      },
      {
        userId: OTHER_MECHANIC_ID,
        profileStatus: "active",
        isAvailable: true,
        serviceRadiusKm: 15,
        latestLocation: { latitude: 10.762622, longitude: 106.660172 },
        locationUpdatedAt: NOW,
        availabilityUpdatedAt: NOW,
        ratingAvg: 5,
        ratingCount: 2,
        serviceTypes: ["mobile_repair"],
        createdAt: NOW,
        updatedAt: NOW
      }
    ],
    serviceRequests: [
      serviceRequest(REQUEST_ID, "COR-MOB-20260707-1", RIDER_ID, motorcycleId, "assigned", NOW),
      serviceRequest(
        COMPLETED_REQUEST_ID,
        "COR-MOB-20260705-1",
        RIDER_ID,
        motorcycleId,
        "completed",
        new Date("2026-07-05T07:00:00.000Z")
      ),
      serviceRequest(
        CANCELED_REQUEST_ID,
        "COR-MOB-20260704-1",
        RIDER_ID,
        motorcycleId,
        "canceled",
        new Date("2026-07-04T07:00:00.000Z")
      ),
      serviceRequest(
        OTHER_REQUEST_ID,
        "COR-MOB-20260707-2",
        OTHER_RIDER_ID,
        otherMotorcycleId,
        "assigned",
        NOW
      )
    ],
    dispatchRounds: [
      {
        id: "dddddddd-0000-4000-8000-000000000001",
        requestId: REQUEST_ID,
        roundNumber: 1,
        radiusMeters: 2000,
        status: "active",
        startedAt: NOW,
        expiresAt: new Date(NOW.getTime() + 60_000)
      }
    ],
    dispatchCandidates: [
      candidate("dddddddd-0000-4000-8000-000000000011", REQUEST_ID, MECHANIC_ID, "offered", {
        offeredAt: new Date(NOW.getTime() - 30_000),
        expiresAt: new Date(NOW.getTime() + 60_000)
      }),
      candidate(
        "dddddddd-0000-4000-8000-000000000012",
        COMPLETED_REQUEST_ID,
        MECHANIC_ID,
        "accepted",
        {
          offeredAt: new Date("2026-07-05T07:00:00.000Z"),
          respondedAt: new Date("2026-07-05T07:05:00.000Z")
        }
      ),
      candidate(
        "dddddddd-0000-4000-8000-000000000013",
        CANCELED_REQUEST_ID,
        MECHANIC_ID,
        "rejected",
        {
          offeredAt: new Date("2026-07-04T07:00:00.000Z"),
          respondedAt: new Date("2026-07-04T07:02:00.000Z")
        }
      ),
      candidate(
        "dddddddd-0000-4000-8000-000000000014",
        OTHER_REQUEST_ID,
        OTHER_MECHANIC_ID,
        "offered",
        {
          offeredAt: new Date(NOW.getTime() - 30_000),
          expiresAt: new Date(NOW.getTime() + 60_000)
        }
      )
    ],
    assignments: [
      assignment(ASSIGNMENT_ID, REQUEST_ID, MECHANIC_ID, "accepted", NOW),
      assignment(
        COMPLETED_ASSIGNMENT_ID,
        COMPLETED_REQUEST_ID,
        MECHANIC_ID,
        "completed",
        new Date("2026-07-05T07:05:00.000Z"),
        {
          startedAt: new Date("2026-07-05T07:20:00.000Z"),
          completedAt: new Date("2026-07-06T07:05:00.000Z")
        }
      ),
      assignment(
        CANCELED_ASSIGNMENT_ID,
        CANCELED_REQUEST_ID,
        MECHANIC_ID,
        "canceled",
        new Date("2026-07-04T07:05:00.000Z"),
        { canceledAt: new Date("2026-07-04T08:00:00.000Z") }
      ),
      assignment(OTHER_ASSIGNMENT_ID, OTHER_REQUEST_ID, OTHER_MECHANIC_ID, "accepted", NOW)
    ],
    quotes: [
      {
        id: "eeeeeeee-0000-4000-8000-000000000001",
        requestId: COMPLETED_REQUEST_ID,
        assignmentId: COMPLETED_ASSIGNMENT_ID,
        version: 1,
        status: "approved",
        currency: "VND",
        subtotalAmount: 100000,
        discountAmount: 0,
        totalAmount: 100000,
        createdBy: MECHANIC_ID,
        createdAt: new Date("2026-07-05T08:00:00.000Z"),
        respondedAt: new Date("2026-07-05T08:30:00.000Z"),
        lines: []
      },
      {
        id: "eeeeeeee-0000-4000-8000-000000000002",
        requestId: CANCELED_REQUEST_ID,
        assignmentId: CANCELED_ASSIGNMENT_ID,
        version: 1,
        status: "rejected",
        currency: "VND",
        subtotalAmount: 100000,
        discountAmount: 0,
        totalAmount: 100000,
        createdBy: MECHANIC_ID,
        createdAt: new Date("2026-07-04T08:00:00.000Z"),
        respondedAt: new Date("2026-07-04T08:30:00.000Z"),
        lines: []
      }
    ]
  });
}

export function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

export async function authenticate(request: Request): Promise<VerifiedSupabaseIdentity> {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    throw new AuthError("UNAUTHORIZED", "Authentication is required.", 401);
  }
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (token === "invalid") {
    throw new AuthError("INVALID_TOKEN", "Authentication token is invalid.", 401);
  }
  return identity(token === "mechanic" ? MECHANIC_ID : RIDER_ID);
}

export function request(path: string, token?: string) {
  return new Request(`http://localhost${path}`, {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
}

function user(id: string) {
  return { id, status: "active" as const, createdAt: NOW, updatedAt: NOW };
}

function serviceRequest(
  id: string,
  requestCode: string,
  riderId: string,
  motorcycleId: string,
  status: "assigned" | "completed" | "canceled",
  createdAt: Date
) {
  return {
    id,
    requestCode,
    riderId,
    motorcycleId,
    serviceType: "mobile_repair" as const,
    problemDescription: "Private rider problem text must stay out of mechanic ops.",
    status,
    priority: "normal" as const,
    serviceLocation: { latitude: 10.762622, longitude: 106.660172 },
    createdAt,
    updatedAt: createdAt
  };
}

function candidate(
  id: string,
  requestId: string,
  mechanicId: string,
  status: "offered" | "accepted" | "rejected",
  dates: { offeredAt: Date; expiresAt?: Date; respondedAt?: Date }
) {
  return {
    id,
    roundId: "dddddddd-0000-4000-8000-000000000001",
    requestId,
    mechanicId,
    rank: 1,
    distanceMeters: 50,
    status,
    offeredAt: dates.offeredAt,
    expiresAt: dates.expiresAt ?? new Date(dates.offeredAt.getTime() + 60_000),
    respondedAt: dates.respondedAt,
    createdAt: dates.offeredAt
  };
}

function assignment(
  id: string,
  requestId: string,
  mechanicId: string,
  status: "accepted" | "completed" | "canceled",
  acceptedAt: Date,
  dates: { startedAt?: Date; completedAt?: Date; canceledAt?: Date } = {}
) {
  return {
    id,
    requestId,
    mechanicId,
    acceptedCandidateId: "dddddddd-0000-4000-8000-000000000012",
    status,
    acceptedAt,
    ...dates,
    createdAt: acceptedAt,
    updatedAt: dates.completedAt ?? dates.canceledAt ?? acceptedAt
  };
}
