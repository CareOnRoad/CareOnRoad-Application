import type { ComponentCode } from "./component-taxonomy";
import type { RecommendedActionType, RiskLevel } from "./diagnosis.schema";
import { normalizeVietnameseText } from "./normalize-vi";

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
};

function entry(input: Omit<KnowledgeEntry, "normalized_keywords">): KnowledgeEntry {
  return {
    ...input,
    normalized_keywords: input.symptom_keywords.map((keyword) => normalizeVietnameseText(keyword))
  };
}

export const knowledgeBase: KnowledgeEntry[] = [
  entry({
    entry_id: "hard-start-battery",
    symptom_keywords: ["khó đề", "đề không nổ", "đề yếu"],
    component_code: "BATTERY",
    cause: "Bình yếu hoặc cọc bình lỏng",
    symptoms: "Khó đề, đèn yếu",
    consequences: "Có thể không khởi động được",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 120000,
    estimated_cost_max: 550000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra bình và sạc"
  }),
  entry({
    entry_id: "hard-start-spark-plug",
    symptom_keywords: ["khó đề", "đề không nổ", "máy nổ không đều"],
    component_code: "SPARK_PLUG",
    cause: "Bugi yếu hoặc bẩn",
    symptoms: "Khó nổ máy",
    consequences: "Máy hụt và hao xăng",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 50000,
    estimated_cost_max: 180000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra bugi"
  }),
  entry({
    entry_id: "throttle-hesitation",
    symptom_keywords: ["hụp ga", "lên ga hụt", "ga không đều"],
    component_code: "FUEL_SYSTEM",
    cause: "Xăng gió không ổn định",
    symptoms: "Hụp ga",
    consequences: "Xe yếu khi tăng tốc",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 150000,
    estimated_cost_max: 450000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Vệ sinh hệ thống xăng"
  }),
  entry({
    entry_id: "engine-shutdown",
    symptom_keywords: ["tắt máy giữa đường", "chết máy khi đang chạy"],
    component_code: "FUEL_SYSTEM",
    cause: "Nguồn xăng hoặc đánh lửa gián đoạn",
    symptoms: "Tắt máy khi chạy",
    consequences: "Dễ mất an toàn giao thông",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 150000,
    estimated_cost_max: 700000,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe và gọi hỗ trợ"
  }),
  entry({
    entry_id: "fuel-consumption-air-filter",
    symptom_keywords: ["hao xăng", "xe yếu"],
    component_code: "AIR_FILTER",
    cause: "Lọc gió bẩn",
    symptoms: "Hao xăng, xe yếu",
    consequences: "Máy ì và tốn nhiên liệu",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 60000,
    estimated_cost_max: 220000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra lọc gió"
  }),
  entry({
    entry_id: "brake-noise",
    symptom_keywords: ["kêu két két khi phanh", "phanh kêu két két", "thắng kêu"],
    component_code: "BRAKE_SYSTEM",
    cause: "Má phanh mòn hoặc bẩn",
    symptoms: "Phanh kêu két két",
    consequences: "Phanh kém dần nếu để lâu",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 120000,
    estimated_cost_max: 450000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra phanh sớm"
  }),
  entry({
    entry_id: "vague-running-noise",
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
    symptom_keywords: ["dây curoa kêu", "nồi xe kêu", "kêu khi tăng ga", "kêu phía sau khi tăng ga", "kêu ở phần nồi"],
    component_code: "DRIVE_BELT",
    cause: "Dây curoa hoặc cụm nồi xe có thể bẩn, mòn hoặc trượt",
    symptoms: "Tiếng kêu từ phía nồi xe, thường rõ hơn khi tăng ga",
    consequences: "Xe có thể rung hoặc truyền lực kém nếu để lâu",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 180000,
    estimated_cost_max: 900000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra dây curoa và nồi xe"
  }),
  entry({
    entry_id: "wheel-bearing-or-tire-noise",
    symptom_keywords: ["ù ù theo tốc độ", "kêu ở bánh", "bánh kêu khi chạy", "bạc đạn kêu", "lốp kêu", "vỏ xe kêu"],
    component_code: "TIRE",
    cause: "Bánh xe, lốp hoặc bạc đạn có thể bất thường",
    symptoms: "Tiếng ù hoặc rè theo tốc độ khi xe chạy",
    consequences: "Có thể ảnh hưởng độ ổn định nếu bạc đạn hoặc lốp hư",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 120000,
    estimated_cost_max: 700000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra bánh, lốp và bạc đạn"
  }),
  entry({
    entry_id: "brake-rub-running-noise",
    symptom_keywords: ["phanh cà khi chạy", "bánh bị cà phanh", "phanh kêu khi chạy", "kêu ở bánh khi bóp phanh"],
    component_code: "BRAKE_SYSTEM",
    cause: "Phanh có thể cà đĩa hoặc má phanh bẩn, mòn",
    symptoms: "Tiếng kêu ở bánh, rõ hơn khi bóp phanh hoặc sau khi phanh",
    consequences: "Có thể nóng phanh, mòn phanh nhanh hoặc giảm hiệu quả phanh",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 120000,
    estimated_cost_max: 500000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra má phanh và đĩa phanh"
  }),
  entry({
    entry_id: "fuel-leak",
    symptom_keywords: ["chảy xăng", "rò xăng", "mùi xăng nồng"],
    component_code: "FUEL_SYSTEM",
    cause: "Rò rỉ đường xăng",
    symptoms: "Mùi xăng hoặc xăng chảy",
    consequences: "Nguy cơ cháy nổ",
    risk_level: "critical",
    can_continue_riding: false,
    estimated_cost_min: 100000,
    estimated_cost_max: 650000,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe và gọi hỗ trợ"
  }),
  entry({
    entry_id: "smoke",
    symptom_keywords: ["bốc khói", "khói trắng", "khói đen"],
    component_code: "ENGINE_OIL",
    cause: "Dầu máy hoặc hòa khí bất thường",
    symptoms: "Xe ra nhiều khói",
    consequences: "Có thể hư động cơ",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 150000,
    estimated_cost_max: 1200000,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe và kiểm tra ngay"
  }),
  entry({
    entry_id: "unstable-steering",
    symptom_keywords: ["rung lắc tay lái", "đảo tay lái"],
    component_code: "TIRE",
    cause: "Lốp, chén cổ hoặc bánh xe bất thường",
    symptoms: "Tay lái rung lắc",
    consequences: "Dễ mất lái",
    risk_level: "critical",
    can_continue_riding: false,
    estimated_cost_min: 150000,
    estimated_cost_max: 900000,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe an toàn"
  }),
  entry({
    entry_id: "flat-or-low-tire",
    symptom_keywords: ["xẹp lốp", "lốp non hơi", "bánh non hơi", "cán đinh", "thủng lốp", "xe bị xì lốp"],
    component_code: "TIRE",
    cause: "Lốp non hơi, cán đinh hoặc thủng lốp",
    symptoms: "Xe nặng lái, đảo nhẹ hoặc bánh mềm",
    consequences: "Dễ mất ổn định, mòn lốp nhanh và giảm hiệu quả phanh",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 30000,
    estimated_cost_max: 350000,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Dừng xe kiểm tra lốp trước khi chạy tiếp"
  }),
  entry({
    entry_id: "low-engine-oil-or-overheat",
    symptom_keywords: ["máy nóng", "xe nóng máy", "dầu máy cạn", "thiếu dầu máy", "đèn báo dầu", "máy kêu to", "mùi khét máy"],
    component_code: "ENGINE_OIL",
    cause: "Dầu máy thiếu, xuống cấp hoặc động cơ đang quá nóng",
    symptoms: "Máy nóng, kêu lớn hoặc có mùi khét",
    consequences: "Có thể mòn nặng hoặc bó máy nếu tiếp tục chạy",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 90000,
    estimated_cost_max: 1200000,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Tắt máy và kiểm tra dầu máy"
  }),
  entry({
    entry_id: "spark-plug-misfire",
    symptom_keywords: ["xe giật giật", "máy giật", "nổ lụp bụp", "máy hụt", "khó nổ khi trời mưa", "bugi ướt"],
    component_code: "SPARK_PLUG",
    cause: "Bugi yếu, bẩn hoặc đánh lửa không ổn định",
    symptoms: "Máy giật, hụt ga hoặc nổ không đều",
    consequences: "Xe hao xăng và dễ tắt máy khi chạy chậm",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 50000,
    estimated_cost_max: 220000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra và vệ sinh hoặc thay bugi"
  }),
  entry({
    entry_id: "dirty-air-filter-rich-running",
    symptom_keywords: ["lọc gió bẩn", "xe ì máy", "máy ì", "hao xăng", "ga yếu", "lên ga chậm"],
    component_code: "AIR_FILTER",
    cause: "Lọc gió bẩn làm gió vào động cơ kém",
    symptoms: "Xe ì, hao xăng hoặc lên ga chậm",
    consequences: "Động cơ đốt không tối ưu và tốn nhiên liệu",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 60000,
    estimated_cost_max: 250000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra hoặc thay lọc gió"
  }),
  entry({
    entry_id: "water-ingress-after-rain",
    symptom_keywords: ["đi mưa chết máy", "đi ngập chết máy", "xe vô nước", "nước vào máy", "sau khi rửa xe khó nổ", "đi mưa khó nổ"],
    component_code: "ELECTRICAL_SYSTEM",
    cause: "Nước có thể vào hệ thống điện, bugi hoặc đường nạp",
    symptoms: "Xe khó nổ hoặc chết máy sau khi đi mưa, rửa xe hoặc lội nước",
    consequences: "Có thể chập điện hoặc hư động cơ nếu cố đề liên tục",
    risk_level: "high",
    can_continue_riding: false,
    estimated_cost_min: 100000,
    estimated_cost_max: 900000,
    recommended_action_type: "emergency_rescue",
    recommended_action_label: "Không cố đề, dựng xe nơi khô và gọi hỗ trợ"
  }),
  entry({
    entry_id: "charging-system-weak",
    symptom_keywords: ["đèn chập chờn", "đèn lúc sáng lúc tối", "hao bình", "sạc không vào", "bình nhanh hết", "đề vài lần hết điện"],
    component_code: "ELECTRICAL_SYSTEM",
    cause: "Hệ thống sạc, dây điện hoặc bình có thể không ổn định",
    symptoms: "Đèn chập chờn, bình nhanh yếu hoặc đề vài lần hết điện",
    consequences: "Xe có thể hết điện và không khởi động lại được",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 120000,
    estimated_cost_max: 850000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra bình, sạc và dây điện"
  }),
  entry({
    entry_id: "weak-light-battery",
    symptom_keywords: ["đèn yếu", "bình yếu", "đèn mờ"],
    component_code: "BATTERY",
    cause: "Bình yếu hoặc hệ thống sạc kém",
    symptoms: "Đèn yếu, đề yếu",
    consequences: "Có thể hết điện",
    risk_level: "low",
    can_continue_riding: true,
    estimated_cost_min: 120000,
    estimated_cost_max: 600000,
    recommended_action_type: "book_mobile_repair",
    recommended_action_label: "Kiểm tra bình và sạc"
  })
];
