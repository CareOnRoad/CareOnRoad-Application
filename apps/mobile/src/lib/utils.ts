/**
 * cn helper - combines nativewind-aware className merging.
 * For React Native we keep it simple since there is no `twMerge` equivalent
 * required for the demo. Tailwind classes are concatenated and NativeWind's
 * compiler takes care of conflicts.
 */
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(' ');
}
