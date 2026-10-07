import type { KnowledgeEntry } from "./knowledge-base";
import { knowledgeBase } from "./knowledge-base";
import { normalizeVietnameseText } from "./normalize-vi";

export type RetrievedKnowledgeEntry = KnowledgeEntry & {
  score: number;
  matched_keywords: string[];
};

// These aliases identify a vehicle mentioned in the message, not its model year.
const brandAliases = {
  honda: ["honda", "vision", "sh150i", "sh 150i", "wave alpha"],
  suzuki: ["suzuki", "raider", "fu150mf"],
  sym: ["sym"],
  piaggio: ["piaggio", "liberty", "medley"],
  yamaha: ["yamaha"]
} as const;

export function retrieveKnowledge(input: string, limit = 2): RetrievedKnowledgeEntry[] {
  const normalizedInput = ` ${normalizeVietnameseText(input)} `;
  const contains = (phrase: string) => normalizedInput.includes(` ${normalizeVietnameseText(phrase)} `);
  const brandNames = Object.keys(brandAliases) as Array<keyof typeof brandAliases>;
  const explicitBrands = brandNames.filter((brand) => contains(brand));
  const brands = explicitBrands.length > 0
    ? explicitBrands
    : brandNames.filter((brand) => brandAliases[brand].some(contains));
  const brand = brands.length === 1 ? brands[0] : null;
  const mentionsPH = ["philippines", "philippin", "bản PH", "thị trường PH"].some(contains);
  const mentionsVN = ["việt nam", "bản VN", "thị trường VN"].some(contains);
  // Vietnam is the application's default market; PH always requires an explicit mention.
  const market = mentionsPH && mentionsVN ? null : mentionsPH ? "PH" : "VN";
  const years = [...new Set(normalizedInput.match(/\b(?:19|20)\d{2}\b/g) ?? [])].map(Number);
  const isGeared = ["xe số", "xe côn", "côn tay", "raider", "fu150mf", "wave alpha"].some(contains);
  const isScooter = ["xe ga", "tay ga", "vision", "sh150i", "sh 150i", "liberty", "medley"].some(contains);

  return knowledgeBase
    .filter((entry) => entry.review_status !== "pending")
    .filter((entry) => {
      if (contains("xe điện")) {
        return entry.vehicle_scope === "all_motorcycles";
      }

      if (isGeared) {
        return entry.vehicle_scope !== "petrol_scooters";
      }

      return true;
    })
    .filter((entry) => {
      const scope = entry.applicability;
      if (!scope) return true;
      if (scope.brand !== brand || scope.market !== market) return false;
      if (scope.market === "PH" && contains("bình xăng con")) return false;
      if (entry.vehicle_scope === "petrol_scooters" && !isScooter) return false;
      if (scope.models.length > 0 && !scope.models.some(contains)) return false;
      if (scope.model_years && (years.length !== 1 || !scope.model_years.includes(years[0]))) return false;
      return true;
    })
    .map((entry) => {
      const matchedKeywords = entry.normalized_keywords.filter((keyword) =>
        normalizedInput.includes(` ${keyword} `)
      );

      return {
        ...entry,
        score: matchedKeywords.reduce((score, keyword) => score + keyword.length, 0),
        matched_keywords: matchedKeywords
      };
    })
    .filter((entry) => entry.matched_keywords.length > 0)
    .sort((a, b) => b.score - a.score
      || Number(Boolean(b.applicability)) - Number(Boolean(a.applicability))
      || a.entry_id.localeCompare(b.entry_id))
    .slice(0, limit);
}
