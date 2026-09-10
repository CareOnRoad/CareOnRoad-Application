import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";
import type { MechanicProfileStatus } from "./mechanic.repository";

import type { GeoPoint } from "./mechanic.repository";

export type DispatchRoundStatus = "active" | "accepted" | "expired" | "canceled";
export type DispatchCandidateStatus =
  | "pending"
  | "offered"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export type DispatchRound = {
  id: string;
  requestId: string;
  roundNumber: number;
  radiusMeters: number;
  status: DispatchRoundStatus;
  startedAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  failureCount?: number;
};

export type DispatchCandidate = {
  id: string;
  roundId: string;
  requestId: string;
  mechanicId: string;
  rank: number;
  distanceMeters?: number;
  status: DispatchCandidateStatus;
  offeredAt?: Date;
  expiresAt?: Date;
  respondedAt?: Date;
  createdAt: Date;
};

export type DispatchCandidateMechanic = {
  mechanicId: string;
  serviceTypes: ServiceType[];
  isAvailable: boolean;
  profileStatus: MechanicProfileStatus;
  serviceRadiusKm: number;
  latestLocation?: GeoPoint;
  locationUpdatedAt?: Date;
  availabilityUpdatedAt: Date;
  ratingAvg: number;
  ratingCount: number;
  distanceMeters: number;
};

export type CreateDispatchRound = {
  id: string;
  requestId: string;
  roundNumber: number;
  radiusMeters: number;
  status?: DispatchRoundStatus;
  startedAt: Date;
  expiresAt: Date;
};

export type CreateDispatchCandidate = {
  id: string;
  roundId: string;
  requestId: string;
  mechanicId: string;
  rank: number;
  distanceMeters?: number;
  status?: DispatchCandidateStatus;
  offeredAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
};

export interface DispatchRepository {
  listRoundsByRequest(requestId: string): Promise<DispatchRound[]>;
  listRoundsByRequestForUpdate(requestId: string): Promise<DispatchRound[]>;
  findRoundById(roundId: string): Promise<DispatchRound | undefined>;
  findActiveRoundByRequest(requestId: string): Promise<DispatchRound | undefined>;
  claimExpiredRounds(input: {
    now: Date;
    leaseOwner: string;
    leaseUntil: Date;
    limit: number;
  }): Promise<DispatchRound[]>;
  releaseRoundClaim(input: { id: string; leaseOwner: string }): Promise<boolean>;
  createRoundWithCandidates(input: {
    round: CreateDispatchRound;
    candidates: CreateDispatchCandidate[];
  }): Promise<{ round: DispatchRound; candidates: DispatchCandidate[] }>;
  updateRoundStatus(input: {
    id: string;
    status: DispatchRoundStatus;
    completedAt?: Date;
  }): Promise<DispatchRound | undefined>;
  findCandidateById(id: string): Promise<DispatchCandidate | undefined>;
  findCandidateByIdForUpdate(id: string): Promise<DispatchCandidate | undefined>;
  listCandidatesByRequest(requestId: string): Promise<DispatchCandidate[]>;
  listCandidatesByRequestForUpdate(requestId: string): Promise<DispatchCandidate[]>;
  listCandidatesByMechanic(mechanicId: string, now: Date): Promise<DispatchCandidate[]>;
  updateCandidateStatus(input: {
    id: string;
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate | undefined>;
  updateCandidatesForRoundStatus(input: {
    roundId: string;
    fromStatuses: DispatchCandidateStatus[];
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate[]>;
  updateOtherCandidatesForRequestStatus(input: {
    requestId: string;
    exceptCandidateId: string;
    fromStatuses: DispatchCandidateStatus[];
    status: DispatchCandidateStatus;
    respondedAt?: Date;
  }): Promise<DispatchCandidate[]>;
  cancelOpenDispatchForRequest(input: {
    requestId: string;
    now: Date;
  }): Promise<{ canceledRounds: number; canceledCandidates: number }>;
  findCandidateMechanics(input: {
    serviceType: ServiceType;
    origin: GeoPoint;
    radiusMeters: number;
    now: Date;
    maxLocationAgeSeconds: number;
  }): Promise<DispatchCandidateMechanic[]>;
}
