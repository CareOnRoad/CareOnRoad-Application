import { createHash } from "node:crypto";

import {
  MediaStorageProviderError,
  type InspectedMediaObject,
  type MediaStorageProvider,
  type SignedMediaUpload
} from "./media-storage.provider";

type ProviderOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

export class SupabaseMediaStorageProvider implements MediaStorageProvider {
  private readonly storageBase: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: ProviderOptions) {
    this.storageBase = `${options.supabaseUrl.replace(/\/$/, "")}/storage/v1`;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async createSignedUpload(input: {
    bucket: string;
    objectKey: string;
    contentType: string;
  }): Promise<SignedMediaUpload> {
    const response = await this.request(
      `${this.storageBase}/object/upload/sign/${encodePath(input.bucket, input.objectKey)}`,
      { method: "POST", body: "{}" }
    );
    if (!response.ok) throw new MediaStorageProviderError();

    const payload = (await safeJson(response)) as { url?: unknown };
    if (typeof payload.url !== "string" || !payload.url.startsWith("/object/upload/sign/")) {
      throw new MediaStorageProviderError();
    }
    const uploadUrl = `${this.storageBase}${payload.url}`;
    const parsed = new URL(uploadUrl);
    const expectedOrigin = new URL(this.options.supabaseUrl).origin;
    if (
      parsed.origin !== expectedOrigin ||
      !parsed.pathname.startsWith("/storage/v1/object/upload/sign/") ||
      !parsed.searchParams.get("token")
    ) {
      throw new MediaStorageProviderError();
    }
    return {
      uploadUrl,
      method: "PUT",
      requiredHeaders: { "content-type": input.contentType }
    };
  }

  async inspectAndHash(input: {
    bucket: string;
    objectKey: string;
    maxBytes: number;
  }): Promise<InspectedMediaObject | undefined> {
    const response = await this.request(
      `${this.storageBase}/object/authenticated/${encodePath(input.bucket, input.objectKey)}`,
      { method: "GET" }
    );
    if (response.status === 404) return undefined;
    if (!response.ok || !response.body) throw new MediaStorageProviderError();

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (!contentType) throw new MediaStorageProviderError();
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > input.maxBytes) {
      await response.body.cancel();
      throw new MediaStorageProviderError("Uploaded media exceeds the verification limit.");
    }

    const hash = createHash("sha256");
    const reader = response.body.getReader();
    let sizeBytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        sizeBytes += chunk.value.byteLength;
        if (sizeBytes > input.maxBytes) {
          await reader.cancel();
          throw new MediaStorageProviderError("Uploaded media exceeds the verification limit.");
        }
        hash.update(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    return { contentType, sizeBytes, sha256: hash.digest("hex") };
  }

  async remove(input: { bucket: string; objectKey: string }): Promise<void> {
    const response = await this.request(
      `${this.storageBase}/object/${encodeURIComponent(input.bucket)}`,
      { method: "DELETE", body: JSON.stringify({ prefixes: [input.objectKey] }) }
    );
    if (!response.ok && response.status !== 404) throw new MediaStorageProviderError();
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: this.options.serviceRoleKey,
          authorization: `Bearer ${this.options.serviceRoleKey}`,
          "content-type": "application/json",
          ...init.headers
        }
      });
    } catch {
      throw new MediaStorageProviderError();
    } finally {
      clearTimeout(timeout);
    }
  }
}

function encodePath(bucket: string, objectKey: string): string {
  return [bucket, ...objectKey.split("/")].map(encodeURIComponent).join("/");
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new MediaStorageProviderError();
  }
}
