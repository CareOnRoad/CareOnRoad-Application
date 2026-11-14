import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";

import { sha256Hex } from "@/lib/sha256";

/**
 * Regression test cho SHA-256 thuần TypeScript dùng trên Hermes.
 *
 * BE (`media-upload.schemas.ts`) yêu cầu `sha256` là hex 64 ký tự lowercase và
 * dùng nó để verify byte-for-byte sau khi upload → hash phải đúng chuẩn
 * FIPS 180-4, nếu sai thì finalize luôn fail với 409.
 */

function reference(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

test("vector chuẩn: chuỗi rỗng", () => {
  assert.equal(
    sha256Hex(new Uint8Array(0)),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test("vector chuẩn: 'abc'", () => {
  assert.equal(
    sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("khớp node:crypto trên nhiều độ dài (kể cả bội số 64)", () => {
  // 55 / 119 / 183 là các độ dài mà padding vừa khớp ranh giới block 64
  // byte — nơi công thức padding hay bị sai (thêm dư một block).
  const lengths = [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 127, 128, 183, 1000, 4096];
  for (const length of lengths) {
    const bytes = new Uint8Array(randomBytes(length));
    assert.equal(sha256Hex(bytes), reference(bytes), `length = ${length}`);
  }
});

test("luôn trả về hex lowercase dài 64 ký tự", () => {
  const bytes = new Uint8Array(randomBytes(321));
  const digest = sha256Hex(bytes);
  assert.equal(digest.length, 64);
  assert.match(digest, /^[0-9a-f]{64}$/);
});
