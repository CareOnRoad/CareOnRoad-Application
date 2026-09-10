import type {
  CreateRequestMediaMetadata,
  RequestMediaMetadata,
  RequestMediaRepository
} from "../contracts/request-media.repository";

export class InMemoryRequestMediaRepository implements RequestMediaRepository {
  constructor(private readonly media: RequestMediaMetadata[]) {}

  async create(input: CreateRequestMediaMetadata): Promise<RequestMediaMetadata> {
    const row: RequestMediaMetadata = {
      ...input,
      createdAt: input.createdAt ?? new Date()
    };
    this.media.push(row);
    return cloneMedia(row);
  }

  async listByRequest(requestId: string): Promise<RequestMediaMetadata[]> {
    return this.media
      .filter((media) => media.requestId === requestId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(cloneMedia);
  }
}

function cloneMedia(media: RequestMediaMetadata): RequestMediaMetadata {
  return {
    ...media,
    createdAt: new Date(media.createdAt)
  };
}
