import type { ComponentCode } from "./component-taxonomy";
import type { RecommendedActionType, RiskLevel } from "./diagnosis.schema";
import { knowledgeReviewedAt, type KnowledgeSourceId } from "./knowledge-sources";
import { normalizeVietnameseText } from "./normalize-vi";

export type KnowledgeApplicability = {
  brand: "honda" | "suzuki" | "sym" | "piaggio";
  // Empty models means brand-wide qualitative advice; strings are matching aliases.
  models: string[];
  // Null means no model year has been verified, never a universal specification.
  model_years: number[] | null;
  market: "VN" | "PH";
  note: string;
};

export type KnowledgeEntry = {
  entry_id: string;
  symptom_keywords: string[];
  normalized_keywords: string[];
  component_code: ComponentCode;
  cause: string;
  symptoms: string;
  consequences: string;
  risk_level: RiskLevel;
  can_continue_riding: boolean;
  estimated_cost_min: number;
  estimated_cost_max: number;
  recommended_action_type: RecommendedActionType;
  recommended_action_label: string;
  review_status: "source_checked" | "internal_policy" | "pending";
  reviewed_at: string | null;
  source_refs: Array<{ source_id: KnowledgeSourceId; section: string }>;
  vehicle_scope: "petrol_motorcycles" | "petrol_scooters" | "all_motorcycles";
  applicability?: KnowledgeApplicability;
  followup_questions: string[];
  price_status: "unverified";
};

function entry(input: Omit<KnowledgeEntry, "normalized_keywords" | "reviewed_at" | "price_status">): KnowledgeEntry {
  return {
    ...input,
    reviewed_at: input.review_status === "pending" ? null : knowledgeReviewedAt,
    price_status: "unverified",
    normalized_keywords: input.symptom_keywords.map((keyword) => normalizeVietnameseText(keyword))
  };
}

