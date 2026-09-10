export const componentTaxonomy = {
  SPARK_PLUG: "Bugi",
  BATTERY: "Binh ac quy",
  AIR_FILTER: "Loc gio",
  FUEL_SYSTEM: "He thong xang",
  BRAKE_SYSTEM: "He thong phanh",
  ENGINE_OIL: "Dau may",
  DRIVE_BELT: "Day curoa",
  TIRE: "Lop xe",
  ELECTRICAL_SYSTEM: "He thong dien",
  UNKNOWN: "Chua xac dinh"
} as const;

export const componentCodes = Object.keys(componentTaxonomy) as [
  keyof typeof componentTaxonomy,
  ...(keyof typeof componentTaxonomy)[]
];

export type ComponentCode = keyof typeof componentTaxonomy;

export function isComponentCode(value: unknown): value is ComponentCode {
  return typeof value === "string" && value in componentTaxonomy;
}

export function getComponentLabel(code: ComponentCode): string {
  return componentTaxonomy[code];
}

export function normalizeComponentCode(value: unknown): ComponentCode {
  return isComponentCode(value) ? value : "UNKNOWN";
}
