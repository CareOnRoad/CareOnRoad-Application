export type WorkerAuthority = {
  workerId: string;
};

export class WorkerAuthError extends Error {
  readonly status = 401;
  readonly errorCode = "UNAUTHORIZED" as const;

  constructor(message = "Worker authority is required.") {
    super(message);
    this.name = "WorkerAuthError";
  }
}

export function authenticateWorkerSecret(
  request: Request,
  environment: Record<string, string | undefined> = process.env
): WorkerAuthority {
  const configuredSecret = environment.INTERNAL_WORKER_SECRET?.trim();
  const providedSecret = request.headers.get("x-worker-secret")?.trim();

  if (!configuredSecret || !providedSecret || providedSecret !== configuredSecret) {
    throw new WorkerAuthError();
  }

  return {
    workerId: request.headers.get("x-worker-id")?.trim() || "internal-worker-route"
  };
}
