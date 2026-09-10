# Feature Specification: CareOnRoad AI Chatbot MVP

**Feature Branch**: `001-careonroad-chatbot-mvp`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Build CareOnRoad AI Chatbot MVP, a Vietnamese AI chatbot demo for motorcycle riders with text input and Vietnamese voice input transcribed locally, returning short advisory diagnosis through backend-controlled safety and fallback."

## Clarifications

### Session 2026-06-16

- Q: What are the final MVP boundaries for vehicle context, voice input, AI routing, failure handling, and storage? -> A: No vehicle selectors; input is Vietnamese text or local Vietnamese voice transcription only; the transcription layer is speech-to-text only; raw audio never goes to the AI diagnosis provider; backend-only diagnosis uses typed or transcribed text; responses stay short; UI shows essential diagnosis only; no production auth, booking, dispatch, payment, mechanic assignment, or production database; transcription failure asks the rider to type or record again; AI provider failure uses rule-based fallback; dangerous symptoms override model output.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Text Symptom Diagnosis (Priority: P1)

As a rider, I want to type my motorcycle problem in Vietnamese, so that I can
quickly understand the likely issue, safety risk, estimated repair cost, and
next action before contacting a mechanic.

**Why this priority**: Text input is the smallest complete demo path and proves
the advisory diagnosis flow, safety gate, structured output, fallback, and UI
disclaimer.

**Independent Test**: Create a demo session, submit a Vietnamese text symptom,
and verify the response contains a short Vietnamese diagnosis card with valid
contract fields, no final quote language, and the advisory disclaimer.

**Acceptance Scenarios**:

1. **Given** a new demo session, **When** the rider submits "xe khó đề và đèn yếu", **Then** the system returns a short Vietnamese diagnosis with risk level, can-continue-riding value, at most 2 hypotheses, VND estimate range, and next action.
2. **Given** a configured AI provider is unavailable or returns invalid output, **When** the rider submits a valid Vietnamese symptom, **Then** the system returns a rule-based fallback diagnosis instead of crashing.
3. **Given** the rider submits a dangerous symptom such as "mất phanh", **When** the diagnosis is returned, **Then** risk is high or critical, can_continue_riding is false, emergency rescue is included, and the short answer tells the rider to stop riding.

---

### User Story 2 - Voice Symptom Diagnosis (Priority: P1)

As a rider, I want to record or send Vietnamese voice input, so that I can get
the same advisory diagnosis without typing.

**Why this priority**: Voice input is explicitly required for the MVP and is a
core accessibility and roadside usability path.

**Independent Test**: Create a demo session, submit a supported Vietnamese audio
file, verify the local transcription appears in the response and UI, and verify
the diagnosis uses only the transcribed text.

**Acceptance Scenarios**:

1. **Given** a new demo session, **When** the rider submits a supported audio file containing Vietnamese symptoms, **Then** the system transcribes the audio locally and returns the transcribed text plus a valid diagnosis card.
2. **Given** transcription fails or returns empty text, **When** the rider submits voice input, **Then** the system returns a clear Vietnamese error asking the rider to type the issue or record again.
3. **Given** voice input contains "xe tắt máy giữa đường", **When** the diagnosis is returned, **Then** the safety override matches the same dangerous-response rules as text input.

---

### User Story 3 - Latest Diagnosis Review (Priority: P2)

As a rider, I want to view the latest diagnosis for my demo session, so that I
can revisit the short advice after sending a message.

**Why this priority**: The chat page needs a simple way to refresh or reopen the
most recent result without creating production accounts or permanent records.

**Independent Test**: Submit a text or voice message, request the latest
diagnosis for the session, and verify it matches the most recent diagnosis.

**Acceptance Scenarios**:

1. **Given** a session has a completed diagnosis, **When** the rider requests the latest diagnosis, **Then** the system returns the latest structured diagnosis for that session.
2. **Given** a session has no diagnosis yet, **When** the rider requests the latest diagnosis, **Then** the system returns a clear empty-state response.

