export type LiveTrackingCleanupResult = {
  status: "completed";
  deleted: number;
};

export class LiveTrackingCleanupWorker {
  constructor(
    private readonly repository: {
      deleteExpired(now: Date, limit: number): Promise<number>;
    },
    private readonly options: { now?: () => Date } = {}
  ) {}

  async run(input: { limit: number }): Promise<LiveTrackingCleanupResult> {
    const deleted = await this.repository.deleteExpired(
      this.options.now?.() ?? new Date(),
      input.limit
    );
    return { status: "completed", deleted };
  }
}
