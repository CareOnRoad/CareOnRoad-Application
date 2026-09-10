import { describe, expect, it } from "vitest";

import { messageRequestSchema } from "../message.schema";

describe("messageRequestSchema", () => {
  it("accepts text input", () => {
    const result = messageRequestSchema.safeParse({
      input_mode: "text",
      content_text: "Xe kho de va hao xang",
      safety_answers: {
        stopped: true
      }
    });

    expect(result.success).toBe(true);
  });

  it("accepts voice input metadata", () => {
    const result = messageRequestSchema.safeParse({
      input_mode: "voice",
      safety_answers: {
        stopped: true
      }
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty text input", () => {
    const result = messageRequestSchema.safeParse({
      input_mode: "text",
      content_text: "   "
    });

    expect(result.success).toBe(false);
  });
});