### Edge Cases

- Empty, whitespace-only, or too-short Vietnamese text is rejected with a clear message.
- Voice input with unsupported file type, unreadable audio, failed transcription, or empty transcription returns a clear error asking the rider to type the issue or record again.
- WAV is the preferred voice upload format for the MVP; other formats are accepted only if supported by the local transcription layer.
- Dangerous symptoms override model output for brake failure, fuel leak, smoke, burning smell, unstable steering, and engine shutdown while riding.
- Dangerous Vietnamese keyword examples include "mất phanh", "thắng không ăn", "bó thắng", "chảy xăng", "rò xăng", "mùi xăng nồng", "bốc khói", "khói trắng nhiều", "khói đen nhiều", "mùi cháy", "khét", "rung lắc tay lái", "đảo tay lái", "xe tắt máy giữa đường", and "chết máy khi đang chạy".
- AI provider failure, timeout, quota exhaustion, missing provider key, or invalid model output returns a rule-based fallback diagnosis.
- Raw audio is never sent to the AI diagnosis provider; only transcribed Vietnamese text enters the diagnosis pipeline.
- Phone numbers, emails, tokens, payment data, and other unnecessary personal information are not sent to the AI provider.
- If estimated_cost_min is greater than estimated_cost_max, or estimated_total min is greater than max, the output is rejected or corrected through fallback.
- If the model returns more than 2 hypotheses, more than 2 actions, or more than 2 follow-up questions, the response is trimmed or rejected according to validation rules.
- The UI contains no motorcycle model selector, seeded motorcycle context selector, brand/model dropdown, or similar option.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a rider to create a demo chatbot session without production login and return a session identifier.
- **FR-002**: System MUST allow a rider to submit Vietnamese text symptoms for a session.
- **FR-003**: System MUST allow a rider to submit Vietnamese voice input as a supported audio file for a session.
- **FR-004**: Voice input MUST be transcribed locally into Vietnamese text before diagnosis, and the response MUST include the transcribed text.
- **FR-005**: System MUST use the transcribed Vietnamese text as the diagnosis input for voice messages.
- **FR-006**: System MUST reject empty text, empty transcription, unsupported audio, or failed transcription with a clear Vietnamese error.
- **FR-007**: System MUST store demo session messages and latest diagnosis in in-memory demo persistence only.
- **FR-008**: System MUST normalize Vietnamese symptom text before diagnosis.
- **FR-009**: System MUST retrieve local symptom knowledge and price ranges from seed data before generating a diagnosis.
- **FR-010**: System MUST return a short diagnosis card with a user-facing summary first.
- **FR-011**: `short_answer` MUST contain no more than 3 short Vietnamese sentences.
- **FR-012**: `top_hypotheses` MUST contain no more than 2 concise hypotheses.
- **FR-013**: `recommended_next_actions` MUST contain no more than 2 actions.
- **FR-014**: `followup_questions` MUST contain no more than 2 questions and MUST appear only when needed.
- **FR-015**: Diagnosis output MUST include risk level, can_continue_riding, estimated total min/max in VND, likely hypotheses, recommended next action, fallback flag, and optional transcribed text.
- **FR-016**: Each hypothesis MUST include rank, component_code, cause, symptoms, consequences, confidence, estimated_cost_min, and estimated_cost_max.
- **FR-017**: Risk level MUST be one of low, medium, high, or critical.
- **FR-018**: Recommended action type MUST be one of emergency_rescue, book_mobile_repair, ask_followup, or safe_to_monitor.
- **FR-019**: UI MUST display the advisory disclaimer: "Kết quả chỉ mang tính tham khảo, không phải báo giá cuối cùng."
- **FR-020**: UI MUST display transcribed text when voice input is used.
- **FR-021**: UI MUST NOT include a motorcycle selector, brand/model dropdown, seeded motorcycle context options, or similar mechanism.
- **FR-022**: System MUST provide a way to return the latest diagnosis for a session.
- **FR-023**: The local setup MUST document the required demo configuration.
- **FR-024**: Diagnosis output MUST follow the compact structured diagnosis contract; unstructured formatted text or long educational content MUST be rejected or converted through fallback.
- **FR-025**: Rider-facing response text MUST be short, direct, and token-efficient.
- **FR-026**: UI MUST show only the essential diagnosis result and MUST NOT show long educational explanations.
- **FR-027**: Voice upload MUST prefer WAV for the MVP.

