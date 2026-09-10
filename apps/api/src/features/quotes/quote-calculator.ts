import type { QuoteLineInput } from "./quote.schemas";

export const MAX_QUOTE_AMOUNT = Number.MAX_SAFE_INTEGER;

export type CalculatedQuoteLine = QuoteLineInput & {
  line_total_amount: number;
};

export type CalculatedQuote = {
  lines: CalculatedQuoteLine[];
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
};

export class QuoteCalculationError extends Error {}

export function calculateQuote(
  lines: QuoteLineInput[],
  discountAmount: number
): CalculatedQuote {
  if (!Number.isSafeInteger(discountAmount) || discountAmount < 0) {
    throw new QuoteCalculationError("Discount amount is invalid.");
  }

  let subtotal = 0n;
  const calculatedLines = lines.map((line) => {
    if (!Number.isSafeInteger(line.unit_amount) || line.unit_amount < 0) {
      throw new QuoteCalculationError("Unit amount is invalid.");
    }
    const quantityHundredths = Math.round(line.quantity * 100);
    if (
      quantityHundredths <= 0 ||
      !Number.isSafeInteger(quantityHundredths) ||
      Math.abs(quantityHundredths / 100 - line.quantity) > Number.EPSILON
    ) {
      throw new QuoteCalculationError("Quantity is invalid.");
    }
    const raw = BigInt(quantityHundredths) * BigInt(line.unit_amount);
    const lineTotal = (raw + 50n) / 100n;
    subtotal += lineTotal;
    assertSafeAmount(lineTotal);
    assertSafeAmount(subtotal);
    return {
      ...line,
      line_total_amount: Number(lineTotal)
    };
  });

  const discount = BigInt(discountAmount);
  if (discount > subtotal) {
    throw new QuoteCalculationError("Discount cannot exceed subtotal.");
  }
  const total = subtotal - discount;
  assertSafeAmount(total);

  return {
    lines: calculatedLines,
    subtotal_amount: Number(subtotal),
    discount_amount: discountAmount,
    total_amount: Number(total)
  };
}

function assertSafeAmount(value: bigint): void {
  if (value > BigInt(MAX_QUOTE_AMOUNT)) {
    throw new QuoteCalculationError("Quote amount exceeds the supported range.");
  }
}
