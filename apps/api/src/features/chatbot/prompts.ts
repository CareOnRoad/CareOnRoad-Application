import { componentTaxonomy } from "./component-taxonomy";
import { knowledgeVersion } from "./knowledge-sources";
import type { RetrievedKnowledgeEntry } from "./retrieval";
import type { SafetyGateResult } from "./safety-gate";

export type PromptMessage = {
  role: "system" | "user";
  content: string;
};

export type CompactDiagnosisPrompt = {
  messages: PromptMessage[];
};

export type CompactDiagnosisPromptInput = {
  normalizedText: string;
  safety: SafetyGateResult;
  retrievedKnowledge: RetrievedKnowledgeEntry[];
  transcribedText?: string;
  safetyAnswers?: Record<string, unknown>;
};

const sensitiveKeyPattern = /(audio|audio_file|raw_audio|blob|buffer|bytes|data|api[_-]?key|authorization|secret|token|phone|email|payment|card|cvv|bank)/i;

export function buildCompactDiagnosisPrompt(input: CompactDiagnosisPromptInput): CompactDiagnosisPrompt {
  const sanitizedSafetyAnswers = sanitizePromptObject(input.safetyAnswers ?? {});

  return {
    messages: [
      {
        role: "system",
        content: [
          "You are CareOnRoad's backend motorcycle diagnosis assistant.",
          "Return JSON only. No markdown. No extra text.",
          "Vietnamese-focused rider-facing output.",
          "Keep output concise and token-efficient.",
          "Return exactly the short flat JSON shape shown in the examples.",
          "answer maximum 2 short Vietnamese sentences.",
          "actions maximum 2 short Vietnamese strings.",
          "questions maximum 2 short Vietnamese strings.",
          "Use double quotes. No trailing commas.",
          "Use only component_code values from the Component taxonomy.",
          "Use the Component taxonomy and Retrieved local knowledge sections below.",
          "If the symptom is only vague running noise, use UNKNOWN unless retrieved local knowledge strongly identifies a component.",
          "Do not guess BATTERY or SPARK_PLUG from noise-only symptoms.",
          "Price is estimate only, not a final mechanic quote.",
          "No verified repair prices are available. Do not invent costs or quote prices in answer, issue or actions.",
          "Source-checked knowledge is advisory, not proof that a component is broken.",
          "Respect vehicle_scope. Ask for vehicle type/model when applicability is unclear; do not apply scooter CVT knowledge to geared or electric motorcycles.",
          "Respect applicability.brand, models and market. Do not transfer model-specific or PH manual claims to another model/market. Null model_years means the year is unverified: do not supply exact specifications, service intervals or fault-code mappings.",
          "When local knowledge requests variant confirmation, use UNKNOWN and the supplied questions; do not guess a component or decode FI/MIL blink counts. A warning lamp at key-on alone does not establish a fault; clarify whether it stays on with the engine running.",
          "Prefer the supplied followup_questions to distinguish causes; do not give disassembly or hazardous DIY instructions.",
          "Treat dangerous symptoms conservatively.",
          "Backend safety rules can override model output.",
          "Do not diagnose beyond the provided symptom text, safety signals, taxonomy, and retrieved local knowledge.",
          "Do not request or use phone, email, token, payment data, API keys, or raw audio."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Create compact advisory Vietnamese motorcycle diagnosis JSON.",
            normalized_text: input.normalizedText,
            transcribed_text: input.transcribedText,
            safety_signals: {
              is_dangerous: input.safety.is_dangerous,
              risk_level: input.safety.risk_level,
              can_continue_riding: input.safety.can_continue_riding,
              recommended_action_type: input.safety.recommended_action_type,
              matches: input.safety.matches.map((match) => ({
                code: match.code,
                normalized_keyword: match.normalized_keyword
              }))
            },
            safety_answers: sanitizedSafetyAnswers,
            component_taxonomy: componentTaxonomy,
            knowledge_version: knowledgeVersion,
            retrieved_local_knowledge: input.retrievedKnowledge.map((entry) => ({
              entry_id: entry.entry_id,
              review_status: entry.review_status,
              reviewed_at: entry.reviewed_at,
              source_refs: entry.source_refs,
              vehicle_scope: entry.vehicle_scope,
              applicability: entry.applicability,
              followup_questions: entry.followup_questions,
              price_status: entry.price_status,
              component_code: entry.component_code,
              cause: entry.cause,
              symptoms: entry.symptoms,
              consequences: entry.consequences,
              risk_level: entry.risk_level,
              can_continue_riding: entry.can_continue_riding,
              estimated_cost_min: entry.estimated_cost_min,
              estimated_cost_max: entry.estimated_cost_max,
              recommended_action_type: entry.recommended_action_type,
              recommended_action_label: entry.recommended_action_label,
              matched_keywords: entry.matched_keywords
            })),
            examples: [
              {
                input: "xe keu e e khi chay",
                output: {
                  v: 1,
                  risk: "medium",
                  ride: true,
                  part: "UNKNOWN",
                  issue: "Tieng keu chua ro vi tri, can mo ta them de khoanh vung.",
                  answer: "Xe co tieng keu bat thuong khi chay, chua du thong tin de ket luan bo phan hong. Nen chay cham va kiem tra them.",
                  actions: ["Mo ta vi tri tieng keu", "Kiem tra banh, phanh va noi xe"],
                  questions: ["Tieng keu o banh truoc, banh sau hay dong co?", "Tieng keu ro hon khi tang ga hay khi bop phanh?"]
                }
              },
              {
                input: "xe kho de va den yeu",
                output: {
                  v: 1,
                  risk: "medium",
                  ride: true,
                  part: "BATTERY",
                  issue: "Binh ac quy yeu hoac he thong dien can kiem tra.",
                  answer: "Xe co dau hieu binh yeu, nen kiem tra ac quy va dau noi dien. Khong nen di xa truoc khi kiem tra.",
                  actions: ["Kiem tra binh ac quy", "Kiem tra dau noi dien"],
                  questions: ["Den pha co yeu hon binh thuong khong?", "Xe co kho de vao buoi sang khong?"]
                }
              },
              {
                input: "xe mat phanh",
                output: {
                  v: 1,
                  risk: "critical",
                  ride: false,
                  part: "BRAKE_SYSTEM",
                  issue: "He thong phanh co dau hieu nguy hiem.",
                  answer: "Dung xe ngay va khong tiep tuc chay. Goi ho tro hoac dua xe den tho gan nhat.",
                  actions: ["Dung xe an toan", "Goi ho tro sua xe"],
                  questions: ["Phanh truoc hay phanh sau bi mat?", "Co tieng keu hoac mui khet khong?"]
                }
              }
            ],
            required_shape: {
              v: 1,
              risk: "low | medium | high | critical",
              ride: "boolean",
              part: "taxonomy component_code or UNKNOWN",
              issue: "short Vietnamese issue string",
              answer: "max 2 short Vietnamese sentences",
              actions: "array, max 2 short Vietnamese strings",
              questions: "array, max 2 short Vietnamese strings"
            }
          },
          null,
          2
        )
      }
    ]
  };
}

function sanitizePromptObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(value).reduce<Record<string, unknown>>((clean, [key, entry]) => {
    if (sensitiveKeyPattern.test(key)) {
      return clean;
    }

    clean[key] = sanitizePromptValue(entry);
    return clean;
  }, {});
}

function sanitizePromptValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePromptValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return sanitizePromptObject(value as Record<string, unknown>);
}