### CareOnRoad AI Chatbot Requirements *(mandatory for chatbot MVP)*

- **AI-001**: AI output MUST be advisory only and MUST NOT be presented as a final mechanic quote, booking, payment, mechanic assignment, or final repair diagnosis.
- **AI-002**: Backend MUST own dangerous-symptom detection, retrieval, AI provider calls, structured output validation, fallback, rate limiting, and logging.
- **AI-003**: AI provider credentials MUST remain backend-only and MUST NOT appear in frontend code, browser/mobile requests, client config, or logs.
- **AI-004**: Chatbot input and rider-facing output MUST work in Vietnamese, including rule-based fallback responses.
- **AI-005**: Dangerous symptoms MUST override model output for brake failure, fuel leak, smoke, burning smell, unstable steering, and engine shutdown while riding.
- **AI-006**: Every AI provider response MUST be parsed and validated against a structured diagnosis contract before display or persistence.
- **AI-007**: System MUST use rule-based fallback when the AI provider fails, times out, exceeds quota, is missing required configuration, or returns invalid structured output.
- **AI-008**: MVP scope MUST exclude dispatch, payment, real booking, mechanic assignment, production authentication, and persistent production database.
- **AI-009**: The transcription layer MUST only perform speech-to-text and MUST NOT diagnose motorcycle issues.
- **AI-010**: Raw audio MUST NOT be sent to the AI diagnosis provider; only normalized Vietnamese text may be sent to the backend diagnosis pipeline.

### Safety Requirements

- **SR-001**: If the input mentions brake failure, fuel leak, smoke, burning smell, unstable steering, or engine shutdown while riding, `risk_level` MUST be high or critical.
- **SR-002**: If dangerous symptoms are detected, `can_continue_riding` MUST be false.
- **SR-003**: If dangerous symptoms are detected, recommended actions MUST include emergency_rescue.
- **SR-004**: If dangerous symptoms are detected, `short_answer` MUST clearly tell the rider to stop riding and seek help.
- **SR-005**: Backend validation MUST override model output that violates safety requirements.

### Required Product Interfaces

- **RI-001**: System MUST provide a backend session creation interface that creates a demo session and returns a session identifier.
- **RI-002**: System MUST provide a backend message submission interface that accepts text messages with input mode, symptom text, and optional safety answers.
- **RI-003**: System MUST provide a backend message submission interface that accepts voice messages with input mode, audio file, and optional safety answers.
- **RI-004**: Voice messages MUST be transcribed locally into Vietnamese text before diagnosis.
- **RI-005**: AI provider calls MUST use backend-held provider credentials and configurable provider/model settings.
- **RI-006**: AI provider calls MUST be made from the backend only, never directly from the frontend.
- **RI-007**: AI prompts MUST request compact structured output and use response limits that keep answers short.
- **RI-008**: System MUST provide a backend latest-diagnosis interface that returns the latest diagnosis for a session.
- **RI-009**: The local transcription layer MUST be configurable for the required Vietnamese voice model.
- **RI-010**: AI provider requests SHOULD use structured-output support when available.
- **RI-011**: Local transcription model setup MUST be documented for the demo environment.
- **RI-012**: The transcription integration MUST be replaceable in automated tests.

### Diagnosis Output Contract

The diagnosis response MUST contain these fields:

- `short_answer`: Vietnamese string, maximum 3 short sentences.
- `overall_confidence`: number from 0 to 1.
- `risk_level`: low, medium, high, or critical.
- `can_continue_riding`: boolean.
- `top_hypotheses`: array with maximum 2 items.
- `estimated_total`: object with currency VND, min >= 0, and max >= 0.
- `recommended_next_actions`: array with maximum 2 items.
- `followup_questions`: array with maximum 2 questions.
- `transcribed_text`: optional string for voice input.
- `fallback_used`: boolean.

