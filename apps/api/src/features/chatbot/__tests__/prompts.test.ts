import { describe, expect, it } from "vitest";

import { componentTaxonomy } from "../component-taxonomy";
import { buildCompactDiagnosisPrompt } from "../prompts";
import { retrieveKnowledge } from "../retrieval";
import { runSafetyGate } from "../safety-gate";

describe("buildCompactDiagnosisPrompt", () => {
  it("includes compact JSON-only output constraints", () => {
    const prompt = buildPrompt();
    const text = prompt.messages.map((message) => message.content).join("\n");

    expect(text).toContain("JSON only");
    expect(text).toContain("No markdown");
    expect(text).toContain("answer");
    expect(text).toContain("maximum 2 short Vietnamese sentences");
    expect(text).toContain("actions maximum 2");
    expect(text).toContain("questions maximum 2");
    expect(text).toContain('"risk"');
    expect(text).toContain('"part"');
  });

  it("includes advisory-price instruction", () => {
    const prompt = buildPrompt();
    const text = prompt.messages.map((message) => message.content).join("\n");

    expect(text).toContain("estimate only");
    expect(text).toContain("not a final mechanic quote");
  });

  it("includes the component taxonomy and retrieved local knowledge", () => {
    const prompt = buildPrompt();
    const text = prompt.messages.map((message) => message.content).join("\n");

    expect(text).toContain("Component taxonomy");
    expect(text).toContain("BATTERY");
    expect(text).toContain(componentTaxonomy.BATTERY);
    expect(text).toContain("Retrieved local knowledge");
    expect(text).toContain("hard-start-battery");
  });

  it("includes conservative dangerous-symptom guidance and backend override notice", () => {
    const prompt = buildPrompt("xe mat phanh");
    const text = prompt.messages.map((message) => message.content).join("\n");

    expect(text).toContain("dangerous symptoms conservatively");
    expect(text).toContain("Backend safety rules can override");
  });

  it("does not include raw audio fields", () => {
    const prompt = buildPrompt("xe kho de", {
      raw_audio: "do-not-send",
      audio_file: "do-not-send",
      data: [1, 2, 3],
      normalized_text: "xe kho de"
    });
    const text = JSON.stringify(prompt);

    expect(text).not.toContain("raw_audio");
    expect(text).not.toContain("audio_file");
    expect(text).not.toContain("do-not-send");
    expect(text).not.toContain("[1,2,3]");
  });
});

function buildPrompt(input = "xe kho de va den yeu", safetyAnswers?: Record<string, unknown>) {
  return buildCompactDiagnosisPrompt({
    normalizedText: input,
    safety: runSafetyGate(input),
    retrievedKnowledge: retrieveKnowledge(input, 2),
    safetyAnswers
  });
}
