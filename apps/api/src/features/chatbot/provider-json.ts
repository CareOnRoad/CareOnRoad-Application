export const diagnosisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "v",
    "risk",
    "ride",
    "part",
    "issue",
    "answer",
    "actions",
    "questions"
  ],
  properties: {
    v: { const: 1 },
    risk: { enum: ["low", "medium", "high", "critical"] },
    ride: { type: "boolean" },
    part: {
      enum: [
        "SPARK_PLUG",
        "BATTERY",
        "AIR_FILTER",
        "FUEL_SYSTEM",
        "BRAKE_SYSTEM",
        "ENGINE_OIL",
        "DRIVE_BELT",
        "TIRE",
        "ELECTRICAL_SYSTEM",
        "UNKNOWN"
      ]
    },
    issue: { type: "string" },
    answer: { type: "string" },
    actions: {
      type: "array",
      maxItems: 2,
      items: { type: "string" }
    },
    questions: {
      type: "array",
      maxItems: 2,
      items: { type: "string" }
    }
  }
} as const;

export function parseJsonObjectContent(
  content: string
): { success: true; json: unknown } | { success: false; reason: string } {
  const trimmed = content.trim();
  const direct = safeParseJson(trimmed);

  if (direct.success) {
    return isRecord(direct.json)
      ? { success: true, json: direct.json }
      : { success: false, reason: "json_content_not_object" };
  }

  const extracted = extractJsonObject(trimmed);
  if (!extracted) {
    const balanced = balanceLikelyTruncatedJson(trimmed);
    if (!balanced) {
      return { success: false, reason: "no_json_object_found" };
    }

    const repairedBalanced = safeParseJson(balanced);
    if (!repairedBalanced.success) {
      return { success: false, reason: "json_balanced_repair_failed" };
    }

    return isRecord(repairedBalanced.json)
      ? { success: true, json: repairedBalanced.json }
      : { success: false, reason: "json_content_not_object" };
  }

  const repaired = safeParseJson(extracted);
  if (!repaired.success) {
    return { success: false, reason: "json_repair_parse_failed" };
  }

  return isRecord(repaired.json)
    ? { success: true, json: repaired.json }
    : { success: false, reason: "json_content_not_object" };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizePreview(text: string, maxLength = 240): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeParseJson(text: string): { success: true; json: unknown } | { success: false } {
  try {
    return {
      success: true,
      json: JSON.parse(text) as unknown
    };
  } catch {
    return { success: false };
  }
}

function extractJsonObject(text: string): string | null {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return withoutFence.slice(start, end + 1);
}

function balanceLikelyTruncatedJson(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of trimmed) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      stack.push("}");
      continue;
    }

    if (char === "[") {
      stack.push("]");
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = stack.pop();
      if (expected !== char) {
        return null;
      }
    }
  }

  if (inString || stack.length === 0 || stack.length > 4) {
    return null;
  }

  return `${trimmed}${stack.reverse().join("")}`;
}
