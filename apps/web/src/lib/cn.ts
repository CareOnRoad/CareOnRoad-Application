/* eslint-disable @typescript-eslint/no-explicit-any */
export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | { [key: string]: any };

/** Minimal `cn` helper that mirrors the behaviour we use across components. */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const push = (value: ClassValue): void => {
    if (!value && value !== 0) return;
    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value === "object") {
      for (const [key, val] of Object.entries(value)) {
        if (val) out.push(key);
      }
    }
  };

  inputs.forEach(push);
  return out.join(" ");
}
