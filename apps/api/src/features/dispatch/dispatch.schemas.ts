import { z } from "zod";

export const dispatchCandidateStatuses = [
  "pending",
  "offered",
  "accepted",
  "rejected",
  "expired",
  "cancelled"
] as const;

export const dispatchRoundStatuses = ["active", "accepted", "expired", "canceled"] as const;

export const dispatchCandidateStatusSchema = z.enum(dispatchCandidateStatuses);
export const dispatchRoundStatusSchema = z.enum(dispatchRoundStatuses);
