import { createHash } from "node:crypto";

import type {
  InspectedMediaObject,
  MediaStorageProvider,
  SignedMediaUpload
} from "./media-storage.provider";

type FakeObject = { bytes: Uint8Array; contentType: string };

export class FakeMediaStorageProvider implements MediaStorageProvider {
  readonly objects = new Map<string, FakeObject>();
  readonly removed: string[] = [];

  async createSignedUpload(input: {
    bucket: string;
    objectKey: string;
    contentType: string;
  }): Promise<SignedMediaUpload> {
    return {
      uploadUrl: `https://storage.test/upload/${encodeURIComponent(input.bucket)}/${input.objectKey}?token=fake`,
      method: "PUT",
      requiredHeaders: { "content-type": input.contentType }
    };
  }

  put(bucket: string, objectKey: string, bytes: Uint8Array, contentType: string): void {
    this.objects.set(key(bucket, objectKey), { bytes, contentType });
  }

  async inspectAndHash(input: {
    bucket: string;
    objectKey: string;
    maxBytes: number;
  }): Promise<InspectedMediaObject | undefined> {
    const object = this.objects.get(key(input.bucket, input.objectKey));
    if (!object) return undefined;
    if (object.bytes.byteLength > input.maxBytes) throw new Error("verification limit exceeded");
    return {
      contentType: object.contentType,
      sizeBytes: object.bytes.byteLength,
      sha256: createHash("sha256").update(object.bytes).digest("hex")
    };
  }

  async remove(input: { bucket: string; objectKey: string }): Promise<void> {
    this.objects.delete(key(input.bucket, input.objectKey));
    this.removed.push(key(input.bucket, input.objectKey));
  }
}

function key(bucket: string, objectKey: string): string {
  return `${bucket}/${objectKey}`;
}
