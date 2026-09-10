export function normalizeVietnameseText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function includesNormalizedPhrase(input: string, phrase: string): boolean {
  const normalizedInput = ` ${normalizeVietnameseText(input)} `;
  const normalizedPhrase = ` ${normalizeVietnameseText(phrase)} `;

  return normalizedInput.includes(normalizedPhrase);
}