Each hypothesis MUST contain:

- `rank`: 1 or 2.
- `component_code`: one supported component code.
- `cause`: concise Vietnamese text.
- `symptoms`: concise Vietnamese text.
- `consequences`: concise Vietnamese text.
- `confidence`: number from 0 to 1.
- `estimated_cost_min`: number >= 0.
- `estimated_cost_max`: number >= 0.

Each recommended action MUST contain:

- `type`: emergency_rescue, book_mobile_repair, ask_followup, or safe_to_monitor.
- `label`: concise Vietnamese text.

### Local Knowledge and Taxonomy

System MUST include seed knowledge for these Vietnamese symptom groups:

- khó đề / đề không nổ
- hụp ga
- tắt máy giữa đường
- hao xăng
- xe yếu
- kêu két két khi phanh
- chảy xăng
- khói trắng / khói đen
- rung lắc tay lái
- đèn yếu / bình yếu

System MUST support these component codes:

- SPARK_PLUG: Bugi
- BATTERY: Bình ắc quy
- AIR_FILTER: Lọc gió
- FUEL_SYSTEM: Hệ thống xăng
- BRAKE_SYSTEM: Hệ thống phanh
- ENGINE_OIL: Dầu máy
- DRIVE_BELT: Dây curoa
- TIRE: Lốp xe
- ELECTRICAL_SYSTEM: Hệ thống điện
- UNKNOWN: Chưa xác định

### Key Entities *(include if feature involves data)*

- **Chatbot Session**: Demo conversation container with session identifier, messages, and latest diagnosis reference.
- **Rider Message**: Rider-provided symptom input, including input mode, original text or audio reference, optional transcribed text, normalized text, and timestamps.
- **Diagnosis Result**: Validated advisory output with risk level, can-continue-riding flag, hypotheses, estimate range, actions, follow-up questions, fallback flag, and optional transcription.
- **Knowledge Entry**: Local symptom-to-component and cost-range seed data used for retrieval and fallback.
- **Component Taxonomy**: Allowed motorcycle component codes and Vietnamese labels.
- **Transcription Result**: Local transcription status for voice input, including success, error, and transcribed text when available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid Vietnamese text demo submissions return a structured diagnosis card or a safe fallback card.
- **SC-002**: 100% of supported Vietnamese voice demo submissions either show transcribed text with a diagnosis or a clear retry/type-instead error.
- **SC-003**: 100% of dangerous-symptom test cases return high or critical risk, can_continue_riding=false, and an emergency action.
- **SC-004**: 100% of displayed diagnosis cards include the advisory disclaimer and an estimated-price wording that is not a final quote.
- **SC-005**: 95% of user-facing diagnosis summaries fit within 3 short Vietnamese sentences and list no more than 2 hypotheses.
- **SC-006**: 100% of invalid provider output, missing provider configuration, provider timeout, or quota-failure test cases return fallback instead of a crash.
- **SC-007**: 100% of inspected provider requests exclude raw audio, phone numbers, emails, tokens, and payment data.
- **SC-008**: A tester can complete session creation, text diagnosis, voice diagnosis, dangerous-symptom override, fallback, and latest-diagnosis review locally using documented demo configuration.

## Assumptions

- The first MVP is a local demo and does not require production authentication.
- Demo persistence is an in-memory store.
- Supported audio formats are limited to WAV by default and any other formats the local transcription layer explicitly supports in the demo.
- The configured AI model may vary, but the model name must be configurable and failure must not break the demo.
- Price ranges are rough Vietnamese-market demo estimates in VND and require mechanic confirmation.
- Safety answers are optional in the MVP and may be used to refine diagnosis when present.
- The UI is a single chat page plus diagnosis card; no motorcycle selection UI is allowed.