// Short editorial paraphrases; no copied articles or DIY repair procedures.
// Risk, riding permission and escalation are CareOnRoad policies, not OEM claims.
export const knowledgeBase: KnowledgeEntry[] = [
  entry({
    entry_id: "honda-flooded-engine-stop",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    applicability: {
      brand: "honda", models: [], model_years: null, market: "VN",
      note: "FAQ chung của Honda Việt Nam; không cung cấp thông số theo đời xe."
    },
    source_refs: [{ source_id: "honda-vn-technical-faq", section: "Mùa mưa: xử lý khi máy tắt sau ngập" }],
    followup_questions: ["Xe tắt máy trong vùng ngập hay sau khi đã ra khỏi nước?", "Bạn dùng mẫu Honda nào, xe ga hay xe số?"],
    symptom_keywords: ["ngập nước chết máy", "chết máy sau ngập", "chết máy do ngập", "đi ngập nước", "xe bị ngập nước"],
    component_code: "UNKNOWN",
    cause: "Sau ngập, nước có thể vào động cơ; không cố khởi động lại",
    symptoms: "Xe tắt máy trong hoặc sau ngập nước",
    consequences: "Cố đề lại có thể làm hỏng động cơ",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Tắt khóa điện, đến vị trí an toàn nếu có thể và gọi hỗ trợ"
  }),
  entry({
    entry_id: "honda-scooter-flood-oil-check",
    review_status: "source_checked",
    vehicle_scope: "petrol_scooters",
    applicability: {
      brand: "honda", models: [], model_years: null, market: "VN",
      note: "Chỉ xe tay ga Honda; loại dầu và lịch thay phải theo sách đúng mẫu xe."
    },
    source_refs: [{ source_id: "honda-vn-technical-faq", section: "Mùa mưa: dầu đổi màu, dầu truyền động cuối; bảo dưỡng dầu láp" }],
    followup_questions: ["Xe ga Honda của bạn tên gì, đời nào?", "Có thấy dầu đổi màu hoặc xe tắt máy sau ngập không?"],
    symptom_keywords: ["dầu láp sau ngập", "nhớt láp sau ngập", "dầu láp vào nước", "nhớt láp vào nước", "nhớt trắng sữa", "dầu trắng sữa", "xe ga bị ngập"],
    component_code: "ENGINE_OIL",
    cause: "Sau ngập, xe ga cần kiểm tra cả dầu động cơ và dầu truyền động cuối",
    symptoms: "Dầu đổi màu sau ngập hoặc cần kiểm tra dầu láp",
    consequences: "Dầu nhiễm nước cần được xử lý trước khi chạy tiếp",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Nhờ HEAD hoặc thợ kiểm tra dầu động cơ và dầu láp trước khi chạy tiếp"
  }),
  entry({
    entry_id: "honda-sh150i-mil-warning",
    review_status: "source_checked",
    vehicle_scope: "petrol_scooters",
    applicability: {
      brand: "honda", models: ["SH150i", "SH 150i"], model_years: null, market: "VN",
      note: "FAQ cảnh báo MIL nhắc tới SH150i; chưa đối chiếu đời xe hay mã lỗi cụ thể. Chỉ dùng khi đèn còn sáng/nháy lúc máy chạy."
    },
    source_refs: [{ source_id: "honda-vn-technical-faq", section: "Cảnh báo MIL, dịch vụ kết nối SH150i: kiểm tra PGM-FI tại HEAD" }],
    followup_questions: ["Đèn MIL còn sáng hoặc nháy khi động cơ đã chạy không?", "Xe đời nào, có hụt ga hoặc tắt máy kèm theo không?"],
    symptom_keywords: ["đèn mil", "đèn báo mil", "đèn pgm fi", "đèn fi", "đèn báo fi", "báo lỗi fi", "đèn báo lỗi động cơ"],
    component_code: "FUEL_SYSTEM",
    cause: "Đèn MIL bất thường cần kiểm tra PGM-FI; chưa xác định linh kiện hỏng",
    symptoms: "Đèn MIL còn báo khi máy chạy",
    consequences: "Cần kỹ thuật viên kiểm tra để xác định lỗi",
    risk_level: "medium",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Nhờ HEAD kiểm tra; không tự suy mã lỗi hoặc thay phụ tùng"
  }),
  entry({
    entry_id: "suzuki-raider-variant-clarification",
    review_status: "internal_policy",
    vehicle_scope: "petrol_motorcycles",
    applicability: {
      brand: "suzuki", models: ["Raider", "Raider FI", "Raider R150 FI", "Raider 150 FI", "FU150MF"],
      model_years: null, market: "VN",
      note: "Kho mới có sách FU150MF bản Philippines; chưa đối chiếu bản Việt Nam hay bản dùng bình xăng con."
    },
    source_refs: [],
    followup_questions: ["Raider của bạn dùng FI hay bình xăng con, đời nào?", "Xe là bản Việt Nam hay bản Philippines?"],
    symptom_keywords: ["đèn fi", "đèn báo fi", "đèn mil", "đèn báo mil", "báo lỗi fi", "cầu chì đứt", "đứt cầu chì", "cháy cầu chì"],
    component_code: "UNKNOWN",
    cause: "Cần xác nhận phiên bản Raider trước khi dùng sách FU150MF của Philippines",
    symptoms: "Đèn cảnh báo hoặc cầu chì bất thường, chưa rõ phiên bản xe",
    consequences: "Chưa đủ căn cứ áp dụng tài liệu đúng xe",
    risk_level: "medium",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "ask_followup",
    recommended_action_label: "Xác nhận đời xe, FI hay bình xăng con và thị trường xe"
  }),
  entry({
    entry_id: "suzuki-ph-raider-fi-mil-warning",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    applicability: {
      brand: "suzuki", models: ["Raider FI", "Raider R150 FI", "Raider 150 FI", "FU150MF"],
      model_years: null, market: "PH",
      note: "Sách FU150MF của Suzuki Philippines; chưa xác minh đời xe. Không dùng cho Raider bình xăng con, Satria hoặc bản Việt Nam."
    },
    source_refs: [{ source_id: "suzuki-ph-raider-fi-manual", section: "Troubleshooting, printed 7-2–7-4 (PDF pages 73–74)" }],
    followup_questions: ["Đèn FI còn báo khi máy đã chạy không?", "Xe có tắt máy hoặc hụt ga, và đời xe là năm nào?"],
    symptom_keywords: ["đèn fi", "đèn báo fi", "đèn mil", "đèn báo mil", "báo lỗi fi"],
    component_code: "FUEL_SYSTEM",
    cause: "Đèn FI bất thường cần đại lý kiểm tra hệ thống phun xăng",
    symptoms: "Đèn FI báo lỗi",
    consequences: "Chưa xác định được linh kiện hoặc mã lỗi từ lời kể",
    risk_level: "medium",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Nhờ đại lý Suzuki kiểm tra FI; không tự thử tia lửa"
  }),
  entry({
    entry_id: "suzuki-ph-raider-fi-fuse-warning",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    applicability: {
      brand: "suzuki", models: ["Raider FI", "Raider R150 FI", "Raider 150 FI", "FU150MF"],
      model_years: null, market: "PH",
      note: "Sách FU150MF bản Philippines; không cung cấp trị số cầu chì cho xe chưa xác minh phiên bản."
    },
    source_refs: [{ source_id: "suzuki-ph-raider-fi-manual", section: "Fuses, printed 6-70–6-71 (PDF pages 69–70)" }],
    followup_questions: ["Cầu chì đã đứt lặp lại hay điện mất lần đầu?", "Xe có vừa lắp thêm phụ kiện điện không?"],
    symptom_keywords: ["cầu chì đứt", "đứt cầu chì", "cháy cầu chì"],
    component_code: "ELECTRICAL_SYSTEM",
    cause: "Cầu chì đứt có thể do lỗi điện; cần tìm nguyên nhân",
    symptoms: "Thiết bị điện ngừng hoạt động hoặc cầu chì đứt lặp lại",
    consequences: "Nối tắt cầu chì có thể gây hỏng điện hoặc cháy",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Nhờ thợ kiểm tra; không nối tắt bằng dây hay giấy bạc"
  }),
  entry({
    entry_id: "sym-spark-plug-inspection",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    applicability: {
      brand: "sym", models: [], model_years: null, market: "VN",
      note: "Bài bảo dưỡng chung của SYM; không phải chẩn đoán riêng theo mẫu/đời xe."
    },
    source_refs: [{ source_id: "sym-vn-maintenance", section: "Các hạng mục cần bảo dưỡng định kỳ: kiểm tra/thay thế bugi" }],
    followup_questions: ["Xe SYM tên gì, bấm đề có quay máy không?", "Xe có yếu máy hoặc hao xăng kèm theo không?"],
    symptom_keywords: ["khó đề", "khó khởi động", "khó nổ", "bugi"],
    component_code: "SPARK_PLUG",
    cause: "Bugi xuống cấp là một khả năng gây khó khởi động; cần kiểm tra",
    symptoms: "Khó khởi động, có thể kèm máy yếu hoặc hao xăng",
    consequences: "Có thể làm giảm hiệu quả vận hành",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Nhờ thợ kiểm tra khởi động và bugi, chưa kết luận phải thay"
  }),
  entry({
    entry_id: "sym-abnormal-noise-inspection",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    applicability: {
      brand: "sym", models: [], model_years: null, market: "VN",
      note: "Chỉ khuyến nghị kiểm tra bất thường theo bài bảo dưỡng; không suy ra lỗi linh kiện."
    },
    source_refs: [{ source_id: "sym-vn-maintenance", section: "Lý do bảo dưỡng: phát hiện sớm tiếng động lạ/rò dầu" }],
    followup_questions: ["Tiếng kêu ở động cơ, bánh hay phanh?", "Có rò dầu, máy nóng hoặc phanh yếu không?"],
    symptom_keywords: ["tiếng lạ", "kêu lạ khi chạy", "tiếng động lạ", "tiếng kêu bất thường"],
    component_code: "UNKNOWN",
    cause: "Tiếng động lạ cần kiểm tra sớm, chưa đủ để xác định bộ phận hỏng",
    symptoms: "Xe có tiếng động bất thường",
    consequences: "Kiểm tra sớm giúp phát hiện vấn đề trước khi nặng hơn",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "ask_followup",
    recommended_action_label: "Mô tả vị trí tiếng kêu và đặt lịch kiểm tra"
  }),
  entry({
    entry_id: "piaggio-abnormal-symptom-inspection",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    applicability: {
      brand: "piaggio", models: [], model_years: null, market: "VN",
      note: "Hướng dẫn hậu mãi chung; không có mã lỗi hay thông số riêng cho Liberty/Medley."
    },
    source_refs: [{ source_id: "piaggio-vn-maintenance", section: "Dấu hiệu bất thường: kiểm tra trước kỳ bảo dưỡng" }],
    followup_questions: ["Bạn dùng Liberty, Medley hay mẫu Piaggio nào, đời nào?", "Dấu hiệu xuất hiện lúc đề máy, tăng ga hay phanh?"],
    symptom_keywords: ["tiếng lạ", "kêu lạ khi chạy", "tiếng kêu bất thường", "dấu hiệu bất thường"],
    component_code: "UNKNOWN",
    cause: "Dấu hiệu bất thường cần kiểm tra sớm, không chờ đến kỳ bảo dưỡng",
    symptoms: "Xe vận hành khác thường, chưa đủ dữ liệu khoanh vùng",
    consequences: "Cần kiểm tra để hạn chế hư hỏng phát sinh",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "ask_followup",
    recommended_action_label: "Mô tả triệu chứng và liên hệ nơi bảo dưỡng được Piaggio ủy quyền"
  }),
  entry({
    entry_id: "piaggio-model-maintenance-schedule",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    applicability: {
      brand: "piaggio", models: [], model_years: null, market: "VN",
      note: "Chu kỳ khác nhau theo mẫu; phải xem sách đúng mẫu/đời trước khi đưa số km hoặc thời gian."
    },
    source_refs: [{ source_id: "piaggio-vn-maintenance", section: "Lịch bảo dưỡng theo mẫu; liên kết sách hướng dẫn" }],
    followup_questions: ["Mẫu Piaggio và năm sản xuất của bạn là gì?", "Lần bảo dưỡng gần nhất khi nào, xe đã đi bao nhiêu km?"],
    symptom_keywords: ["bao lâu bảo dưỡng", "khi nào bảo dưỡng", "lịch bảo dưỡng", "bảo dưỡng định kỳ"],
    component_code: "UNKNOWN",
    cause: "Lịch bảo dưỡng phụ thuộc mẫu xe, cần xem sách đúng xe",
    symptoms: "Người dùng cần xác định kỳ bảo dưỡng",
    consequences: "Chưa có căn cứ đặt chung một chu kỳ cho mọi mẫu",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "ask_followup",
    recommended_action_label: "Xác nhận mẫu/đời xe rồi đối chiếu sách bảo dưỡng"
  }),
  entry({
    entry_id: "hard-start-battery",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-battery", section: "1; 3.2; lời khuyên kiểm tra tại đại lý" }],
    followup_questions: ["Bấm đề có quay máy hay chỉ nghe tiếng tạch?", "Đèn và còi có yếu hơn bình thường không?"],
    symptom_keywords: ["khó đề", "đề không nổ", "đề yếu"],
    component_code: "BATTERY",
    cause: "Ắc quy yếu có thể khiến xe khó khởi động; cần kiểm tra trước khi thay",
    symptoms: "Khó đề, đèn yếu",
    consequences: "Có thể không khởi động được",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Nhờ thợ kiểm tra ắc quy và đầu nối"
  }),
  entry({
    entry_id: "hard-start-spark-plug",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-fuel-consumption", section: "2.2. Bugi bị hư hỏng" }],
    followup_questions: ["Máy có quay khi bấm đề không?", "Xe có hụt ga hoặc nổ không đều sau khi khởi động không?"],
    symptom_keywords: ["khó đề", "đề không nổ", "máy nổ không đều"],
    component_code: "SPARK_PLUG",
    cause: "Bugi bẩn hoặc mòn có thể làm đánh lửa kém",
    symptoms: "Khó nổ máy",
    consequences: "Có thể đốt nhiên liệu không hết và hao xăng",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra bugi"
  }),
  entry({
    entry_id: "throttle-hesitation",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-low-speed-jerk", section: "1.1; 1.5" }],
    followup_questions: ["Xe còn xăng và bị hụt lúc tăng ga hay chạy chậm?", "Xe dùng phun xăng điện tử hay bình xăng con?"],
    symptom_keywords: ["hụp ga", "hụt ga", "lên ga hụt", "ga không đều"],
    component_code: "FUEL_SYSTEM",
    cause: "Cấp nhiên liệu không đều là một khả năng gây hụt ga",
    symptoms: "Hụp ga",
    consequences: "Xe yếu khi tăng tốc",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra hệ thống nhiên liệu, chưa tự chỉnh xăng gió"
  }),
  entry({
    entry_id: "engine-shutdown",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-shutdown", section: "Mở đầu; 1.1; 1.4; 1.7; 1.9" }],
    followup_questions: [
      "Trước khi tắt máy có nóng bất thường hoặc mùi khét không?",
      "Xe vừa đi ngập nước hay gần hết xăng không?"
    ],
    symptom_keywords: ["tắt máy giữa đường", "chết máy khi đang chạy"],
    component_code: "FUEL_SYSTEM",
    cause: "Xe tắt máy có nhiều khả năng: nhiên liệu, đánh lửa hoặc quá nhiệt",
    symptoms: "Tắt máy khi chạy",
    consequences: "Dễ mất an toàn giao thông",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe và gọi hỗ trợ"
  }),
  entry({
    entry_id: "fuel-consumption-air-filter",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-air-filter", section: "1; 3. Lưu ý khi vệ sinh" }],
    followup_questions: ["Mức hao xăng thay đổi từ khi nào?", "Lọc gió đã được kiểm tra gần đây chưa?"],
    symptom_keywords: ["hao xăng", "xe yếu"],
    component_code: "AIR_FILTER",
    cause: "Lọc gió bẩn là một khả năng, chưa đủ để kết luận chỉ từ hao xăng",
    symptoms: "Hao xăng, xe yếu",
    consequences: "Máy ì và tốn nhiên liệu",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra lọc gió đúng loại; không tự rửa bằng xăng"
  }),
  entry({
    entry_id: "brake-noise",
    review_status: "source_checked",
    vehicle_scope: "all_motorcycles",
    source_refs: [{ source_id: "yamaha-brake-check", section: "Độ mòn má phanh; bảo dưỡng và vệ sinh sau mưa" }],
    followup_questions: ["Tiếng kêu ở phanh trước hay sau?", "Phanh có yếu, bó cứng hoặc làm xe lệch hướng không?"],
    symptom_keywords: ["kêu két két khi phanh", "phanh kêu két két", "thắng kêu"],
    component_code: "BRAKE_SYSTEM",
    cause: "Cần kiểm tra độ mòn và tình trạng phanh; tiếng kêu chưa xác định được lỗi",
    symptoms: "Phanh kêu két két",
    consequences: "Cần bảo dưỡng để bảo đảm phanh hoạt động an toàn",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra phanh; dừng xe nếu lực phanh giảm"
  }),
  entry({
    entry_id: "vague-running-noise",
    review_status: "internal_policy",
    vehicle_scope: "all_motorcycles",
    source_refs: [],
    followup_questions: ["Tiếng kêu ở bánh trước, bánh sau hay động cơ?", "Tiếng kêu rõ hơn khi tăng ga hay khi phanh?"],
    symptom_keywords: ["kêu è è", "kêu rè rè", "kêu lạ khi chạy", "tiếng kêu khi chạy", "kêu khi chạy", "tiếng lạ"],
    component_code: "UNKNOWN",
    cause: "Tiếng kêu chưa rõ vị trí",
    symptoms: "Xe có tiếng kêu lạ khi đang chạy",
    consequences: "Cần xác định tiếng kêu từ bánh, phanh, động cơ hay nồi xe",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "ask_followup",
    recommended_action_label: "Mô tả thêm vị trí và thời điểm phát ra tiếng kêu"
  }),
  entry({
    entry_id: "drive-belt-running-noise",
    review_status: "source_checked",
    vehicle_scope: "petrol_scooters",
    source_refs: [{ source_id: "yamaha-low-speed-jerk", section: "1.6; 1.7" }],
    followup_questions: ["Xe là xe ga hay xe số, tên mẫu xe là gì?", "Có rung giật khi bắt đầu lên ga không?"],
    symptom_keywords: ["dây curoa kêu", "nồi xe kêu", "kêu khi tăng ga", "kêu phía sau khi tăng ga", "kêu ở phần nồi"],
    component_code: "DRIVE_BELT",
    cause: "Chỉ với xe ga: ly hợp hoặc dây đai mòn có thể gây rung và tiếng ồn",
    symptoms: "Tiếng kêu từ phía nồi xe, thường rõ hơn khi tăng ga",
    consequences: "Xe có thể rung hoặc truyền lực kém nếu để lâu",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Nhờ thợ kiểm tra dây đai và ly hợp của xe ga"
  }),
  entry({
    entry_id: "wheel-bearing-or-tire-noise",
    review_status: "pending",
    vehicle_scope: "all_motorcycles",
    source_refs: [],
    followup_questions: ["Tiếng kêu ở bánh nào?"],
    symptom_keywords: ["ù ù theo tốc độ", "kêu ở bánh", "bánh kêu khi chạy", "bạc đạn kêu", "lốp kêu", "vỏ xe kêu"],
    component_code: "TIRE",
    cause: "Bánh xe, lốp hoặc bạc đạn có thể bất thường",
    symptoms: "Tiếng ù hoặc rè theo tốc độ khi xe chạy",
    consequences: "Có thể ảnh hưởng độ ổn định nếu bạc đạn hoặc lốp hư",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra bánh, lốp và bạc đạn"
  }),
  entry({
    entry_id: "brake-rub-running-noise",
    review_status: "source_checked",
    vehicle_scope: "all_motorcycles",
    source_refs: [{ source_id: "yamaha-brake-check", section: "Độ mòn má phanh; bảo dưỡng và vệ sinh sau mưa" }],
    followup_questions: ["Bánh có bị bó hoặc xe có khó dắt không?", "Tiếng kêu xuất hiện trước hay sau khi bóp phanh?"],
    symptom_keywords: ["phanh cà khi chạy", "bánh bị cà phanh", "phanh kêu khi chạy", "kêu ở bánh khi bóp phanh"],
    component_code: "BRAKE_SYSTEM",
    cause: "Có dấu hiệu bất thường ở phanh, cần kiểm tra độ mòn và vệ sinh",
    symptoms: "Tiếng kêu ở bánh, rõ hơn khi bóp phanh hoặc sau khi phanh",
    consequences: "Cần kiểm tra để bảo đảm phanh hoạt động an toàn",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra phanh; dừng xe nếu bánh bó hoặc phanh yếu"
  }),
  entry({
    entry_id: "fuel-leak",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-fuel-consumption", section: "1. Các dấu hiệu xe máy bị hao xăng" }],
    followup_questions: ["Bạn đã dừng xe ở nơi an toàn chưa?"],
    symptom_keywords: ["chảy xăng", "rò xăng", "mùi xăng nồng"],
    component_code: "FUEL_SYSTEM",
    cause: "Mùi xăng nồng hoặc xăng chảy có thể là dấu hiệu rò nhiên liệu",
    symptoms: "Mùi xăng hoặc xăng chảy",
    consequences: "Nguy cơ cháy nổ",
    risk_level: "critical",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Tắt máy, tránh nguồn lửa và gọi hỗ trợ"
  }),
  entry({
    entry_id: "smoke",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-fuel-consumption", section: "1. Khói thải màu đen hoặc trắng" }],
    followup_questions: ["Khói từ ống xả hay từ thân xe?", "Có mùi cháy hoặc vừa đi ngập nước không?"],
    symptom_keywords: ["bốc khói", "khói trắng", "khói đen"],
    component_code: "ENGINE_OIL",
    cause: "Khói nhiều có thể liên quan dầu lọt buồng đốt hoặc hòa khí dư xăng",
    symptoms: "Xe ra nhiều khói",
    consequences: "Cần kiểm tra động cơ và hệ thống nạp, chưa kết luận từ màu khói",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe và kiểm tra ngay"
  }),
  entry({
    entry_id: "unstable-steering",
    review_status: "source_checked",
    vehicle_scope: "all_motorcycles",
    source_refs: [{ source_id: "yamaha-tires", section: "Vai trò của lốp; thủng lốp và nguy cơ mất lái" }],
    followup_questions: ["Bạn đã dừng xe an toàn chưa?", "Có thấy lốp xẹp hoặc hư hỏng bên ngoài không?"],
    symptom_keywords: ["rung lắc tay lái", "đảo tay lái"],
    component_code: "TIRE",
    cause: "Cần kiểm tra lốp và độ ổn định của xe, chưa xác định nguyên nhân",
    symptoms: "Tay lái rung lắc",
    consequences: "Dễ mất lái",
    risk_level: "critical",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe an toàn"
  }),
  entry({
    entry_id: "flat-or-low-tire",
    review_status: "source_checked",
    vehicle_scope: "all_motorcycles",
    source_refs: [{ source_id: "yamaha-tires", section: "Các loại lốp; lưu ý kiểm tra tình trạng và áp suất" }],
    followup_questions: ["Lốp trước hay sau bị xẹp?", "Lốp đang mất hơi nhanh hay đã xẹp hoàn toàn?"],
    symptom_keywords: ["xẹp lốp", "lốp non hơi", "bánh non hơi", "cán đinh", "thủng lốp", "xe bị xì lốp"],
    component_code: "TIRE",
    cause: "Lốp thiếu áp suất hoặc bị thủng cần kiểm tra trực tiếp",
    symptoms: "Lốp xẹp, mềm hoặc có vật nhọn cắm vào",
    consequences: "Có thể ảnh hưởng khả năng điều khiển xe",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe kiểm tra lốp trước khi chạy tiếp"
  }),
  entry({
    entry_id: "low-engine-oil-or-overheat",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [
      { source_id: "yamaha-oil-check", section: "4.1. Dấu hiệu cần thay nhớt" },
      { source_id: "yamaha-shutdown", section: "1.7. Thiếu nhớt hoặc nước làm mát" }
    ],
    followup_questions: ["Tên mẫu xe và đèn cảnh báo đang sáng là gì?", "Có rò dầu hoặc máy vừa tắt đột ngột không?"],
    symptom_keywords: [
      "máy nóng",
      "xe nóng máy",
      "dầu máy cạn",
      "thiếu dầu máy",
      "đèn báo dầu",
      "máy kêu to",
      "mùi khét máy"
    ],
    component_code: "ENGINE_OIL",
    cause: "Thiếu dầu hoặc vấn đề làm mát có thể gây quá nhiệt",
    symptoms: "Máy nóng, kêu lớn hoặc có mùi khét",
    consequences: "Có thể mòn nặng hoặc bó máy nếu tiếp tục chạy",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Tắt máy; không mở nắp hệ thống làm mát khi còn nóng"
  }),
  entry({
    entry_id: "spark-plug-misfire",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-shutdown", section: "1.1. Bugi bị lỗi; 1.5. Hệ thống điện" }],
    followup_questions: ["Xe giật khi chạy chậm hay lúc tăng ga?", "Có vừa đi mưa, rửa xe hoặc bị tắt máy không?"],
    symptom_keywords: ["xe giật giật", "máy giật", "nổ lụp bụp", "máy hụt", "khó nổ khi trời mưa", "bugi ướt"],
    component_code: "SPARK_PLUG",
    cause: "Đánh lửa kém là một khả năng gây rung giật, chưa đủ để kết luận bugi hỏng",
    symptoms: "Máy giật, hụt ga hoặc nổ không đều",
    consequences: "Xe hao xăng và dễ tắt máy khi chạy chậm",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Nhờ thợ kiểm tra đánh lửa và nhiên liệu"
  }),
  entry({
    entry_id: "dirty-air-filter-rich-running",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-air-filter", section: "1; 3. Lưu ý khi vệ sinh" }],
    followup_questions: ["Lọc gió có từng bị ướt hoặc đã lâu chưa kiểm tra không?", "Xe có khói đen hoặc hụt ga không?"],
    symptom_keywords: ["lọc gió bẩn", "xe ì máy", "máy ì", "hao xăng", "ga yếu", "lên ga chậm"],
    component_code: "AIR_FILTER",
    cause: "Lọc gió bẩn có thể hạn chế không khí nạp",
    symptoms: "Xe ì, hao xăng hoặc lên ga chậm",
    consequences: "Động cơ đốt không tối ưu và tốn nhiên liệu",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra hoặc thay lọc gió"
  }),
  entry({
    entry_id: "water-ingress-after-rain",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [
      { source_id: "yamaha-shutdown", section: "1.5. Hệ thống điện" },
      { source_id: "yamaha-flood", section: "1. Không đề lại sau ngập nước chết máy" }
    ],
    followup_questions: ["Xe chỉ gặp mưa hay đã đi qua vùng ngập?", "Xe đã tắt máy trong nước chưa?"],
    symptom_keywords: [
      "đi mưa chết máy",
      "đi ngập chết máy",
      "xe vô nước",
      "nước vào máy",
      "sau khi rửa xe khó nổ",
      "đi mưa khó nổ",
      "xe ngập nước"
    ],
    component_code: "ELECTRICAL_SYSTEM",
    cause: "Ẩm ở hệ thống điện hoặc nước vào đường nạp là các khả năng cần kiểm tra",
    symptoms: "Xe khó nổ hoặc chết máy sau khi đi mưa, rửa xe hoặc lội nước",
    consequences: "Có thể chập điện hoặc hư động cơ nếu cố đề liên tục",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Không cố đề; đưa người đến nơi an toàn và gọi hỗ trợ"
  }),
  entry({
    entry_id: "charging-system-weak",
    review_status: "pending",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [],
    followup_questions: ["Xe có khó đề hoặc đèn yếu không?"],
    symptom_keywords: [
      "đèn chập chờn",
      "đèn lúc sáng lúc tối",
      "hao bình",
      "sạc không vào",
      "bình nhanh hết",
      "đề vài lần hết điện"
    ],
    component_code: "ELECTRICAL_SYSTEM",
    cause: "Hệ thống sạc, dây điện hoặc bình có thể không ổn định",
    symptoms: "Đèn chập chờn, bình nhanh yếu hoặc đề vài lần hết điện",
    consequences: "Xe có thể hết điện và không khởi động lại được",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra bình, sạc và dây điện"
  }),
  entry({
    entry_id: "weak-light-battery",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [{ source_id: "yamaha-battery", section: "1. Dấu hiệu hết ắc quy; 3.2. Không giữ điện" }],
    followup_questions: ["Đèn yếu khi máy đang chạy hay khi máy đã tắt?", "Bấm đề có yếu hơn bình thường không?"],
    symptom_keywords: ["đèn yếu", "bình yếu", "đèn mờ", "còi yếu"],
    component_code: "BATTERY",
    cause: "Ắc quy yếu là một khả năng khi đèn mờ kèm khó khởi động",
    symptoms: "Đèn yếu, đề yếu",
    consequences: "Có thể hết điện",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra ắc quy; chưa kết luận chỉ từ độ sáng đèn"
  }),
  entry({
    entry_id: "oil-contaminated-after-flood",
    review_status: "source_checked",
    vehicle_scope: "petrol_motorcycles",
    source_refs: [
      { source_id: "yamaha-flood", section: "1. Dầu màu cà phê sữa" },
      { source_id: "yamaha-oil-check", section: "3. Lưu ý về dầu trắng sữa" }
    ],
    followup_questions: ["Xe vừa đi ngập nước không?", "Bạn quan sát màu dầu ở que thăm hay dầu đã xả ra?"],
    symptom_keywords: ["nhớt màu cà phê sữa", "nhớt trắng sữa", "dầu máy trắng sữa", "nhớt lẫn nước"],
    component_code: "ENGINE_OIL",
    cause: "Dầu đổi màu sữa có thể bị nhiễm nước, cần kiểm tra trực tiếp",
    symptoms: "Dầu có màu trắng sữa hoặc cà phê sữa, nhất là sau ngập",
    consequences: "Khả năng bôi trơn suy giảm, có thể hư động cơ",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Không khởi động lại; nhờ thợ kiểm tra dầu và động cơ"
  }),
  entry({
    entry_id: "scooter-jerk-after-flood",
    review_status: "source_checked",
    vehicle_scope: "petrol_scooters",
    source_refs: [{ source_id: "yamaha-flood", section: "4.2. Xe ga giật và kêu ở nồi sau sau ngập" }],
    followup_questions: ["Xe có tắt máy khi đi ngập không?", "Tiếng kêu hoặc rung xuất hiện ngay sau lội nước không?"],
    symptom_keywords: ["xe ga giật sau ngập", "nồi xe kêu sau ngập", "xe ga rung sau lội nước"],
    component_code: "DRIVE_BELT",
    cause: "Chỉ với xe ga: nước hoặc bùn vào ly hợp có thể làm truyền lực không đều",
    symptoms: "Rung giật hoặc tiếng kêu ở nồi sau khi lội nước",
    consequences: "Cần kiểm tra ly hợp, truyền động và ảnh hưởng của ngập nước",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe và nhờ thợ kiểm tra sau ngập"
  })
];
