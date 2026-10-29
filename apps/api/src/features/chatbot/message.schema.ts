import { z } from "zod";

const safetyAnswersSchema = z.record(z.unknown()).optional();

// Symptom descriptions are short; the cap bounds prompt tokens per request.
export const maxMessageChars = 500;

export const textMessageRequestSchema = z
  .object({
    input_mode: z.literal("text"),
    content_text: z.string().trim().min(1).max(maxMessageChars),
    safety_answers: safetyAnswersSchema
  })
  .strict();

export const voiceMessageRequestSchema = z
  .object({
    input_mode: z.literal("voice"),
    safety_answers: safetyAnswersSchema
  })
  .strict();

export const messageRequestSchema = z.discriminatedUnion("input_mode", [
  textMessageRequestSchema,
  voiceMessageRequestSchema
]);

export type TextMessageRequest = z.infer<typeof textMessageRequestSchema>;
export type VoiceMessageRequest = z.infer<typeof voiceMessageRequestSchema>;
export type MessageRequest = z.infer<typeof messageRequestSchema>;
