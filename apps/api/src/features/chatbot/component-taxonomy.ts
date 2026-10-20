export const componentTaxonomy = {
  SPARK_PLUG: "Bugi",
  BATTERY: "Bình ắc quy",
  AIR_FILTER: "Lọc gió",
  FUEL_SYSTEM: "Hệ thống xăng",
  BRAKE_SYSTEM: "Hệ thống phanh",
  ENGINE_OIL: "Dầu máy",
  DRIVE_BELT: "Dây curoa",
  TIRE: "Lốp xe",
  ELECTRICAL_SYSTEM: "Hệ thống điện",
  UNKNOWN: "Chưa xác định"
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
