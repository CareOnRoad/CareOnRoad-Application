import type { KnowledgeEntry } from "./knowledge-base";
import { knowledgeBase } from "./knowledge-base";
import { normalizeVietnameseText } from "./normalize-vi";

export type RetrievedKnowledgeEntry = KnowledgeEntry & {
  score: number;
  matched_keywords: string[];
};

export function retrieveKnowledge(input: string, limit = 2): RetrievedKnowledgeEntry[] {
  const normalizedInput = ` ${normalizeVietnameseText(input)} `;

  return knowledgeBase
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
    .sort((a, b) => b.score - a.score || a.entry_id.localeCompare(b.entry_id))
    .slice(0, limit);
}
