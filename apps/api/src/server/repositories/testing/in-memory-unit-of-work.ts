import { InMemorySessionStore } from "@/features/chatbot/session.store";

import type { Assignment, AssignmentStatusHistory } from "../contracts/assignment.repository";
import type { AdminInternalNote } from "../contracts/admin-internal-note.repository";
import type { AuditLog } from "../contracts/audit.repository";
import type { ChatbotSession } from "../contracts/chatbot-session.repository";
import type { DispatchCandidate, DispatchRound } from "../contracts/dispatch.repository";
import type { DeviceDeliveryCredential } from "../contracts/device-delivery-credential.repository";
import type { MechanicDiagnosis } from "../contracts/diagnosis.repository";
import type { IdempotencyRecord } from "../contracts/idempotency.repository";
import type {
  AssignmentEtaMetadata,
  AssignmentCompletionChecklist,
  AssignmentMediaMetadata
} from "../contracts/mechanic-operations.repository";
import type { MechanicProfile } from "../contracts/mechanic.repository";
import type { MediaUploadIntent } from "../contracts/media-upload-intent.repository";
import type { AssignmentLiveLocation } from "../contracts/live-tracking.repository";
import type { Motorcycle } from "../contracts/motorcycle.repository";
import type { Notification } from "../contracts/notification.repository";
import type { NotificationDeliveryReceipt } from "../contracts/notification-delivery.repository";
import type { OutboxEvent } from "../contracts/outbox.repository";
import type { WorkerRunRecord } from "../contracts/operational-monitoring.repository";
import type { PaymentEvent, PaymentOrder } from "../contracts/payment.repository";
import type { Quote, QuoteLine } from "../contracts/quote.repository";
import type { RequestCodeSequence } from "../contracts/request-code.repository";
import type { RequestMediaMetadata } from "../contracts/request-media.repository";
import type { ReminderOccurrence, ReminderRule } from "../contracts/reminder.repository";
import type { ServiceReview } from "../contracts/review.repository";
import type {
  RequestStatusHistory,
  ServiceRequest
} from "../contracts/service-request.repository";
import type {
  ApplicationUser,
  UserDevice,
  UserRoleRecord
} from "../contracts/user.repository";
import type { FoundationRepositories, UnitOfWork } from "../contracts/unit-of-work";
import { InMemoryAssignmentRepository } from "./in-memory-assignment.repository";
import { InMemoryAdminInternalNoteRepository } from "./in-memory-admin-internal-note.repository";
import { InMemoryAdminQueryRepository } from "./in-memory-admin-query.repository";
import { InMemoryAuditRepository } from "./in-memory-audit.repository";
import { InMemoryDispatchRepository } from "./in-memory-dispatch.repository";
import { InMemoryDeviceDeliveryCredentialRepository } from "./in-memory-device-delivery-credential.repository";
import { InMemoryDiagnosisRepository } from "./in-memory-diagnosis.repository";
import { InMemoryIdempotencyRepository } from "./in-memory-idempotency.repository";
import { InMemoryMechanicOperationsRepository } from "./in-memory-mechanic-operations.repository";
import { InMemoryMechanicRepository } from "./in-memory-mechanic.repository";
import { InMemoryMediaUploadIntentRepository } from "./in-memory-media-upload-intent.repository";
import { InMemoryLiveTrackingRepository } from "./in-memory-live-tracking.repository";
import { InMemoryMotorcycleRepository } from "./in-memory-motorcycle.repository";
import { InMemoryNotificationRepository } from "./in-memory-notification.repository";
import { InMemoryNotificationDeliveryRepository } from "./in-memory-notification-delivery.repository";
import { InMemoryOutboxRepository } from "./in-memory-outbox.repository";
import { InMemoryOperationalMonitoringRepository } from "./in-memory-operational-monitoring.repository";
import { InMemoryPaymentRepository } from "./in-memory-payment.repository";
import { InMemoryQuoteRepository } from "./in-memory-quote.repository";
import { InMemoryRequestCodeRepository } from "./in-memory-request-code.repository";
import { InMemoryRequestMediaRepository } from "./in-memory-request-media.repository";
import { InMemoryReminderRepository } from "./in-memory-reminder.repository";
import { InMemoryReviewRepository } from "./in-memory-review.repository";
import { InMemoryServiceRequestRepository } from "./in-memory-service-request.repository";
import { InMemoryUserRepository } from "./in-memory-user.repository";

