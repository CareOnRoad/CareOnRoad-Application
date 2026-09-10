# Quickstart: CareOnRoad AI Chatbot MVP

## Prerequisites

- Node.js and npm available locally.
- Next.js project dependencies installed.
- `.env.local` created from `.env.example`.
- Local ASR model files placed under
  `./models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09`.

Required environment variables:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
AI_TOTAL_TIMEOUT_MS=10000
GEMINI_TIMEOUT_MS=6000
OPENROUTER_TIMEOUT_MS=4000
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-oss-20b:free
OPENROUTER_ENABLE_MODEL_FALLBACK=true
OPENROUTER_FALLBACK_MODEL=openrouter/free
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_TITLE=CareOnRoad AI Chatbot MVP
SHERPA_ONNX_MODEL_DIR=./models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09
SHERPA_ONNX_ENCODER=encoder.int8.onnx
SHERPA_ONNX_DECODER=decoder.onnx
SHERPA_ONNX_JOINER=joiner.int8.onnx
SHERPA_ONNX_TOKENS=tokens.txt
ASR_ENABLED=true
```

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate Text Diagnosis

1. Create or open the chat page.
2. Enter: `xe kho de va den yeu`.
3. Submit.
4. Expected:
   - Diagnosis card appears.
   - Summary is short.
   - Maximum 2 hypotheses.
   - Price is shown as estimated VND range.
   - Disclaimer is visible.

## Validate Dangerous Input Override

1. Enter: `xe mat phanh`.
2. Submit.
3. Expected:
   - `risk_level` is `high` or `critical`.
   - `can_continue_riding` is `false`.
   - Recommended action includes `emergency_rescue`.
   - Summary tells the rider to stop riding and seek help.

## Validate Voice Diagnosis

1. Upload or record a WAV file with Vietnamese symptoms.
2. Submit.
3. Expected:
   - Transcribed text is displayed.
   - Diagnosis uses the transcribed text.
   - Raw audio is not sent to OpenRouter.

## Validate ASR Failure

1. Disable ASR or provide unsupported/empty audio.
2. Submit voice input.
3. Expected:
   - API returns a controlled ASR error.
   - UI asks the rider to type the issue or record again.

## Validate OpenRouter Fallback

1. Leave `OPENROUTER_API_KEY` empty.
2. Submit a valid text symptom.
3. Expected:
   - App does not crash.
   - Fallback diagnosis is returned.
   - `fallback_used` is `true`.

## Run Tests

```bash
npm test
```

Required test coverage:

- Diagnosis schema validation.
- Safety gate and dangerous override.
- Retrieval over local knowledge entries.
- Rule-based fallback diagnosis.
- OpenRouter missing key, timeout, rate limit, invalid JSON, provider error, short `Retry-After`, and optional fallback model.
- ASR empty transcription and unavailable runtime.
- Text API route.
- Voice API route with mocked ASR.

## References

- API contract: [contracts/chatbot-api.yaml](contracts/chatbot-api.yaml)
- Data model: [data-model.md](data-model.md)
- Implementation plan: [plan.md](plan.md)
