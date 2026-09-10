/* global console, fetch */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

import postgres from "postgres";

loadLocalEnvironment();

const DATABASE_URL = requiredEnvironment("DATABASE_URL");
const SUPABASE_URL = requiredEnvironment("SUPABASE_URL").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const VERIFY_ONLY = process.argv.includes("--verify-only");
const SEED_USER_PASSWORD = VERIFY_ONLY ? undefined : requiredEnvironment("SEED_USER_PASSWORD");

const accounts = [
  { key: "rider1", email: "rider1@gmail.com", displayName: "Rider 1", role: "rider" },
  { key: "rider2", email: "rider2@gmail.com", displayName: "Rider 2", role: "rider" },
  {
    key: "mechanic1",
    email: "mechanic1@gmail.com",
    displayName: "Mechanic 1",
    role: "mechanic"
  },
  {
    key: "mechanic2",
    email: "mechanic2@gmail.com",
    displayName: "Mechanic 2",
    role: "mechanic"
  }
];

const ids = {
  deviceRider1: "10000000-0000-4000-8000-000000000001",
  deviceRider2: "10000000-0000-4000-8000-000000000002",
  deviceMechanic1: "10000000-0000-4000-8000-000000000003",
  deviceMechanic2: "10000000-0000-4000-8000-000000000004",
  motorcycleRider1Main: "20000000-0000-4000-8000-000000000001",
  motorcycleRider1Second: "20000000-0000-4000-8000-000000000002",
  motorcycleRider2Main: "20000000-0000-4000-8000-000000000003",
  motorcycleRider2Second: "20000000-0000-4000-8000-000000000004",
  motorcycleRider2Archived: "20000000-0000-4000-8000-000000000005",
  reminderRider1Recurring: "30000000-0000-4000-8000-000000000001",
  reminderRider1Due: "30000000-0000-4000-8000-000000000002",
  reminderRider2Snoozed: "30000000-0000-4000-8000-000000000003",
  reminderRider2Disabled: "30000000-0000-4000-8000-000000000004",
  notificationRider1Sent: "31000000-0000-4000-8000-000000000001",
  notificationRider1Pending: "31000000-0000-4000-8000-000000000002",
  notificationRider2Failed: "31000000-0000-4000-8000-000000000003",
  notificationMechanic2Pending: "31000000-0000-4000-8000-000000000004",
  occurrenceRider1Sent: "32000000-0000-4000-8000-000000000001",
  occurrenceRider1Due: "32000000-0000-4000-8000-000000000002",
  occurrenceRider2Snoozed: "32000000-0000-4000-8000-000000000003",
  requestOffered: "40000000-0000-4000-8000-000000000001",
  requestAwaitingQuote: "40000000-0000-4000-8000-000000000002",
  requestCompletedRider1: "40000000-0000-4000-8000-000000000003",
  requestCanceledRider1: "40000000-0000-4000-8000-000000000004",
  requestScheduledRider1: "40000000-0000-4000-8000-000000000005",
  requestReminderRider1: "40000000-0000-4000-8000-000000000006",
  requestSubmittedRider2: "40000000-0000-4000-8000-000000000007",
  requestEscalatedRider2: "40000000-0000-4000-8000-000000000008",
  requestCompletedRider2: "40000000-0000-4000-8000-000000000009",
  requestOtherRider2: "40000000-0000-4000-8000-000000000010",
  mediaOfferedPhoto: "41000000-0000-4000-8000-000000000001",
  mediaQuoteVideo: "41000000-0000-4000-8000-000000000002",
  roundOffered: "50000000-0000-4000-8000-000000000001",
  roundAwaitingQuote: "50000000-0000-4000-8000-000000000002",
  roundCompletedRider1: "50000000-0000-4000-8000-000000000003",
  roundEscalatedRider2: "50000000-0000-4000-8000-000000000004",
  roundCompletedRider2: "50000000-0000-4000-8000-000000000005",
  candidateOfferedMechanic2: "51000000-0000-4000-8000-000000000001",
  candidateAwaitingQuoteMechanic1: "51000000-0000-4000-8000-000000000002",
  candidateCompletedMechanic1: "51000000-0000-4000-8000-000000000003",
  candidateExpiredMechanic2: "51000000-0000-4000-8000-000000000004",
  candidateCompletedMechanic2: "51000000-0000-4000-8000-000000000005",
  assignmentAwaitingQuote: "60000000-0000-4000-8000-000000000001",
  assignmentCompletedRider1: "60000000-0000-4000-8000-000000000002",
  assignmentCompletedRider2: "60000000-0000-4000-8000-000000000003",
  diagnosisAwaitingQuote: "61000000-0000-4000-8000-000000000001",
  diagnosisCompletedRider1: "61000000-0000-4000-8000-000000000002",
  diagnosisCompletedRider2: "61000000-0000-4000-8000-000000000003",
  quoteRejected: "62000000-0000-4000-8000-000000000001",
  quotePending: "62000000-0000-4000-8000-000000000002",
  quoteApprovedRider1: "62000000-0000-4000-8000-000000000003",
  quoteApprovedRider2: "62000000-0000-4000-8000-000000000004",
  chatbotSessionRider1: "70000000-0000-4000-8000-000000000001",
  chatbotSessionRider2: "70000000-0000-4000-8000-000000000002",
  chatbotMessageRider1: "71000000-0000-4000-8000-000000000001",
  chatbotMessageRider2: "71000000-0000-4000-8000-000000000002",
  chatbotDiagnosisRider1: "72000000-0000-4000-8000-000000000001",
  chatbotDiagnosisRider2: "72000000-0000-4000-8000-000000000002",
  idempotencyRequest: "80000000-0000-4000-8000-000000000001",
  outboxPending: "81000000-0000-4000-8000-000000000001",
  outboxProcessed: "81000000-0000-4000-8000-000000000002",
  outboxDeadLetter: "81000000-0000-4000-8000-000000000003",
  auditRider: "82000000-0000-4000-8000-000000000001",
  auditMechanic: "82000000-0000-4000-8000-000000000002"
};

const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
  idle_timeout: 5
});

try {
  await assertRequiredSchema(sql);

  if (VERIFY_ONLY) {
    const authUsers = await listAuthUsers();
    await printVerification(sql, authUsers);
  } else {
    const authUsers = await ensureAuthUsers();
    await seedDatabase(sql, authUsers);
    await printVerification(sql, await listAuthUsers());
  }
} finally {
  await sql.end({ timeout: 5 });
}