export type InMemoryFoundationState = {
  adminInternalNotes: AdminInternalNote[];
  users: ApplicationUser[];
  userRoles: UserRoleRecord[];
  userDevices: UserDevice[];
  deviceDeliveryCredentials: DeviceDeliveryCredential[];
  idempotencyRecords: IdempotencyRecord[];
  outboxEvents: OutboxEvent[];
  workerRuns: WorkerRunRecord[];
  auditLogs: AuditLog[];
  motorcycles: Motorcycle[];
  mechanicProfiles: MechanicProfile[];
  mediaUploadIntents: MediaUploadIntent[];
  assignmentLiveLocations: AssignmentLiveLocation[];
  serviceRequests: ServiceRequest[];
  requestMediaMetadata: RequestMediaMetadata[];
  requestStatusHistory: RequestStatusHistory[];
  dailyRequestSequences: RequestCodeSequence[];
  dispatchRounds: DispatchRound[];
  dispatchCandidates: DispatchCandidate[];
  assignments: Assignment[];
  assignmentStatusHistory: AssignmentStatusHistory[];
  assignmentEtaMetadata: AssignmentEtaMetadata[];
  assignmentMediaMetadata: AssignmentMediaMetadata[];
  assignmentCompletionChecklists: AssignmentCompletionChecklist[];
  mechanicDiagnoses: MechanicDiagnosis[];
  quotes: Quote[];
  quoteLines: QuoteLine[];
  reminderRules: ReminderRule[];
  reminderOccurrences: ReminderOccurrence[];
  serviceReviews: ServiceReview[];
  notifications: Notification[];
  notificationDeliveryReceipts: NotificationDeliveryReceipt[];
  chatbotSessions: ChatbotSession[];
  paymentOrders: PaymentOrder[];
  paymentEvents: PaymentEvent[];
};

export class InMemoryUnitOfWork implements UnitOfWork {
  private state: InMemoryFoundationState;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(initialState: Partial<InMemoryFoundationState> = {}) {
    this.state = cloneState({
      adminInternalNotes: initialState.adminInternalNotes ?? [],
      users: initialState.users ?? [],
      userRoles: initialState.userRoles ?? [],
      userDevices: initialState.userDevices ?? [],
      deviceDeliveryCredentials: initialState.deviceDeliveryCredentials ?? [],
      idempotencyRecords: initialState.idempotencyRecords ?? [],
      outboxEvents: initialState.outboxEvents ?? [],
      workerRuns: initialState.workerRuns ?? [],
      auditLogs: initialState.auditLogs ?? [],
      motorcycles: initialState.motorcycles ?? [],
      mechanicProfiles: initialState.mechanicProfiles ?? [],
      mediaUploadIntents: initialState.mediaUploadIntents ?? [],
      assignmentLiveLocations: initialState.assignmentLiveLocations ?? [],
      serviceRequests: initialState.serviceRequests ?? [],
      requestMediaMetadata: initialState.requestMediaMetadata ?? [],
      requestStatusHistory: initialState.requestStatusHistory ?? [],
      dailyRequestSequences: initialState.dailyRequestSequences ?? [],
      dispatchRounds: initialState.dispatchRounds ?? [],
      dispatchCandidates: initialState.dispatchCandidates ?? [],
      assignments: initialState.assignments ?? [],
      assignmentStatusHistory: initialState.assignmentStatusHistory ?? [],
      assignmentEtaMetadata: initialState.assignmentEtaMetadata ?? [],
      assignmentMediaMetadata: initialState.assignmentMediaMetadata ?? [],
      assignmentCompletionChecklists: initialState.assignmentCompletionChecklists ?? [],
      mechanicDiagnoses: initialState.mechanicDiagnoses ?? [],
      quotes: initialState.quotes ?? [],
      quoteLines: initialState.quoteLines ?? [],
      reminderRules: initialState.reminderRules ?? [],
      reminderOccurrences: initialState.reminderOccurrences ?? [],
      serviceReviews: initialState.serviceReviews ?? [],
      notifications: initialState.notifications ?? [],
      notificationDeliveryReceipts: initialState.notificationDeliveryReceipts ?? [],
      chatbotSessions: initialState.chatbotSessions ?? [],
      paymentOrders: initialState.paymentOrders ?? [],
      paymentEvents: initialState.paymentEvents ?? []
    });
  }

