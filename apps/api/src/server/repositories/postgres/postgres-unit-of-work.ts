import type { Sql } from "postgres";

import { runInTransaction, type TransactionOptions } from "@/server/db/transaction";

import type { FoundationRepositories, UnitOfWork } from "../contracts/unit-of-work";
import { PostgresAdminSupervisionRepository } from "./admin-supervision.repository";
import { PostgresAdminConfigurationRepository } from "./admin-configuration.repository";
import { PostgresAdminInternalNoteRepository } from "./admin-internal-note.repository";
import { PostgresAdminQueryRepository } from "./admin-query.repository";
import { PostgresAssignmentRepository } from "./assignment.repository";
import { PostgresAuditRepository } from "./audit.repository";
import { PostgresChatbotSessionRepository } from "./chatbot-session.repository";
import { PostgresDispatchRepository } from "./dispatch.repository";
import { PostgresDeviceDeliveryCredentialRepository } from "./device-delivery-credential.repository";
import { PostgresDiagnosisRepository } from "./diagnosis.repository";
import { PostgresIdempotencyRepository } from "./idempotency.repository";
import { PostgresMechanicOperationsRepository } from "./mechanic-operations.repository";
import { PostgresMechanicRepository } from "./mechanic.repository";
import { PostgresMediaUploadIntentRepository } from "./media-upload-intent.repository";
import { PostgresLiveTrackingRepository } from "./live-tracking.repository";
import { PostgresMotorcycleRepository } from "./motorcycle.repository";
import { PostgresNotificationRepository } from "./notification.repository";
import { PostgresNotificationDeliveryRepository } from "./notification-delivery.repository";
import { PostgresOutboxRepository } from "./outbox.repository";
import { PostgresOperationalMonitoringRepository } from "./operational-monitoring.repository";
import { PostgresPaymentRepository } from "./payment.repository";
import { PostgresQuoteRepository } from "./quote.repository";
import { PostgresRequestCodeRepository } from "./request-code.repository";
import { PostgresRequestMediaRepository } from "./request-media.repository";
import { PostgresReminderRepository } from "./reminder.repository";
import { PostgresReviewRepository } from "./review.repository";
import { PostgresServiceRequestRepository } from "./service-request.repository";
import { PostgresUserRepository } from "./user.repository";

export class PostgresUnitOfWork implements UnitOfWork {
  constructor(
    private readonly sql: Pick<Sql, "begin">,
    private readonly transactionOptions: TransactionOptions = {}
  ) {}

  execute<T>(work: (repositories: FoundationRepositories) => Promise<T>): Promise<T> {
    return runInTransaction(
      this.sql,
      async (transaction) =>
        work({
          adminConfiguration: new PostgresAdminConfigurationRepository(transaction),
          adminSupervision: new PostgresAdminSupervisionRepository(transaction),
          adminQueries: new PostgresAdminQueryRepository(transaction),
          adminInternalNotes: new PostgresAdminInternalNoteRepository(transaction),
          users: new PostgresUserRepository(transaction),
          idempotency: new PostgresIdempotencyRepository(transaction),
          outbox: new PostgresOutboxRepository(transaction),
          operationalMonitoring: new PostgresOperationalMonitoringRepository(transaction),
          audit: new PostgresAuditRepository(transaction),
          motorcycles: new PostgresMotorcycleRepository(transaction),
          mechanics: new PostgresMechanicRepository(transaction),
          mediaUploadIntents: new PostgresMediaUploadIntentRepository(transaction),
          liveTracking: new PostgresLiveTrackingRepository(transaction),
          mechanicOperations: new PostgresMechanicOperationsRepository(transaction),
          serviceRequests: new PostgresServiceRequestRepository(transaction),
          requestMedia: new PostgresRequestMediaRepository(transaction),
          requestCodes: new PostgresRequestCodeRepository(transaction),
          dispatch: new PostgresDispatchRepository(transaction),
          deviceDeliveryCredentials: new PostgresDeviceDeliveryCredentialRepository(transaction),
          assignments: new PostgresAssignmentRepository(transaction),
          diagnoses: new PostgresDiagnosisRepository(transaction),
          quotes: new PostgresQuoteRepository(transaction),
          reminders: new PostgresReminderRepository(transaction),
          reviews: new PostgresReviewRepository(transaction),
          notifications: new PostgresNotificationRepository(transaction),
          notificationDeliveries: new PostgresNotificationDeliveryRepository(transaction),
          chatbotSessions: new PostgresChatbotSessionRepository(transaction),
          payments: new PostgresPaymentRepository(transaction)
        }),
      this.transactionOptions
    );
  }
}
