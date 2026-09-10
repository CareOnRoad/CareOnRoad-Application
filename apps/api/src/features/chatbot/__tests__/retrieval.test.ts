import { describe, expect, it } from "vitest";

import { retrieveKnowledge } from "../retrieval";

describe("retrieveKnowledge", () => {
  it("returns relevant entries for khó đề", () => {
    const entries = retrieveKnowledge("Xe sáng khó đề và đèn hơi yếu");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.component_code).toBe("BATTERY");
  });

  it("returns relevant entries for hao xăng", () => {
    const entries = retrieveKnowledge("Dạo này xe hao xăng hơn bình thường");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.component_code).toBe("AIR_FILTER");
  });

  it("returns relevant entries for đèn yếu", () => {
    const entries = retrieveKnowledge("Xe bị đèn yếu và đề yếu");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.entry_id).toBe("weak-light-battery");
  });

  it("returns relevant entries for kêu két két khi phanh", () => {
    const entries = retrieveKnowledge("Xe kêu két két khi phanh");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.component_code).toBe("BRAKE_SYSTEM");
  });

  it("uses UNKNOWN for vague running noise before guessing a component", () => {
    const entries = retrieveKnowledge("xe keu e e khi chay");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.entry_id).toBe("vague-running-noise");
    expect(entries[0]?.component_code).toBe("UNKNOWN");
  });

  it("returns tire rescue knowledge for low or punctured tires", () => {
    const entries = retrieveKnowledge("xe bi xep lop do can dinh");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.entry_id).toBe("flat-or-low-tire");
    expect(entries[0]?.component_code).toBe("TIRE");
  });

  it("returns engine oil knowledge for overheating symptoms", () => {
    const entries = retrieveKnowledge("xe nong may va co mui khet may");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.entry_id).toBe("low-engine-oil-or-overheat");
    expect(entries[0]?.component_code).toBe("ENGINE_OIL");
  });

  it("returns electrical knowledge for rain or flooded-road symptoms", () => {
    const entries = retrieveKnowledge("di mua chet may va kho no lai");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.entry_id).toBe("water-ingress-after-rain");
    expect(entries[0]?.component_code).toBe("ELECTRICAL_SYSTEM");
  });

  it("returns an empty list when no keyword matches", () => {
    expect(retrieveKnowledge("Tôi cần hỏi thêm thông tin")).toEqual([]);
  });
});
