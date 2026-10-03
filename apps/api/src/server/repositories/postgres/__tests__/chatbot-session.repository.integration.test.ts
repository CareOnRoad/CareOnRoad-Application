import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DiagnosisResult } from "@/features/chatbot/diagnosis.schema";
import { AuditedChatbotSessionRepository } from "@/server/repositories/chatbot-session-repository.factory";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = sourceMigrationFiles();

describeDatabase("chatbot session repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  const now = new Date("2026-06-30T04:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 4 });
    sql = context.sql;
    await applyMigrations(sql);
  }, 30_000);

  afterAll(async () => {
    await context?.dispose();
  }, 30_000);

  it("persists sessions, messages, and latest validated diagnosis across repository instances", async () => {
    const repository = new AuditedChatbotSessionRepository(new PostgresUnitOfWork(sql), {
      now: () => now
    });
    const session = await repository.createSession();
    const message = await repository.appendMessage(session.session_id, {
      input_mode: "voice",
      content_text: "full private rider text",
      transcribed_text: "full private transcript",
      normalized_text: "full private normalized text",
      safety_answers: { note: "private answer" }
    });
    await repository.setLatestDiagnosis(session.session_id, diagnosis(), now, {
      messageId: message?.message_id,
      providerName: "gemini",
      providerModel: "test-model"
    });

    const restarted = new AuditedChatbotSessionRepository(new PostgresUnitOfWork(sql));
    await expect(restarted.getSession(session.session_id)).resolves.toMatchObject({
      session_id: session.session_id,
      messages: [
        {
          input_mode: "voice",
          content_text: "full private rider text",
          transcribed_text: "full private transcript"
        }
      ],
      latest_diagnosis: diagnosis()
    });
    await expect(restarted.getLatestDiagnosis(session.session_id)).resolves.toEqual(
      diagnosis()
    );
  }, 30_000);

  it("commits metadata-only audit/outbox rows and stores no raw-audio schema", async () => {
    const [outboxRows, auditRows, audioColumns] = await Promise.all([
      sql`
        select topic, payload
        from outbox_events
        where topic like 'chatbot.%'
        order by created_at, id
      `,
      sql`
        select action, metadata
        from audit_logs
        where action like 'chatbot.%'
        order by created_at, id
      `,
      sql`
        select table_name, column_name
        from information_schema.columns
        where table_schema = current_schema()
          and table_name in ('chatbot_sessions', 'chatbot_messages', 'diagnosis_results')
          and column_name ~* '(audio|blob|bytes|buffer|api_key|secret|token)'
      `
    ]);
    expect(outboxRows).toHaveLength(3);
    expect(auditRows).toHaveLength(3);
    expect(audioColumns).toEqual([]);

    const metadata = JSON.stringify({ outboxRows, auditRows });
    for (const prohibited of [
      "full private rider text",
      "full private transcript",
      "full private normalized text",
      "private answer",
      diagnosis().short_answer,
      "Bearer private",
      "secret-api-key"
    ]) {
      expect(metadata).not.toContain(prohibited);
    }
  }, 30_000);

  it("rolls back the domain row when required outbox persistence conflicts", async () => {
    const sessionId = randomUUID();
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload
      )
      values (
        ${randomUUID()}, 'chatbot.session.created', 'chatbot_session',
        ${sessionId}, ${`chatbot.session.created:${sessionId}`}, '{}'::jsonb
      )
    `;
    const repository = new AuditedChatbotSessionRepository(new PostgresUnitOfWork(sql), {
      now: () => now
    });
    await expect(repository.createSession(now, { sessionId })).rejects.toBeDefined();
    await expect(
      sql`select count(*)::int as count from chatbot_sessions where id = ${sessionId}`
    ).resolves.toEqual([{ count: 0 }]);
  }, 30_000);
}, 30_000);

async function applyMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(
      readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
    );
  }
}

function sourceMigrationFiles(): string[] {
  return readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function diagnosis(): DiagnosisResult {
  return {
    short_answer: "Cần kiểm tra thêm. Giá chỉ là ước tính.",
    overall_confidence: 0.62,
    risk_level: "medium",
    can_continue_riding: true,
    top_hypotheses: [],
    estimated_total: { currency: "VND", min: 0, max: 0 },
    recommended_next_actions: [{ type: "ask_followup", label: "Mô tả thêm" }],
    followup_questions: ["Xe có khó đề không?"],
    fallback_used: false
  };
}