async function ensureAuthUsers() {
  const existingUsers = await listAuthUsers();
  const result = {};

  for (const account of accounts) {
    let user = existingUsers.find(
      (candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase()
    );

    if (user) {
      user = await adminRequest(`/auth/v1/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          password: SEED_USER_PASSWORD,
          email_confirm: true,
          user_metadata: { display_name: account.displayName, mock_seed: true }
        })
      });
    } else {
      user = await adminRequest("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: account.email,
          password: SEED_USER_PASSWORD,
          email_confirm: true,
          user_metadata: { display_name: account.displayName, mock_seed: true }
        })
      });
    }

    result[account.key] = user;
  }

  return result;
}

async function listAuthUsers() {
  const payload = await adminRequest("/auth/v1/admin/users?page=1&per_page=1000");
  return Array.isArray(payload) ? payload : (payload.users ?? []);
}

async function adminRequest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.msg === "string"
          ? body.msg
          : "Supabase Admin API request failed.";
    throw new Error(`Supabase Admin API ${response.status}: ${message}`);
  }
  return body;
}

async function seedDatabase(db, authUsers) {
  const rider1 = authUsers.rider1.id;
  const rider2 = authUsers.rider2.id;
  const mechanic1 = authUsers.mechanic1.id;
  const mechanic2 = authUsers.mechanic2.id;
  const now = new Date();
  const at = (offsetMinutes) => new Date(now.getTime() + offsetMinutes * 60_000);

  await db.begin(async (tx) => {
    const appUsers = [
      {
        id: rider1,
        display_name: "Nguyễn Minh Rider 1",
        phone_masked: "09******01",
        status: "active",
        created_at: at(-43_200),
        updated_at: now
      },
      {
        id: rider2,
        display_name: "Trần Hoàng Rider 2",
        phone_masked: "09******02",
        status: "active",
        created_at: at(-41_760),
        updated_at: now
      },
      {
        id: mechanic1,
        display_name: "Kỹ thuật viên Grand Park 1",
        phone_masked: "09******11",
        status: "active",
        created_at: at(-40_320),
        updated_at: now
      },
      {
        id: mechanic2,
        display_name: "Kỹ thuật viên Grand Park 2",
        phone_masked: "09******12",
        status: "active",
        created_at: at(-38_880),
        updated_at: now
      }
    ];
    await tx`
      insert into app_users ${tx(
        appUsers,
        "id",
        "display_name",
        "phone_masked",
        "status",
        "created_at",
        "updated_at"
      )}
      on conflict (id) do update set
        display_name = excluded.display_name,
        phone_masked = excluded.phone_masked,
        status = excluded.status,
        updated_at = excluded.updated_at
    `;

    await tx`
      insert into user_roles ${tx(
        [
          { user_id: rider1, role: "rider", created_at: at(-43_200) },
          { user_id: rider2, role: "rider", created_at: at(-41_760) },
          { user_id: mechanic1, role: "mechanic", created_at: at(-40_320) },
          { user_id: mechanic2, role: "mechanic", created_at: at(-38_880) }
        ],
        "user_id",
        "role",
        "created_at"
      )}
      on conflict (user_id, role) do nothing
    `;

    const devices = [
      deviceRow(ids.deviceRider1, rider1, "rider1@gmail.com", "android", now),
      deviceRow(ids.deviceRider2, rider2, "rider2@gmail.com", "ios", now),
      deviceRow(ids.deviceMechanic1, mechanic1, "mechanic1@gmail.com", "android", now),
      deviceRow(ids.deviceMechanic2, mechanic2, "mechanic2@gmail.com", "android", now)
    ];
    await tx`
      insert into user_devices ${tx(
        devices,
        "id",
        "user_id",
        "device_key_hash",
        "platform",
        "enabled",
        "last_registered_at",
        "created_at",
        "updated_at"
      )}
      on conflict (id) do update set
        enabled = excluded.enabled,
        last_registered_at = excluded.last_registered_at,
        updated_at = excluded.updated_at
    `;

    const motorcycles = [
      {
        id: ids.motorcycleRider1Main,
        rider_id: rider1,
        brand_text: "Honda",
        model_text: "Air Blade 160",
        license_plate: "59-X3 123.45",
        year: 2023,
        notes: "Xe đi làm hằng ngày, bảo dưỡng định kỳ tại Grand Park.",
        archived_at: null,
        created_at: at(-30_000),
        updated_at: now
      },
      {
        id: ids.motorcycleRider1Second,
        rider_id: rider1,
        brand_text: "Yamaha",
        model_text: "Exciter 155 VVA",
        license_plate: "59-X3 234.56",
        year: 2022,
        notes: "Xe dự phòng.",
        archived_at: null,
        created_at: at(-29_000),
        updated_at: now
      },
      {
        id: ids.motorcycleRider2Main,
        rider_id: rider2,
        brand_text: "Honda",
        model_text: "Vision",
        license_plate: "59-X3 345.67",
        year: 2024,
        notes: "Xe sử dụng trong khu đô thị.",
        archived_at: null,
        created_at: at(-28_000),
        updated_at: now
      },
      {
        id: ids.motorcycleRider2Second,
        rider_id: rider2,
        brand_text: "VinFast",
        model_text: "Klara S",
        license_plate: "59-MĐ1 456.78",
        year: 2023,
        notes: "Xe điện, pin thuê.",
        archived_at: null,
        created_at: at(-27_000),
        updated_at: now
      },
      {
        id: ids.motorcycleRider2Archived,
        rider_id: rider2,
        brand_text: "Yamaha",
        model_text: "Sirius",
        license_plate: "59-X3 567.89",
        year: 2018,
        notes: "Xe cũ đã ngừng sử dụng.",
        archived_at: at(-10_000),
        created_at: at(-26_000),
        updated_at: at(-10_000)
      }
    ];
    await tx`
      insert into motorcycles ${tx(
        motorcycles,
        "id",
        "rider_id",
        "brand_text",
        "model_text",
        "license_plate",
        "year",
        "notes",
        "archived_at",
        "created_at",
        "updated_at"
      )}
      on conflict (id) do update set
        rider_id = excluded.rider_id,
        brand_text = excluded.brand_text,
        model_text = excluded.model_text,
        license_plate = excluded.license_plate,
        year = excluded.year,
        notes = excluded.notes,
        archived_at = excluded.archived_at,
        updated_at = excluded.updated_at
    `;

    await upsertMechanic(tx, {
      userId: mechanic1,
      longitude: 106.8377,
      latitude: 10.8414,
      radius: 8,
      rating: 0,
      ratingCount: 0,
      now
    });
    await upsertMechanic(tx, {
      userId: mechanic2,
      longitude: 106.8424,
      latitude: 10.8462,
      radius: 12,
      rating: 0,
      ratingCount: 0,
      now
    });

    const skills = accounts
      .filter((account) => account.role === "mechanic")
      .flatMap((account) =>
        [
          "emergency_rescue",
          "mobile_repair",
          "at_home_service",
          "periodic_maintenance",
          "other"
        ].map((serviceType) => ({
          mechanic_id: account.key === "mechanic1" ? mechanic1 : mechanic2,
          service_type: serviceType,
          created_at: at(-20_000)
        }))
      );
    await tx`
      insert into mechanic_skills ${tx(skills, "mechanic_id", "service_type", "created_at")}
      on conflict (mechanic_id, service_type) do nothing
    `;

    const reminderRules = [
      {
        id: ids.reminderRider1Recurring,
        rider_id: rider1,
        motorcycle_id: ids.motorcycleRider1Main,
        title: "Thay dầu máy định kỳ",
        interval_days: 90,
        next_due_at: at(43_200),
        snoozed_until: null,
        enabled: true,
        last_completed_at: at(-86_400),
        lease_owner: null,
        lease_expires_at: null,
        failure_count: 0,
        created_at: at(-129_600),
        updated_at: now
      },
      {
        id: ids.reminderRider1Due,
        rider_id: rider1,
        motorcycle_id: ids.motorcycleRider1Second,
        title: "Kiểm tra nhông sên dĩa",
        interval_days: 120,
        next_due_at: at(-60),
        snoozed_until: null,
        enabled: true,
        last_completed_at: null,
        lease_owner: null,
        lease_expires_at: null,
        failure_count: 0,
        created_at: at(-43_200),
        updated_at: at(-60)
      },
      {
        id: ids.reminderRider2Snoozed,
        rider_id: rider2,
        motorcycle_id: ids.motorcycleRider2Main,
        title: "Kiểm tra lốp và phanh",
        interval_days: 60,
        next_due_at: at(-1_440),
        snoozed_until: at(10_080),
        enabled: true,
        last_completed_at: null,
        lease_owner: null,
        lease_expires_at: null,
        failure_count: 1,
        created_at: at(-50_000),
        updated_at: now
      },
      {
        id: ids.reminderRider2Disabled,
        rider_id: rider2,
        motorcycle_id: ids.motorcycleRider2Second,
        title: "Kiểm tra pin xe điện",
        interval_days: 30,
        next_due_at: at(20_160),
        snoozed_until: null,
        enabled: false,
        last_completed_at: null,
        lease_owner: null,
        lease_expires_at: null,
        failure_count: 0,
        created_at: at(-40_000),
        updated_at: now
      }
    ];
    await tx`
      insert into reminder_rules ${tx(
        reminderRules,
        "id",
        "rider_id",
        "motorcycle_id",
        "title",
        "interval_days",
        "next_due_at",
        "snoozed_until",
        "enabled",
        "last_completed_at",
        "lease_owner",
        "lease_expires_at",
        "failure_count",
        "created_at",
        "updated_at"
      )}
      on conflict (id) do update set
        title = excluded.title,
        interval_days = excluded.interval_days,
        next_due_at = excluded.next_due_at,
        snoozed_until = excluded.snoozed_until,
        enabled = excluded.enabled,
        last_completed_at = excluded.last_completed_at,
        lease_owner = null,
        lease_expires_at = null,
        failure_count = excluded.failure_count,
        updated_at = excluded.updated_at
    `;

    const notifications = [
      {
        id: ids.notificationRider1Sent,
        user_id: rider1,
        type: "reminder.due",
        title: "Đến hạn bảo dưỡng",
        body: "Xe Air Blade đã đến hạn thay dầu máy định kỳ.",
        data: json({ reminder_id: ids.reminderRider1Recurring }),
        dedupe_key: "mock:notification:rider1:sent",
        status: "sent",
        read_at: at(-1_000),
        created_at: at(-1_200),
        sent_at: at(-1_190),
        last_error_code: null
      },
      {
        id: ids.notificationRider1Pending,
        user_id: rider1,
        type: "quote.created",
        title: "Có báo giá mới",
        body: "Kỹ thuật viên đã gửi báo giá để bạn xem xét.",
        data: json({ request_id: ids.requestAwaitingQuote }),
        dedupe_key: "mock:notification:rider1:pending",
        status: "pending",
        read_at: null,
        created_at: at(-30),
        sent_at: null,
        last_error_code: null
      },
      {
        id: ids.notificationRider2Failed,
        user_id: rider2,
        type: "reminder.due",
        title: "Nhắc kiểm tra xe",
        body: "Thông báo thử nghiệm đang chờ gửi lại.",
        data: json({ reminder_id: ids.reminderRider2Snoozed }),
        dedupe_key: "mock:notification:rider2:failed",
        status: "failed",
        read_at: null,
        created_at: at(-720),
        sent_at: null,
        last_error_code: "MOCK_DELIVERY_FAILED"
      },
      {
        id: ids.notificationMechanic2Pending,
        user_id: mechanic2,
        type: "dispatch.offer.created",
        title: "Có yêu cầu cứu hộ mới",
        body: "Yêu cầu mới tại Vinhomes Grand Park đang chờ phản hồi.",
        data: json({ request_id: ids.requestOffered }),
        dedupe_key: "mock:notification:mechanic2:offer",
        status: "pending",
        read_at: null,
        created_at: at(-8),
        sent_at: null,
        last_error_code: null
      }
    ];
    await tx`
      insert into notifications ${tx(
        notifications,
        "id",
        "user_id",
        "type",
        "title",
        "body",
        "data",
        "dedupe_key",
        "status",
        "read_at",
        "created_at",
        "sent_at",
        "last_error_code"
      )}
      on conflict (id) do update set
        title = excluded.title,
        body = excluded.body,
        data = excluded.data,
        status = excluded.status,
        read_at = excluded.read_at,
        sent_at = excluded.sent_at,
        last_error_code = excluded.last_error_code
    `;

    const occurrences = [
      {
        id: ids.occurrenceRider1Sent,
        rule_id: ids.reminderRider1Recurring,
        rider_id: rider1,
        motorcycle_id: ids.motorcycleRider1Main,
        due_at: at(-1_200),
        status: "sent",
        notification_id: ids.notificationRider1Sent,
        retry_count: 0,
        last_error_code: null,
        created_at: at(-1_200),
        processed_at: at(-1_190)
      },
      {
        id: ids.occurrenceRider1Due,
        rule_id: ids.reminderRider1Due,
        rider_id: rider1,
        motorcycle_id: ids.motorcycleRider1Second,
        due_at: at(-60),
        status: "due",
        notification_id: null,
        retry_count: 0,
        last_error_code: null,
        created_at: at(-60),
        processed_at: null
      },
      {
        id: ids.occurrenceRider2Snoozed,
        rule_id: ids.reminderRider2Snoozed,
        rider_id: rider2,
        motorcycle_id: ids.motorcycleRider2Main,
        due_at: at(-1_440),
        status: "failed",
        notification_id: ids.notificationRider2Failed,
        retry_count: 1,
        last_error_code: "MOCK_DELIVERY_FAILED",
        created_at: at(-1_440),
        processed_at: at(-720)
      }
    ];
    await tx`
      insert into reminder_occurrences ${tx(
        occurrences,
        "id",
        "rule_id",
        "rider_id",
        "motorcycle_id",
        "due_at",
        "status",
        "notification_id",
        "retry_count",
        "last_error_code",
        "created_at",
        "processed_at"
      )}
      on conflict (id) do update set
        status = excluded.status,
        notification_id = excluded.notification_id,
        retry_count = excluded.retry_count,
        last_error_code = excluded.last_error_code,
        processed_at = excluded.processed_at
    `;

    await insertServiceRequests(tx, {
      rider1,
      rider2,
      now,
      at
    });

    await tx`
      insert into request_media_metadata ${tx(
        [
          {
            id: ids.mediaOfferedPhoto,
            request_id: ids.requestOffered,
            media_type: "image",
            object_reference: "mock/service-requests/offered-engine.jpg",
            content_type: "image/jpeg",
            size_bytes: 245_760,
            checksum: "sha256:mock-offered-engine",
            created_by: rider1,
            created_at: at(-18)
          },
          {
            id: ids.mediaQuoteVideo,
            request_id: ids.requestAwaitingQuote,
            media_type: "video",
            object_reference: "mock/service-requests/brake-noise.mp4",
            content_type: "video/mp4",
            size_bytes: 1_572_864,
            checksum: "sha256:mock-brake-noise",
            created_by: rider1,
            created_at: at(-230)
          }
        ],
        "id",
        "request_id",
        "media_type",
        "object_reference",
        "content_type",
        "size_bytes",
        "checksum",
        "created_by",
        "created_at"
      )}
      on conflict (id) do nothing
    `;

    await insertRequestHistory(tx, { rider1, rider2, mechanic1, mechanic2, at });
    await insertDispatchAndAssignments(tx, { rider1, mechanic1, mechanic2, at });
    await insertDiagnosesAndQuotes(tx, { mechanic1, mechanic2, at });
    await insertChatbotFixtures(tx, { rider1, rider2, at });
    await insertOperationalFixtures(tx, { rider1, mechanic1, at });

    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now);
    await tx`
      insert into daily_request_sequences (local_date, service_prefix, last_sequence, updated_at)
      values
        (${localDate}, 'EMR', 1, ${now}),
        (${localDate}, 'MOB', 7, ${now}),
        (${localDate}, 'HOME', 5, ${now}),
        (${localDate}, 'MNT', 6, ${now}),
        (${localDate}, 'OTH', 10, ${now})
      on conflict (local_date, service_prefix) do update set
        last_sequence = greatest(daily_request_sequences.last_sequence, excluded.last_sequence),
        updated_at = excluded.updated_at
    `;
  });
}

async function upsertMechanic(tx, input) {
  await tx`
    insert into mechanic_profiles (
      user_id, profile_status, is_available, service_radius_km,
      latest_location, location_updated_at, availability_updated_at,
      rating_avg, rating_count, created_at, updated_at
    )
    values (
      ${input.userId}, 'active', true, ${input.radius},
      ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
      ${input.now}, ${input.now}, ${input.rating}, ${input.ratingCount},
      ${input.now}, ${input.now}
    )
    on conflict (user_id) do update set
      profile_status = excluded.profile_status,
      is_available = excluded.is_available,
      service_radius_km = excluded.service_radius_km,
      latest_location = excluded.latest_location,
      location_updated_at = excluded.location_updated_at,
      availability_updated_at = excluded.availability_updated_at,
      rating_avg = excluded.rating_avg,
      rating_count = excluded.rating_count,
      updated_at = excluded.updated_at
  `;
}

async function insertServiceRequests(tx, context) {
  const { rider1, rider2, at } = context;
  const requests = [
    {
      id: ids.requestOffered,
      request_code: requestCode("EMR", 1),
      rider_id: rider1,
      motorcycle_id: ids.motorcycleRider1Main,
      service_type: "emergency_rescue",
      fulfillment_mode: null,
      problem_description: "Xe chết máy đột ngột và không đề được.",
      status: "offered",
      priority: "emergency",
      longitude: 106.8381,
      latitude: 10.8421,
      address_text: "The Rainbow, Vinhomes Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: null,
      safety_answers: json({ fuel_leak: false, smoke: false, safe_position: true }),
      maintenance_notes: null,
      manual_escalation_reason: null,
      canceled_reason: null,
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-20),
      updated_at: at(-8)
    },
    {
      id: ids.requestAwaitingQuote,
      request_code: requestCode("MOB", 2),
      rider_id: rider1,
      motorcycle_id: ids.motorcycleRider1Second,
      service_type: "mobile_repair",
      fulfillment_mode: null,
      problem_description: "Phanh trước phát tiếng kêu lớn khi bóp phanh.",
      status: "awaiting_quote_approval",
      priority: "high",
      longitude: 106.8398,
      latitude: 10.8444,
      address_text: "Vincom Mega Mall Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: null,
      safety_answers: json({ brake_effective: true, wheel_locked: false }),
      maintenance_notes: null,
      manual_escalation_reason: null,
      canceled_reason: null,
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-300),
      updated_at: at(-25)
    },
    {
      id: ids.requestCompletedRider1,
      request_code: requestCode("MOB", 3),
      rider_id: rider1,
      motorcycle_id: ids.motorcycleRider1Main,
      service_type: "mobile_repair",
      fulfillment_mode: null,
      problem_description: "Lốp sau bị thủng do cán đinh.",
      status: "completed",
      priority: "normal",
      longitude: 106.8427,
      latitude: 10.8458,
      address_text: "The Origami, Vinhomes Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: null,
      safety_answers: json({ tire_flat: true, safe_position: true }),
      maintenance_notes: null,
      manual_escalation_reason: null,
      canceled_reason: null,
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-10_080),
      updated_at: at(-9_900)
    },
    {
      id: ids.requestCanceledRider1,
      request_code: requestCode("OTH", 4),
      rider_id: rider1,
      motorcycle_id: ids.motorcycleRider1Second,
      service_type: "other",
      fulfillment_mode: "immediate_location",
      problem_description: "Cần kiểm tra tiếng rung nhẹ ở tay lái.",
      status: "canceled",
      priority: "normal",
      longitude: 106.8431,
      latitude: 10.8437,
      address_text: "Masteri Centre Point, Vinhomes Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: null,
      safety_answers: json({ steering_stable: true }),
      maintenance_notes: null,
      manual_escalation_reason: null,
      canceled_reason: "Rider tự xử lý được và hủy yêu cầu.",
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-2_880),
      updated_at: at(-2_850)
    },
    {
      id: ids.requestScheduledRider1,
      request_code: requestCode("HOME", 5),
      rider_id: rider1,
      motorcycle_id: ids.motorcycleRider1Main,
      service_type: "at_home_service",
      fulfillment_mode: null,
      problem_description: "Bảo dưỡng xe tại nhà và kiểm tra lọc gió.",
      status: "submitted",
      priority: "normal",
      longitude: null,
      latitude: null,
      address_text: "S2.05 Vinhomes Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: at(2_880),
      safety_answers: null,
      maintenance_notes: "Liên hệ trước 15 phút khi đến.",
      manual_escalation_reason: null,
      canceled_reason: null,
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-120),
      updated_at: at(-120)
    },
    {
      id: ids.requestReminderRider1,
      request_code: requestCode("MNT", 6),
      rider_id: rider1,
      motorcycle_id: ids.motorcycleRider1Main,
      service_type: "periodic_maintenance",
      fulfillment_mode: null,
      problem_description: "Yêu cầu bảo dưỡng được tạo từ nhắc lịch thay dầu.",
      status: "submitted",
      priority: "normal",
      longitude: null,
      latitude: null,
      address_text: null,
      scheduled_start_at: null,
      safety_answers: null,
      maintenance_notes: "Kiểm tra dầu máy, lọc gió và áp suất lốp.",
      manual_escalation_reason: null,
      canceled_reason: null,
      reminder_id: ids.reminderRider1Recurring,
      reminder_context_id: ids.occurrenceRider1Sent,
      created_at: at(-1_180),
      updated_at: at(-1_180)
    },
    {
      id: ids.requestSubmittedRider2,
      request_code: requestCode("MOB", 7),
      rider_id: rider2,
      motorcycle_id: ids.motorcycleRider2Main,
      service_type: "mobile_repair",
      fulfillment_mode: null,
      problem_description: "Xe đề yếu vào buổi sáng, cần kiểm tra bình ắc quy.",
      status: "submitted",
      priority: "normal",
      longitude: 106.8416,
      latitude: 10.8431,
      address_text: "The Beverly, Vinhomes Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: null,
      safety_answers: json({ smoke: false, fuel_leak: false }),
      maintenance_notes: null,
      manual_escalation_reason: null,
      canceled_reason: null,
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-45),
      updated_at: at(-45)
    },
    {
      id: ids.requestEscalatedRider2,
      request_code: requestCode("EMR", 8),
      rider_id: rider2,
      motorcycle_id: ids.motorcycleRider2Main,
      service_type: "emergency_rescue",
      fulfillment_mode: null,
      problem_description: "Xe không nổ máy, vòng dispatch trước đã hết hạn.",
      status: "manual_escalation",
      priority: "emergency",
      longitude: 106.845,
      latitude: 10.847,
      address_text: "Cổng The Origami, Vinhomes Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: null,
      safety_answers: json({ safe_position: true, smoke: false }),
      maintenance_notes: null,
      manual_escalation_reason: "Không có kỹ thuật viên nhận sau các vòng dispatch.",
      canceled_reason: null,
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-1_500),
      updated_at: at(-1_100)
    },
    {
      id: ids.requestCompletedRider2,
      request_code: requestCode("MOB", 9),
      rider_id: rider2,
      motorcycle_id: ids.motorcycleRider2Main,
      service_type: "mobile_repair",
      fulfillment_mode: null,
      problem_description: "Thay bugi và vệ sinh lọc gió.",
      status: "completed",
      priority: "normal",
      longitude: 106.8405,
      latitude: 10.8419,
      address_text: "The Rainbow, Vinhomes Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: null,
      safety_answers: null,
      maintenance_notes: null,
      manual_escalation_reason: null,
      canceled_reason: null,
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-20_160),
      updated_at: at(-19_900)
    },
    {
      id: ids.requestOtherRider2,
      request_code: requestCode("OTH", 10),
      rider_id: rider2,
      motorcycle_id: ids.motorcycleRider2Second,
      service_type: "other",
      fulfillment_mode: "scheduled_visit",
      problem_description: "Kiểm tra tổng quát xe điện trước chuyến đi.",
      status: "submitted",
      priority: "normal",
      longitude: null,
      latitude: null,
      address_text: "S10.03 Vinhomes Grand Park, TP Thủ Đức, TP.HCM",
      scheduled_start_at: at(4_320),
      safety_answers: null,
      maintenance_notes: "Kiểm tra pin, phanh và lốp.",
      manual_escalation_reason: null,
      canceled_reason: null,
      reminder_id: null,
      reminder_context_id: null,
      created_at: at(-90),
      updated_at: at(-90)
    }
  ];

  for (const request of requests) {
    await tx`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type, fulfillment_mode,
        problem_description, status, priority, service_location, address_text,
        scheduled_start_at, safety_answers, maintenance_notes,
        manual_escalation_reason, canceled_reason, reminder_id, reminder_context_id,
        created_at, updated_at
      )
      values (
        ${request.id}, ${request.request_code}, ${request.rider_id}, ${request.motorcycle_id},
        ${request.service_type}, ${request.fulfillment_mode}, ${request.problem_description},
        ${request.status}, ${request.priority},
        ${
          request.longitude === null
            ? null
            : tx`ST_SetSRID(ST_MakePoint(${request.longitude}, ${request.latitude}), 4326)::geography`
        },
        ${request.address_text}, ${request.scheduled_start_at}, ${request.safety_answers},
        ${request.maintenance_notes}, ${request.manual_escalation_reason},
        ${request.canceled_reason}, ${request.reminder_id}, ${request.reminder_context_id},
        ${request.created_at}, ${request.updated_at}
      )
      on conflict (id) do update set
        problem_description = excluded.problem_description,
        status = excluded.status,
        priority = excluded.priority,
        service_location = excluded.service_location,
        address_text = excluded.address_text,
        scheduled_start_at = excluded.scheduled_start_at,
        safety_answers = excluded.safety_answers,
        maintenance_notes = excluded.maintenance_notes,
        manual_escalation_reason = excluded.manual_escalation_reason,
        canceled_reason = excluded.canceled_reason,
        updated_at = excluded.updated_at
    `;
  }
}

async function insertRequestHistory(tx, context) {
  const { rider1, rider2, mechanic1, mechanic2, at } = context;
  const rows = [
    history("90000000-0000-4000-8000-000000000001", ids.requestOffered, null, "submitted", rider1, "Tạo yêu cầu.", at(-20)),
    history("90000000-0000-4000-8000-000000000002", ids.requestOffered, "submitted", "dispatching", rider1, "Bắt đầu tìm thợ.", at(-12)),
    history("90000000-0000-4000-8000-000000000003", ids.requestOffered, "dispatching", "offered", null, "Đã gửi offer.", at(-8)),
    history("90000000-0000-4000-8000-000000000004", ids.requestAwaitingQuote, null, "submitted", rider1, "Tạo yêu cầu.", at(-300)),
    history("90000000-0000-4000-8000-000000000005", ids.requestAwaitingQuote, "submitted", "assigned", mechanic1, "Thợ nhận việc.", at(-270)),
    history("90000000-0000-4000-8000-000000000006", ids.requestAwaitingQuote, "assigned", "mechanic_en_route", mechanic1, "Thợ đang đến.", at(-250)),
    history("90000000-0000-4000-8000-000000000007", ids.requestAwaitingQuote, "mechanic_en_route", "in_service", mechanic1, "Bắt đầu kiểm tra.", at(-220)),
    history("90000000-0000-4000-8000-000000000008", ids.requestAwaitingQuote, "in_service", "awaiting_quote_approval", mechanic1, "Đã gửi báo giá.", at(-25)),
    history("90000000-0000-4000-8000-000000000009", ids.requestCompletedRider1, null, "submitted", rider1, "Tạo yêu cầu.", at(-10_080)),
    history("90000000-0000-4000-8000-000000000010", ids.requestCompletedRider1, "in_service", "completed", mechanic1, "Hoàn tất vá lốp.", at(-9_900)),
    history("90000000-0000-4000-8000-000000000011", ids.requestCanceledRider1, null, "submitted", rider1, "Tạo yêu cầu.", at(-2_880)),
    history("90000000-0000-4000-8000-000000000012", ids.requestCanceledRider1, "submitted", "canceled", rider1, "Rider hủy.", at(-2_850)),
    history("90000000-0000-4000-8000-000000000013", ids.requestScheduledRider1, null, "submitted", rider1, "Đặt lịch tại nhà.", at(-120)),
    history("90000000-0000-4000-8000-000000000014", ids.requestReminderRider1, null, "submitted", rider1, "Tạo từ reminder.", at(-1_180)),
    history("90000000-0000-4000-8000-000000000015", ids.requestSubmittedRider2, null, "submitted", rider2, "Tạo yêu cầu.", at(-45)),
    history("90000000-0000-4000-8000-000000000016", ids.requestEscalatedRider2, null, "submitted", rider2, "Tạo yêu cầu.", at(-1_500)),
    history("90000000-0000-4000-8000-000000000017", ids.requestEscalatedRider2, "offered", "manual_escalation", null, "Hết thời gian dispatch.", at(-1_100)),
    history("90000000-0000-4000-8000-000000000018", ids.requestCompletedRider2, null, "submitted", rider2, "Tạo yêu cầu.", at(-20_160)),
    history("90000000-0000-4000-8000-000000000019", ids.requestCompletedRider2, "in_service", "completed", mechanic2, "Hoàn tất sửa chữa.", at(-19_900)),
    history("90000000-0000-4000-8000-000000000020", ids.requestOtherRider2, null, "submitted", rider2, "Đặt lịch kiểm tra.", at(-90))
  ];
  await tx`
    insert into request_status_history ${tx(
      rows,
      "id",
      "request_id",
      "from_status",
      "to_status",
      "actor_id",
      "reason",
      "created_at"
    )}
    on conflict (id) do nothing
  `;
}

async function insertDispatchAndAssignments(tx, context) {
  const { mechanic1, mechanic2, at } = context;
  const rounds = [
    {
      id: ids.roundOffered,
      request_id: ids.requestOffered,
      round_number: 1,
      radius_m: 2000,
      status: "active",
      started_at: at(-10),
      expires_at: at(50),
      completed_at: null
    },
    {
      id: ids.roundAwaitingQuote,
      request_id: ids.requestAwaitingQuote,
      round_number: 1,
      radius_m: 2000,
      status: "accepted",
      started_at: at(-290),
      expires_at: at(-230),
      completed_at: at(-270)
    },
    {
      id: ids.roundCompletedRider1,
      request_id: ids.requestCompletedRider1,
      round_number: 1,
      radius_m: 2000,
      status: "accepted",
      started_at: at(-10_070),
      expires_at: at(-10_010),
      completed_at: at(-10_060)
    },
    {
      id: ids.roundEscalatedRider2,
      request_id: ids.requestEscalatedRider2,
      round_number: 4,
      radius_m: 12000,
      status: "expired",
      started_at: at(-1_170),
      expires_at: at(-1_110),
      completed_at: at(-1_110)
    },
    {
      id: ids.roundCompletedRider2,
      request_id: ids.requestCompletedRider2,
      round_number: 1,
      radius_m: 2000,
      status: "accepted",
      started_at: at(-20_150),
      expires_at: at(-20_090),
      completed_at: at(-20_140)
    }
  ];
  await tx`
    insert into dispatch_rounds ${tx(
      rounds,
      "id",
      "request_id",
      "round_number",
      "radius_m",
      "status",
      "started_at",
      "expires_at",
      "completed_at"
    )}
    on conflict (id) do update set
      status = excluded.status,
      expires_at = excluded.expires_at,
      completed_at = excluded.completed_at
  `;

  const candidates = [
    candidate(ids.candidateOfferedMechanic2, ids.roundOffered, ids.requestOffered, mechanic2, 1, 850, "offered", at(-8), at(50), null),
    candidate(ids.candidateAwaitingQuoteMechanic1, ids.roundAwaitingQuote, ids.requestAwaitingQuote, mechanic1, 1, 620, "accepted", at(-280), at(-220), at(-270)),
    candidate(ids.candidateCompletedMechanic1, ids.roundCompletedRider1, ids.requestCompletedRider1, mechanic1, 1, 1_100, "accepted", at(-10_065), at(-10_005), at(-10_060)),
    candidate(ids.candidateExpiredMechanic2, ids.roundEscalatedRider2, ids.requestEscalatedRider2, mechanic2, 1, 5_400, "expired", at(-1_170), at(-1_110), at(-1_110)),
    candidate(ids.candidateCompletedMechanic2, ids.roundCompletedRider2, ids.requestCompletedRider2, mechanic2, 1, 730, "accepted", at(-20_145), at(-20_085), at(-20_140))
  ];
  await tx`
    insert into dispatch_candidates ${tx(
      candidates,
      "id",
      "round_id",
      "request_id",
      "mechanic_id",
      "rank",
      "distance_m",
      "status",
      "offered_at",
      "expires_at",
      "responded_at",
      "created_at"
    )}
    on conflict (id) do update set
      distance_m = excluded.distance_m,
      status = excluded.status,
      offered_at = excluded.offered_at,
      expires_at = excluded.expires_at,
      responded_at = excluded.responded_at
  `;

  const assignments = [
    {
      id: ids.assignmentAwaitingQuote,
      request_id: ids.requestAwaitingQuote,
      mechanic_id: mechanic1,
      accepted_candidate_id: ids.candidateAwaitingQuoteMechanic1,
      status: "quoted",
      accepted_at: at(-270),
      started_at: at(-220),
      completed_at: null,
      canceled_at: null,
      created_at: at(-270),
      updated_at: at(-25)
    },
    {
      id: ids.assignmentCompletedRider1,
      request_id: ids.requestCompletedRider1,
      mechanic_id: mechanic1,
      accepted_candidate_id: ids.candidateCompletedMechanic1,
      status: "completed",
      accepted_at: at(-10_060),
      started_at: at(-10_030),
      completed_at: at(-9_900),
      canceled_at: null,
      created_at: at(-10_060),
      updated_at: at(-9_900)
    },
    {
      id: ids.assignmentCompletedRider2,
      request_id: ids.requestCompletedRider2,
      mechanic_id: mechanic2,
      accepted_candidate_id: ids.candidateCompletedMechanic2,
      status: "completed",
      accepted_at: at(-20_140),
      started_at: at(-20_100),
      completed_at: at(-19_900),
      canceled_at: null,
      created_at: at(-20_140),
      updated_at: at(-19_900)
    }
  ];
  await tx`
    insert into assignments ${tx(
      assignments,
      "id",
      "request_id",
      "mechanic_id",
      "accepted_candidate_id",
      "status",
      "accepted_at",
      "started_at",
      "completed_at",
      "canceled_at",
      "created_at",
      "updated_at"
    )}
    on conflict (id) do update set
      status = excluded.status,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      canceled_at = excluded.canceled_at,
      updated_at = excluded.updated_at
  `;

  const assignmentHistoryRows = [
    assignmentHistory("91000000-0000-4000-8000-000000000001", ids.assignmentAwaitingQuote, null, "accepted", mechanic1, "mechanic", at(-270)),
    assignmentHistory("91000000-0000-4000-8000-000000000002", ids.assignmentAwaitingQuote, "accepted", "en_route", mechanic1, "mechanic", at(-250)),
    assignmentHistory("91000000-0000-4000-8000-000000000003", ids.assignmentAwaitingQuote, "en_route", "on_site", mechanic1, "mechanic", at(-225)),
    assignmentHistory("91000000-0000-4000-8000-000000000004", ids.assignmentAwaitingQuote, "on_site", "diagnosis", mechanic1, "mechanic", at(-210)),
    assignmentHistory("91000000-0000-4000-8000-000000000005", ids.assignmentAwaitingQuote, "diagnosis", "quoted", mechanic1, "mechanic", at(-25)),
    assignmentHistory("91000000-0000-4000-8000-000000000006", ids.assignmentCompletedRider1, null, "accepted", mechanic1, "mechanic", at(-10_060)),
    assignmentHistory("91000000-0000-4000-8000-000000000007", ids.assignmentCompletedRider1, "in_progress", "completed", mechanic1, "mechanic", at(-9_900)),
    assignmentHistory("91000000-0000-4000-8000-000000000008", ids.assignmentCompletedRider2, null, "accepted", mechanic2, "mechanic", at(-20_140)),
    assignmentHistory("91000000-0000-4000-8000-000000000009", ids.assignmentCompletedRider2, "in_progress", "completed", mechanic2, "mechanic", at(-19_900))
  ];
  await tx`
    insert into assignment_status_history ${tx(
      assignmentHistoryRows,
      "id",
      "assignment_id",
      "from_status",
      "to_status",
      "actor_id",
      "actor_role",
      "reason",
      "created_at"
    )}
    on conflict (id) do nothing
  `;
}

async function insertDiagnosesAndQuotes(tx, context) {
  const { mechanic1, mechanic2, at } = context;
  const diagnoses = [
    {
      id: ids.diagnosisAwaitingQuote,
      assignment_id: ids.assignmentAwaitingQuote,
      request_id: ids.requestAwaitingQuote,
      mechanic_id: mechanic1,
      diagnosis_text: "Má phanh trước đã mòn và bề mặt đĩa phanh bám bụi.",
      recommended_work_text: "Thay má phanh trước và vệ sinh cụm phanh.",
      safety_notes: "Hạn chế chạy nhanh trước khi hoàn tất sửa chữa.",
      created_at: at(-200),
      updated_at: at(-200)
    },
    {
      id: ids.diagnosisCompletedRider1,
      assignment_id: ids.assignmentCompletedRider1,
      request_id: ids.requestCompletedRider1,
      mechanic_id: mechanic1,
      diagnosis_text: "Lốp sau thủng do một đinh nhỏ, thành lốp còn tốt.",
      recommended_work_text: "Vá trong lốp và kiểm tra áp suất.",
      safety_notes: "Theo dõi áp suất lốp trong 24 giờ.",
      created_at: at(-10_000),
      updated_at: at(-10_000)
    },
    {
      id: ids.diagnosisCompletedRider2,
      assignment_id: ids.assignmentCompletedRider2,
      request_id: ids.requestCompletedRider2,
      mechanic_id: mechanic2,
      diagnosis_text: "Bugi bám muội và lọc gió nhiều bụi.",
      recommended_work_text: "Thay bugi và vệ sinh lọc gió.",
      safety_notes: null,
      created_at: at(-20_050),
      updated_at: at(-20_050)
    }
  ];
  await tx`
    insert into mechanic_diagnoses ${tx(
      diagnoses,
      "id",
      "assignment_id",
      "request_id",
      "mechanic_id",
      "diagnosis_text",
      "recommended_work_text",
      "safety_notes",
      "created_at",
      "updated_at"
    )}
    on conflict (id) do nothing
  `;

  const quotes = [
    quote(ids.quoteRejected, ids.requestAwaitingQuote, ids.assignmentAwaitingQuote, ids.diagnosisAwaitingQuote, 1, "rejected", 400_000, 0, mechanic1, at(-180), at(-150), "Phương án thay cả đĩa phanh đã bị từ chối."),
    quote(ids.quotePending, ids.requestAwaitingQuote, ids.assignmentAwaitingQuote, ids.diagnosisAwaitingQuote, 2, "pending", 280_000, 20_000, mechanic1, at(-25), null, "Báo giá điều chỉnh chỉ thay má phanh."),
    quote(ids.quoteApprovedRider1, ids.requestCompletedRider1, ids.assignmentCompletedRider1, ids.diagnosisCompletedRider1, 1, "approved", 120_000, 0, mechanic1, at(-9_990), at(-9_970), "Đã thanh toán ngoài phạm vi MVP."),
    quote(ids.quoteApprovedRider2, ids.requestCompletedRider2, ids.assignmentCompletedRider2, ids.diagnosisCompletedRider2, 1, "approved", 350_000, 0, mechanic2, at(-20_030), at(-20_000), "Báo giá đã được rider đồng ý.")
  ];
  await tx`
    insert into quotes ${tx(
      quotes,
      "id",
      "request_id",
      "assignment_id",
      "diagnosis_id",
      "version",
      "status",
      "currency",
      "subtotal_amount",
      "discount_amount",
      "total_amount",
      "notes",
      "expires_at",
      "created_by",
      "created_at",
      "responded_at"
    )}
    on conflict (id) do nothing
  `;

  const quoteLines = [
    quoteLine("63000000-0000-4000-8000-000000000001", ids.quoteRejected, "part", "Đĩa phanh trước", 1, 300_000, 0),
    quoteLine("63000000-0000-4000-8000-000000000002", ids.quoteRejected, "labor", "Công thay và vệ sinh", 1, 100_000, 1),
    quoteLine("63000000-0000-4000-8000-000000000003", ids.quotePending, "part", "Bộ má phanh trước", 1, 200_000, 0),
    quoteLine("63000000-0000-4000-8000-000000000004", ids.quotePending, "labor", "Công thay và vệ sinh", 1, 80_000, 1),
    quoteLine("63000000-0000-4000-8000-000000000005", ids.quoteApprovedRider1, "labor", "Vá trong lốp sau", 1, 120_000, 0),
    quoteLine("63000000-0000-4000-8000-000000000006", ids.quoteApprovedRider2, "part", "Bugi tiêu chuẩn", 1, 150_000, 0),
    quoteLine("63000000-0000-4000-8000-000000000007", ids.quoteApprovedRider2, "labor", "Thay bugi và vệ sinh lọc gió", 1, 200_000, 1)
  ];
  await tx`
    insert into quote_lines ${tx(
      quoteLines,
      "id",
      "quote_id",
      "line_type",
      "description",
      "quantity",
      "unit_amount",
      "line_total_amount",
      "sort_order"
    )}
    on conflict (id) do nothing
  `;
}

async function insertChatbotFixtures(tx, context) {
  const { rider1, rider2, at } = context;
  await tx`
    insert into chatbot_sessions ${tx(
      [
        { id: ids.chatbotSessionRider1, owner_user_id: rider1, created_at: at(-500), updated_at: at(-490) },
        { id: ids.chatbotSessionRider2, owner_user_id: rider2, created_at: at(-400), updated_at: at(-390) }
      ],
      "id",
      "owner_user_id",
      "created_at",
      "updated_at"
    )}
    on conflict (id) do update set updated_at = excluded.updated_at
  `;
  await tx`
    insert into chatbot_messages ${tx(
      [
        {
          id: ids.chatbotMessageRider1,
          session_id: ids.chatbotSessionRider1,
          input_mode: "text",
          content_text: "Xe đề yếu và đèn bị mờ",
          transcribed_text: null,
          normalized_text: "xe de yeu va den bi mo",
          safety_answers: json({ smoke: false }),
          created_at: at(-495)
        },
        {
          id: ids.chatbotMessageRider2,
          session_id: ids.chatbotSessionRider2,
          input_mode: "voice",
          content_text: null,
          transcribed_text: "Phanh xe phát tiếng kêu",
          normalized_text: "phanh xe phat tieng keu",
          safety_answers: json({ brake_effective: true }),
          created_at: at(-395)
        }
      ],
      "id",
      "session_id",
      "input_mode",
      "content_text",
      "transcribed_text",
      "normalized_text",
      "safety_answers",
      "created_at"
    )}
    on conflict (id) do nothing
  `;

  const diagnosisRider1 = {
    short_answer: "Khả năng cao bình ắc quy yếu hoặc hệ thống sạc hoạt động không ổn định.",
    overall_confidence: 0.82,
    risk_level: "medium",
    can_continue_riding: false,
    top_hypotheses: [
      {
        rank: 1,
        component_code: "BATTERY",
        cause: "Ắc quy yếu",
        symptoms: "Đề yếu và đèn mờ",
        consequences: "Xe có thể không khởi động được",
        confidence: 0.82,
        estimated_cost_min: 300_000,
        estimated_cost_max: 650_000
      }
    ],
    estimated_total: { currency: "VND", min: 300_000, max: 650_000 },
    recommended_next_actions: [
      { type: "book_mobile_repair", label: "Đặt thợ kiểm tra ắc quy và hệ thống sạc" }
    ],
    followup_questions: ["Ắc quy đã sử dụng bao lâu?"],
    fallback_used: false
  };
  const diagnosisRider2 = {
    short_answer: "Tiếng kêu phanh có thể do má phanh mòn hoặc bám bụi.",
    overall_confidence: 0.74,
    risk_level: "medium",
    can_continue_riding: false,
    top_hypotheses: [
      {
        rank: 1,
        component_code: "BRAKE_SYSTEM",
        cause: "Má phanh mòn hoặc bám bụi",
        symptoms: "Phanh phát tiếng kêu",
        consequences: "Hiệu quả phanh có thể giảm",
        confidence: 0.74,
        estimated_cost_min: 100_000,
        estimated_cost_max: 450_000
      }
    ],
    estimated_total: { currency: "VND", min: 100_000, max: 450_000 },
    recommended_next_actions: [
      { type: "book_mobile_repair", label: "Đặt thợ kiểm tra cụm phanh" }
    ],
    followup_questions: ["Phanh có bị yếu hoặc rung không?"],
    transcribed_text: "Phanh xe phát tiếng kêu",
    fallback_used: true
  };
  await tx`
    insert into diagnosis_results ${tx(
      [
        {
          id: ids.chatbotDiagnosisRider1,
          session_id: ids.chatbotSessionRider1,
          message_id: ids.chatbotMessageRider1,
          result: json(diagnosisRider1),
          risk_level: "medium",
          fallback_used: false,
          provider_name: "gemini",
          provider_model: "mock-seed-model",
          created_at: at(-490)
        },
        {
          id: ids.chatbotDiagnosisRider2,
          session_id: ids.chatbotSessionRider2,
          message_id: ids.chatbotMessageRider2,
          result: json(diagnosisRider2),
          risk_level: "medium",
          fallback_used: true,
          provider_name: null,
          provider_model: null,
          created_at: at(-390)
        }
      ],
      "id",
      "session_id",
      "message_id",
      "result",
      "risk_level",
      "fallback_used",
      "provider_name",
      "provider_model",
      "created_at"
    )}
    on conflict (id) do nothing
  `;
}

async function insertOperationalFixtures(tx, context) {
  const { rider1, mechanic1, at } = context;
  await tx`
    insert into idempotency_records (
      id, actor_id, scope, idempotency_key, request_hash, response_status,
      response_body, resource_type, resource_id, expires_at, created_at, completed_at
    )
    values (
      ${ids.idempotencyRequest}, ${rider1}, 'service_requests.create',
      'mock-seed-request-rider1-001', ${"a".repeat(64)}, 201,
      ${json({ resource_id: ids.requestOffered, replay: true })},
      'service_request', ${ids.requestOffered}, ${at(1_440)}, ${at(-20)}, ${at(-20)}
    )
    on conflict (id) do update set expires_at = excluded.expires_at
  `;

  const outbox = [
    {
      id: ids.outboxPending,
      topic: "notification.created",
      aggregate_type: "notification",
      aggregate_id: ids.notificationRider1Pending,
      dedupe_key: "mock:outbox:notification:pending",
      payload: json({ notification_id: ids.notificationRider1Pending, user_id: rider1 }),
      status: "pending",
      attempt_count: 0,
      next_attempt_at: at(5),
      lease_owner: null,
      lease_expires_at: null,
      last_error_code: null,
      created_at: at(-30),
      processed_at: null
    },
    {
      id: ids.outboxProcessed,
      topic: "service_request.created",
      aggregate_type: "service_request",
      aggregate_id: ids.requestOffered,
      dedupe_key: "mock:outbox:service-request:processed",
      payload: json({ resource_id: ids.requestOffered, status: "submitted" }),
      status: "processed",
      attempt_count: 1,
      next_attempt_at: at(-19),
      lease_owner: null,
      lease_expires_at: null,
      last_error_code: null,
      created_at: at(-20),
      processed_at: at(-19)
    },
    {
      id: ids.outboxDeadLetter,
      topic: "notification.delivery.requested",
      aggregate_type: "notification",
      aggregate_id: ids.notificationRider2Failed,
      dedupe_key: "mock:outbox:notification:dead-letter",
      payload: json({ notification_id: ids.notificationRider2Failed }),
      status: "dead_letter",
      attempt_count: 5,
      next_attempt_at: at(-700),
      lease_owner: null,
      lease_expires_at: null,
      last_error_code: "MOCK_MAX_ATTEMPTS",
      created_at: at(-720),
      processed_at: null
    }
  ];
  await tx`
    insert into outbox_events ${tx(
      outbox,
      "id",
      "topic",
      "aggregate_type",
      "aggregate_id",
      "dedupe_key",
      "payload",
      "status",
      "attempt_count",
      "next_attempt_at",
      "lease_owner",
      "lease_expires_at",
      "last_error_code",
      "created_at",
      "processed_at"
    )}
    on conflict (id) do nothing
  `;

  await tx`
    insert into audit_logs ${tx(
      [
        {
          id: ids.auditRider,
          actor_id: rider1,
          actor_role: "rider",
          action: "service_request.created",
          entity_type: "service_request",
          entity_id: ids.requestOffered,
          request_id: "mock-seed-rider-request",
          metadata: json({ resource_id: ids.requestOffered, service_type: "emergency_rescue" }),
          created_at: at(-20)
        },
        {
          id: ids.auditMechanic,
          actor_id: mechanic1,
          actor_role: "mechanic",
          action: "quote.created",
          entity_type: "quote",
          entity_id: ids.quotePending,
          request_id: "mock-seed-mechanic-quote",
          metadata: json({ resource_id: ids.quotePending, version: 2, total_amount: 260_000 }),
          created_at: at(-25)
        }
      ],
      "id",
      "actor_id",
      "actor_role",
      "action",
      "entity_type",
      "entity_id",
      "request_id",
      "metadata",
      "created_at"
    )}
    on conflict (id) do nothing
  `;
}

async function assertRequiredSchema(db) {
  const requiredTables = [
    "app_users",
    "motorcycles",
    "service_requests",
    "dispatch_candidates",
    "assignments",
    "mechanic_diagnoses",
    "quotes",
    "reminder_rules",
    "notifications",
    "chatbot_sessions"
  ];
  const rows = await db`
    select tablename
    from pg_tables
    where schemaname = current_schema()
      and tablename in ${db(requiredTables)}
  `;
  const found = new Set(rows.map((row) => row.tablename));
  const missing = requiredTables.filter((table) => !found.has(table));
  if (missing.length > 0) {
    throw new Error(
      `Database is missing required migrations for: ${missing.join(", ")}. Apply migrations 001-014 before seeding.`
    );
  }
}

async function printVerification(db, authUsers) {
  const authEmails = new Set((Array.isArray(authUsers) ? authUsers : Object.values(authUsers)).map((user) => user.email?.toLowerCase()));
  const accountStatus = accounts.map((account) => ({
    email: account.email,
    auth: authEmails.has(account.email.toLowerCase()) ? "ok" : "missing"
  }));
  const counts = await db`
    select
      (select count(*)::int from app_users where display_name like '%Grand Park%' or display_name like '%Rider%') as app_users,
      (select count(*)::int from motorcycles where id::text like '20000000-%') as motorcycles,
      (select count(*)::int from service_requests where id::text like '40000000-%') as service_requests,
      (select count(*)::int from dispatch_candidates where id::text like '51000000-%') as dispatch_candidates,
      (select count(*)::int from assignments where id::text like '60000000-%') as assignments,
      (select count(*)::int from quotes where id::text like '62000000-%') as quotes,
      (select count(*)::int from reminder_rules where id::text like '30000000-%') as reminder_rules,
      (select count(*)::int from notifications where id::text like '31000000-%') as notifications,
      (select count(*)::int from chatbot_sessions where id::text like '70000000-%') as chatbot_sessions
  `;

  console.log("Mock auth accounts:", accountStatus);
  console.log("Mock database counts:", counts[0]);
  if (accountStatus.some((account) => account.auth !== "ok")) {
    process.exitCode = 1;
  }
}

function deviceRow(id, userId, email, platform, now) {
  return {
    id,
    user_id: userId,
    device_key_hash: createHash("sha256").update(`careonroad-mock-device:${email}`).digest("hex"),
    platform,
    enabled: true,
    last_registered_at: now,
    created_at: now,
    updated_at: now
  };
}

function candidate(id, roundId, requestId, mechanicId, rank, distance, status, offeredAt, expiresAt, respondedAt) {
  return {
    id,
    round_id: roundId,
    request_id: requestId,
    mechanic_id: mechanicId,
    rank,
    distance_m: distance,
    status,
    offered_at: offeredAt,
    expires_at: expiresAt,
    responded_at: respondedAt,
    created_at: offeredAt
  };
}

function history(id, requestId, fromStatus, toStatus, actorId, reason, createdAt) {
  return {
    id,
    request_id: requestId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
    reason,
    created_at: createdAt
  };
}

function assignmentHistory(id, assignmentId, fromStatus, toStatus, actorId, actorRole, createdAt) {
  return {
    id,
    assignment_id: assignmentId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
    actor_role: actorRole,
    reason: "Mock workflow fixture.",
    created_at: createdAt
  };
}

function quote(id, requestId, assignmentId, diagnosisId, version, status, subtotal, discount, createdBy, createdAt, respondedAt, notes) {
  return {
    id,
    request_id: requestId,
    assignment_id: assignmentId,
    diagnosis_id: diagnosisId,
    version,
    status,
    currency: "VND",
    subtotal_amount: subtotal,
    discount_amount: discount,
    total_amount: subtotal - discount,
    notes,
    expires_at: new Date(createdAt.getTime() + 24 * 60 * 60 * 1_000),
    created_by: createdBy,
    created_at: createdAt,
    responded_at: respondedAt
  };
}

function quoteLine(id, quoteId, lineType, description, quantity, unitAmount, sortOrder) {
  return {
    id,
    quote_id: quoteId,
    line_type: lineType,
    description,
    quantity,
    unit_amount: unitAmount,
    line_total_amount: Math.round(quantity * unitAmount),
    sort_order: sortOrder
  };
}

function requestCode(prefix, sequence) {
  return `COR-${prefix}-20260701-${900_000 + sequence}`;
}

function json(value) {
  return value;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function loadLocalEnvironment() {
  if (!existsSync(".env.local")) {
    return;
  }
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env.local");
    return;
  }

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) {
      continue;
    }
    const raw = match[2];
    process.env[match[1]] =
      (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
  }
}
