import { normalizeVietnameseText } from "./normalize-vi";

// Words or phrases that only appear when a rider talks about a vehicle. Single generic words
// ("máy", "số", "đề", "đĩa", "nồi") are listed only inside phrases to keep off-topic text out.
const vehicleTerms = [
  "xe", "xe máy", "động cơ", "nổ máy", "chết máy", "tắt máy", "đề máy", "khởi động", "máy yếu", "máy nóng",
  "máy kêu", "máy rung", "không nổ", "đề không", "bấm đề", "đạp đề", "củ đề", "bugi", "ắc quy", "ác quy",
  "acquy", "bình điện", "hết bình", "lốp", "vỏ xe", "săm", "ruột xe", "xì lốp", "xịt lốp", "thủng", "bể bánh",
  "bánh xe", "bánh trước", "bánh sau", "mâm", "vành", "phanh", "thắng", "má phanh", "bố thắng", "dầu phanh",
  "xăng", "hao xăng", "bình xăng", "kim phun", "bơm xăng", "chế hòa khí", "nhớt", "dầu máy", "dầu láp",
  "nhớt láp", "côn", "ly hợp", "bộ nồi", "curoa", "dây curoa", "dây đai", "xích", "sên", "nhông", "hộp số",
  "vào số", "sang số", "tay ga", "hụt ga", "tăng ga", "vặn ga", "giật", "khói", "ống xả", "pô", "đèn pha",
  "xi nhan", "còi", "khóa điện", "smartkey", "cầu chì", "mobin", "tiết chế", "giảm xóc", "phuộc", "ngập nước",
  "khét", "kêu", "rung", "tay lái", "ghi đông", "đĩa phanh", "đồng hồ xe", "fi", "mil", "abs", "honda",
  "yamaha", "suzuki", "sym", "piaggio", "vespa", "vinfast", "vision", "air blade", "airblade", "wave",
  "sirius", "exciter", "winner", "lead", "sh", "future", "jupiter", "janus", "grande", "raider", "liberty",
  "medley", "pcx", "click", "vario"
];

// Accent-free forms that collide with common words (tháng/thằng, để/dễ, nó, mấy, khối, đến, sợ...).
const ambiguousWithoutAccents = new Set(["thang", "khoi", "con", "rung", "po", "giat"]);

const accentedTerms = vehicleTerms.map((term) => ` ${term} `);
const plainTerms = vehicleTerms
  .map((term) => normalizeVietnameseText(term))
  .filter((term) => !ambiguousWithoutAccents.has(term))
  .map((term) => ` ${term} `);

export function isVehicleRelated(text: string): boolean {
  const hasAccents = /[̀-ͯ]/.test(text.normalize("NFD")) || /[đĐ]/.test(text);
  if (hasAccents) {
    const padded = ` ${text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
    return accentedTerms.some((term) => padded.includes(term));
  }

  const padded = ` ${normalizeVietnameseText(text)} `;
  return plainTerms.some((term) => padded.includes(term));
}
