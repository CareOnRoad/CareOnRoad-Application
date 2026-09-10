export type RequestMediaMetadata = {
  id: string;
  requestId: string;
  mediaType: string;
  objectReference: string;
  contentType: string;
  sizeBytes?: number;
  checksum?: string;
  createdBy: string;
  createdAt: Date;
};

export type CreateRequestMediaMetadata = Omit<RequestMediaMetadata, "createdAt"> & {
  createdAt?: Date;
};

export interface RequestMediaRepository {
  create(input: CreateRequestMediaMetadata): Promise<RequestMediaMetadata>;
  listByRequest(requestId: string): Promise<RequestMediaMetadata[]>;
}
