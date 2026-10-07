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

  it("excludes pending wheel-bearing and charging claims", () => {
    expect(retrieveKnowledge("bạc đạn kêu")).toEqual([]);
    expect(retrieveKnowledge("sạc không vào và bình nhanh hết")).toEqual([]);
  });

  it("retrieves source-checked flood scenarios with Vietnamese aliases", () => {
    expect(retrieveKnowledge("Nhot trang sua sau khi loi nuoc")[0]).toMatchObject({
      entry_id: "oil-contaminated-after-flood", review_status: "source_checked", can_continue_riding: false
    });
    expect(retrieveKnowledge("Xe ga giật sau ngập")[0]?.entry_id).toBe("scooter-jerk-after-flood");
  });

  it("does not apply petrol or scooter knowledge to an explicitly incompatible vehicle", () => {
    expect(retrieveKnowledge("xe điện khó đề và đèn yếu")).toEqual([]);
    expect(retrieveKnowledge("xe số kêu khi tăng ga")).toEqual([]);
    expect(retrieveKnowledge("xe điện bị xẹp lốp")[0]?.entry_id).toBe("flat-or-low-tire");
  });

  it.each([
    ["Honda đi ngập nước", "honda-flooded-engine-stop"],
    ["Vision nhớt trắng sữa", "honda-scooter-flood-oil-check"],
    ["SH150i đèn MIL còn sáng", "honda-sh150i-mil-warning"],
    ["SYM khó đề", "sym-spark-plug-inspection"],
    ["SYM có tiếng động lạ", "sym-abnormal-noise-inspection"],
    ["Liberty có tiếng lạ", "piaggio-abnormal-symptom-inspection"],
    ["Piaggio Medley lịch bảo dưỡng", "piaggio-model-maintenance-schedule"]
  ])("retrieves applicable official guidance for %s", (text, entryId) => {
    expect(retrieveKnowledge(text)[0]?.entry_id).toBe(entryId);
  });

  it("uses a source only for the stated brand/model and asks for the Raider variant first", () => {
    expect(retrieveKnowledge("Suzuki Raider FI đèn FI")[0]?.entry_id).toBe("suzuki-raider-variant-clarification");
    expect(retrieveKnowledge("Raider cầu chì đứt")[0]?.component_code).toBe("UNKNOWN");
    expect(retrieveKnowledge("Honda Vision đèn FI")).toEqual([]);
    expect(retrieveKnowledge("Suzuki Address đèn FI")).toEqual([]);
    expect(retrieveKnowledge("đèn FI")).toEqual([]);
    expect(retrieveKnowledge("Honda và Suzuki đèn FI")).toEqual([]);
  });

  it("requires an explicit PH market and FI model before using the Philippines manual", () => {
    expect(retrieveKnowledge("Suzuki Raider FI bản Philippines đèn FI")[0]?.entry_id)
      .toBe("suzuki-ph-raider-fi-mil-warning");
    expect(retrieveKnowledge("FU150MF bản PH cầu chì đứt")[0]?.entry_id)
      .toBe("suzuki-ph-raider-fi-fuse-warning");
    expect(retrieveKnowledge("Suzuki Raider FI bản Việt Nam đèn FI").some((item) => item.applicability?.market === "PH"))
      .toBe(false);
    expect(retrieveKnowledge("Suzuki Satria bản PH đèn FI")).toEqual([]);
    expect(retrieveKnowledge("Suzuki Raider bình xăng con bản PH đèn FI")).toEqual([]);
    expect(retrieveKnowledge("Suzuki Raider FI bình xăng con bản PH đèn FI")).toEqual([]);
    expect(retrieveKnowledge("Suzuki Raider FI bản VN hay Philippines đèn FI")).toEqual([]);
  });

  it("keeps Honda final-drive advice away from geared or unidentified motorcycle types", () => {
    expect(retrieveKnowledge("Honda xe số nhớt trắng sữa").some((item) => item.vehicle_scope === "petrol_scooters"))
      .toBe(false);
    expect(retrieveKnowledge("Honda nhớt trắng sữa").some((item) => item.entry_id === "honda-scooter-flood-oil-check"))
      .toBe(false);
    expect(retrieveKnowledge("Suzuki Raider kêu khi tăng ga")).toEqual([]);
    expect(retrieveKnowledge("Honda xe điện đi ngập nước")).toEqual([]);
  });

  it("keeps general safety knowledge available for other brands", () => {
    expect(retrieveKnowledge("Suzuki Satria bị xẹp lốp")[0]?.entry_id).toBe("flat-or-low-tire");
    expect(retrieveKnowledge("Honda Vision xe nóng máy")[0]?.entry_id).toBe("low-engine-oil-or-overheat");
  });
});