  async execute<T>(work: (repositories: FoundationRepositories) => Promise<T>): Promise<T> {
    let releaseTransaction!: () => void;
    const previousTransaction = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    await previousTransaction;

    try {
      const draft = cloneState(this.state);
      const repositories: FoundationRepositories = {
        adminQueries: new InMemoryAdminQueryRepository({
          notes: draft.adminInternalNotes,
          requests: draft.serviceRequests,
          requestHistory: draft.requestStatusHistory,
          media: draft.requestMediaMetadata,
          rounds: draft.dispatchRounds,
          candidates: draft.dispatchCandidates,
          assignments: draft.assignments,
          quotes: draft.quotes
        }),
        adminInternalNotes: new InMemoryAdminInternalNoteRepository(
          draft.adminInternalNotes
        ),
        users: new InMemoryUserRepository(
          draft.users,
          draft.userRoles,
          draft.userDevices,
          draft.auditLogs
        ),
        idempotency: new InMemoryIdempotencyRepository(draft.idempotencyRecords),
        outbox: new InMemoryOutboxRepository(draft.outboxEvents),
        operationalMonitoring: new InMemoryOperationalMonitoringRepository({
          outboxEvents: draft.outboxEvents,
          paymentOrders: draft.paymentOrders,
          serviceRequests: draft.serviceRequests,
          dispatchRounds: draft.dispatchRounds,
          workerRuns: draft.workerRuns
        }),
        audit: new InMemoryAuditRepository(draft.auditLogs),
        motorcycles: new InMemoryMotorcycleRepository(draft.motorcycles),
        mechanics: new InMemoryMechanicRepository(
          draft.mechanicProfiles,
          draft.assignments
        ),
        mediaUploadIntents: new InMemoryMediaUploadIntentRepository(draft.mediaUploadIntents),
        liveTracking: new InMemoryLiveTrackingRepository(draft.assignmentLiveLocations),
        mechanicOperations: new InMemoryMechanicOperationsRepository(
          draft.mechanicProfiles,
          draft.dispatchCandidates,
          draft.assignments,
          draft.serviceRequests,
          draft.quotes,
          draft.assignmentEtaMetadata,
          draft.assignmentMediaMetadata,
          draft.assignmentCompletionChecklists
        ),
        serviceRequests: new InMemoryServiceRequestRepository(
          draft.serviceRequests,
          draft.requestStatusHistory
        ),
        requestMedia: new InMemoryRequestMediaRepository(draft.requestMediaMetadata),
        requestCodes: new InMemoryRequestCodeRepository(draft.dailyRequestSequences),
        dispatch: new InMemoryDispatchRepository(
          draft.dispatchRounds,
          draft.dispatchCandidates,
          draft.mechanicProfiles
        ),
        deviceDeliveryCredentials: new InMemoryDeviceDeliveryCredentialRepository(
          draft.deviceDeliveryCredentials
        ),
        assignments: new InMemoryAssignmentRepository(
          draft.assignments,
          draft.assignmentStatusHistory,
          draft.serviceRequests
        ),
        diagnoses: new InMemoryDiagnosisRepository(draft.mechanicDiagnoses),
        quotes: new InMemoryQuoteRepository(draft.quotes, draft.quoteLines),
        reminders: new InMemoryReminderRepository(draft.reminderRules, draft.reminderOccurrences),
        reviews: new InMemoryReviewRepository(draft.serviceReviews, draft.mechanicProfiles),
        notifications: new InMemoryNotificationRepository(draft.notifications),
        notificationDeliveries: new InMemoryNotificationDeliveryRepository(
          draft.notificationDeliveryReceipts
        ),
        chatbotSessions: new InMemorySessionStore(draft.chatbotSessions),
        payments: new InMemoryPaymentRepository(draft.paymentOrders, draft.paymentEvents)
      };

      const result = await work(repositories);
      this.state = draft;
      return result;
    } finally {
      releaseTransaction();
    }
  }

  snapshot(): InMemoryFoundationState {
    return cloneState(this.state);
  }
}

function cloneState(state: InMemoryFoundationState): InMemoryFoundationState {
  return structuredClone(state);
}
