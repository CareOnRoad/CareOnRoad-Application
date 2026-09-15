import { formatVND } from './mock-data';

interface Diagnosis {
  cause: string;
  advice: string;
  priceLabel: string;
}

const rules: { keywords: string[]; result: Diagnosis }[] = [
  {
    keywords: ["won't start", 'wont start', 'no start', 'dead', 'ignition', 'start'],
    result: {
      cause: 'Likely a weak or dead battery, or a faulty starter relay.',
      advice: 'Try the kick-start. If the lights are dim, it is almost certainly the battery.',
      priceLabel: `${formatVND(120000)} – ${formatVND(450000)}`,
    },
  },
  {
    keywords: ['flat', 'tire', 'tyre', 'puncture', 'nail', 'wheel'],
    result: {
      cause: 'A punctured or flat tire from road debris.',
      advice: "Don't ride on it. Our mechanic carries patch kits and spare tubes.",
      priceLabel: `${formatVND(60000)} – ${formatVND(250000)}`,
    },
  },
  {
    keywords: ['fuel', 'gas', 'petrol', 'empty', 'out of'],
    result: {
      cause: 'Out of fuel — the most common roadside call.',
      advice: 'We can deliver 1–2 litres to get you to the nearest station.',
      priceLabel: `${formatVND(40000)} – ${formatVND(90000)}`,
    },
  },
  {
    keywords: ['smoke', 'overheat', 'hot', 'engine', 'noise', 'knock', 'stall'],
    result: {
      cause: 'Possible engine overheating or oil starvation.',
      advice: 'Switch off the engine immediately to avoid further damage.',
      priceLabel: `${formatVND(200000)} – ${formatVND(900000)}`,
    },
  },
  {
    keywords: ['brake', 'stop', 'squeak', 'grind'],
    result: {
      cause: 'Worn brake pads or a hydraulic brake issue.',
      advice: 'Ride slowly using engine braking until help arrives.',
      priceLabel: `${formatVND(150000)} – ${formatVND(400000)}`,
    },
  },
  {
    keywords: ['chain', 'loose', 'slip', 'drive'],
    result: {
      cause: 'A loose, worn, or derailed drive chain.',
      advice: 'Avoid hard acceleration. This is a quick roadside fix.',
      priceLabel: `${formatVND(80000)} – ${formatVND(300000)}`,
    },
  },
];

export function diagnose(text: string): string {
  const lower = text.toLowerCase();
  const match = rules.find((r) => r.keywords.some((k) => lower.includes(k)));
  const d =
    match?.result ?? {
      cause: 'Based on your description, this could be electrical or fuel-related.',
      advice: 'Share a photo or a few more details and I will narrow it down.',
      priceLabel: `${formatVND(100000)} – ${formatVND(500000)}`,
    };
  return `${d.cause}\n\n${d.advice}\n\nEstimated repair cost: ${d.priceLabel}. A nearby mechanic can confirm on arrival.`;
}

export const aiSuggestions = [
  "My bike won't start",
  'I have a flat tire',
  'Engine is making a strange noise',
  'I ran out of fuel',
];
