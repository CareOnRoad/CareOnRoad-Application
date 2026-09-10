export type RequestCodePrefix = "EMR" | "MOB" | "HOME" | "MNT" | "OTH";

export type RequestCodeSequence = {
  localDate: string;
  servicePrefix: RequestCodePrefix;
  lastSequence: number;
  updatedAt: Date;
};

export interface RequestCodeRepository {
  allocateNext(
    servicePrefix: RequestCodePrefix,
    localDate: string,
    updatedAt: Date
  ): Promise<RequestCodeSequence>;
}
