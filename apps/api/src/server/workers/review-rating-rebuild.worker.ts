import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

export class ReviewRatingRebuildWorker {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date } = {}
  ) {}

  async rebuild(): Promise<{ mechanics_rebuilt: number }> {
    const now = this.options.now?.() ?? new Date();
    const count = await this.unitOfWork.execute(({ reviews }) =>
      reviews.rebuildAllMechanicRatings(now)
    );
    return { mechanics_rebuilt: count };
  }
}
