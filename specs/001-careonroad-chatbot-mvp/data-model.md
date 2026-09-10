# Data Model: CareOnRoad AI Chatbot MVP

## ChatbotSession

Represents a local demo conversation.

**Fields**
- `session_id`: string, unique session identifier.
- `created_at`: ISO datetime.
- `updated_at`: ISO datetime.
- `messages`: RiderMessage[].
- `latest_diagnosis`: DiagnosisResult | null.

**Relationships**
- Has many RiderMessage records.
- Has zero or one latest DiagnosisResult.

**Lifecycle**
- Created by `POST /api/chatbot/sessions`.
- Updated when a text or voice message is accepted.
- Latest diagnosis is replaced by the newest successful diagnosis.
- Lost when the in-memory demo process restarts.

## RiderMessage

Represents one rider input.

**Fields**
- `message_id`: string, unique within the session.
- `session_id`: string.
- `input_mode`: `text` | `voice`.
- `content_text`: string | null.
- `transcribed_text`: string | null.
- `normalized_text`: string.
- `safety_answers`: object | null.
- `created_at`: ISO datetime.

**Validation Rules**
- Text mode requires non-empty `content_text`.
- Voice mode requires a supported audio file and successful non-empty
  transcription before diagnosis.
- Voice diagnosis uses `transcribed_text` as source content.
- Raw audio is never stored as diagnosis input and is never sent to OpenRouter.

## DiagnosisResult

Represents the validated advisory output returned to the UI.

**Fields**
- `short_answer`: string, maximum 3 short Vietnamese sentences.
- `overall_confidence`: number, 0 to 1.
- `risk_level`: `low` | `medium` | `high` | `critical`.
- `can_continue_riding`: boolean.
- `top_hypotheses`: Hypothesis[], maximum 2 items.
- `estimated_total`: PriceRange.
- `recommended_next_actions`: RecommendedAction[], maximum 2 items.
- `followup_questions`: string[], maximum 2 items.
- `transcribed_text`: string | null.
- `fallback_used`: boolean.

**Validation Rules**
- Must pass Zod schema validation before display or storage.
- Must pass post-validation business rules:
  - `estimated_total.min <= estimated_total.max`.
  - Each hypothesis cost min is less than or equal to cost max.
  - Hypothesis ranks are 1 or 2.
  - Component codes exist in ComponentTaxonomy.
  - Dangerous symptoms force high/critical risk.
  - Dangerous symptoms force `can_continue_riding=false`.
  - Dangerous symptoms include `emergency_rescue`.

## Hypothesis

Represents one likely cause.

**Fields**
- `rank`: 1 | 2.
- `component_code`: ComponentCode.
- `cause`: concise Vietnamese string.
- `symptoms`: concise Vietnamese string.
- `consequences`: concise Vietnamese string.
- `confidence`: number, 0 to 1.
- `estimated_cost_min`: number >= 0.
- `estimated_cost_max`: number >= 0.

## PriceRange

Represents estimated cost only, never a final quote.

**Fields**
- `currency`: `VND`.
- `min`: number >= 0.
- `max`: number >= 0.

## RecommendedAction

Represents one short next action.

**Fields**
- `type`: `emergency_rescue` | `book_mobile_repair` | `ask_followup` |
  `safe_to_monitor`.
- `label`: concise Vietnamese string.

## KnowledgeEntry

Represents local seed knowledge for retrieval and fallback.

**Fields**
- `entry_id`: string.
- `symptom_keywords`: string[].
- `component_code`: ComponentCode.
- `cause`: concise Vietnamese string.
- `risk_level`: DiagnosisResult risk level.
- `can_continue_riding`: boolean.
- `estimated_cost_min`: number >= 0.
- `estimated_cost_max`: number >= 0.
- `recommended_action_type`: RecommendedAction type.

**Seed Coverage**
- `kho de` / `de khong no`.
- `hup ga`.
- `tat may giua duong`.
- `hao xang`.
- `xe yeu`.
- `keu ket ket khi phanh`.
- `chay xang`.
- `khoi trang` / `khoi den`.
- `rung lac tay lai`.
- `den yeu` / `binh yeu`.

## ComponentTaxonomy

Allowed component codes:

- `SPARK_PLUG`: Bugi.
- `BATTERY`: Binh ac quy.
- `AIR_FILTER`: Loc gio.
- `FUEL_SYSTEM`: He thong xang.
- `BRAKE_SYSTEM`: He thong phanh.
- `ENGINE_OIL`: Dau may.
- `DRIVE_BELT`: Day curoa.
- `TIRE`: Lop xe.
- `ELECTRICAL_SYSTEM`: He thong dien.
- `UNKNOWN`: Chua xac dinh.

## ASRResult

Represents local speech-to-text output.

**Fields**
- `status`: `success` | `empty_transcription` | `asr_not_available` |
  `unsupported_audio` | `asr_failed`.
- `transcribed_text`: string | null.
- `error_code`: string | null.
- `error_message`: Vietnamese string | null.

**Validation Rules**
- Only `success` with non-empty `transcribed_text` can continue to diagnosis.
- All failure statuses return a clear Vietnamese message asking the rider to
  type the issue or record again.
- ASR does not diagnose and does not call OpenRouter.
