import { hashText } from "./hash";

export type LogLevel = "info" | "warn" | "error";

export const chatbotLogEvents = [
  "chatbot.message.received",
  "chatbot.asr.started",
  "chatbot.asr.failed",
  "chatbot.asr.completed",
  "chatbot.diagnosis.started",
  "chatbot.gemini.started",
  "chatbot.gemini.failed",
  "chatbot.openrouter.started",
  "chatbot.openrouter.failed",
  "chatbot.ai_provider.skipped",
  "chatbot.fallback.used",
  "chatbot.diagnosis.completed",
  "chatbot.rate_limited"
] as const;

export type ChatbotLogEventName = (typeof chatbotLogEvents)[number];

export type LogEvent = {
  event: ChatbotLogEventName;
  request_id?: string;
  session_id?: string;
  input_mode?: "text" | "voice";
  latency_ms?: number;
  fallback_used?: boolean;
  risk_level?: "low" | "medium" | "high" | "critical";
  provider_status?: string;
  api_http_status?: string;
  retry_after?: number;
  openrouter_error_code?: string;
  openrouter_error_type?: string;
  provider_name?: string;
  error_code?: string;
  text_length?: number;
  text_hash?: string;
  [key: string]: unknown;
};

export type StructuredLogRecord = LogEvent & {
  level: LogLevel;
  timestamp: string;
};

type ConsoleSink = {
  info: (payload: StructuredLogRecord) => void;
  warn: (payload: StructuredLogRecord) => void;
  error: (payload: StructuredLogRecord) => void;
};

const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|secret|password|credential)/i;
const TOKEN_KEY_PATTERN = /token/i;
const RAW_AUDIO_KEY_PATTERN = /(audio|audio_file|raw_audio|blob|buffer|bytes|data)/i;
const TEXT_KEY_PATTERN = /(content_text|symptom_text|user_text|normalized_text|transcribed_text|message)$/i;
const PHONE_KEY_PATTERN = /phone/i;
const EMAIL_KEY_PATTERN = /email/i;
const PAYMENT_KEY_PATTERN = /(payment|card|cvv|bank|amount|price_quote)/i;
const OMIT_KEY_PATTERN = new RegExp(
  [
    SECRET_KEY_PATTERN.source,
    TOKEN_KEY_PATTERN.source,
    RAW_AUDIO_KEY_PATTERN.source,
    PHONE_KEY_PATTERN.source,
    EMAIL_KEY_PATTERN.source,
    PAYMENT_KEY_PATTERN.source
  ].join("|"),
  "i"
);

export function sanitizeLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizeEntries(payload);
}

export function createTextLogMetadata(text: string): Pick<LogEvent, "text_length" | "text_hash"> {
  return {
    text_length: text.length,
    text_hash: hashText(text)
  };
}

export function createServerLogger(sink: ConsoleSink = console) {
  function write(level: LogLevel, payload: LogEvent) {
    const sanitized = sanitizeLogPayload(payload) as LogEvent;
    sink[level]({
      level,
      timestamp: new Date().toISOString(),
      ...sanitized
    });
  }

  return {
    info: (payload: LogEvent) => write("info", payload),
    warn: (payload: LogEvent) => write("warn", payload),
    error: (payload: LogEvent) => write("error", payload)
  };
}

export const serverLogger = createServerLogger();

function sanitizeEntries(value: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(value).reduce<Record<string, unknown>>((sanitized, [key, entry]) => {
    if (OMIT_KEY_PATTERN.test(key)) {
      return sanitized;
    }

    if (TEXT_KEY_PATTERN.test(key) && typeof entry === "string") {
      return {
        ...sanitized,
        ...createTextLogMetadata(entry)
      };
    }

    sanitized[key] = sanitizeValue(entry);
    return sanitized;
  }, {});
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return sanitizeEntries(value as Record<string, unknown>);
}
