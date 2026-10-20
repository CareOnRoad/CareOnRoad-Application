import type { ComponentCode } from "./component-taxonomy";
import type { Hypothesis } from "./diagnosis.schema";

// Reference ranges (VND, parts + typical labor) for common scooters/underbones in Vietnam, compiled
// from dealer price lists (Yamaha VN, Honda HEAD) and repair-shop articles. They are rider-facing
// estimates only; the mechanic's quote is authoritative. Re-check when priceCatalogCheckedAt is old.
export const priceCatalogCheckedAt = "2026-10-20";

export const repairPrices = {
  battery_replace: {
    min: 250_000,
    max: 600_000,
    sources: [
      "https://phuocchau.vn/blogs/chia-se-kinh-nghiem/khi-nao-can-thay-binh-ac-quy-xe-vision",
      "https://www.headkhanhan.vn/blogs/bao-duong-xe/phu-tung-xe-may-honda-chinh-hang-bang-gia-dia-chi-mua-uy-tin"
    ]
  },
  spark_plug_replace: {
    min: 50_000,
    max: 200_000,
    sources: [
      "https://yamaha-motor.com.vn/phu-tung/loai/phu-tung/",
      "https://icsparts.vn/phu-tung-honda-chinh-hang-tai-hang-gon-dong-nai-danh-muc-sku-gia-icsparts-da-gom-vat/"
    ]
  },
  air_filter_replace: {
    min: 50_000,
    max: 200_000,
    sources: [
      "https://yamaha-motor.com.vn/phu-tung/loai/phu-tung/",
      "https://www.headkhanhan.vn/blogs/bao-duong-xe/phu-tung-xe-may-honda-chinh-hang-bang-gia-dia-chi-mua-uy-tin"
    ]
  },
  engine_oil_change: {
    min: 80_000,
    max: 200_000,
    sources: [
      "https://tahico.com/thay-nhot-xe-may-bao-nhieu-tien/",
      "https://news-vn.imotorbike.com/2026/05/thay-dau-xe-may-het-bao-nhieu-tien/"
    ]
  },
  // Engine oil plus final-drive oil or a flush after water got in.
  flood_oil_service: {
    min: 150_000,
    max: 400_000,
    sources: [
      "https://vietnamnet.vn/chi-phi-sua-xe-may-sau-khi-bi-ngap-nuoc-het-bao-nhieu-tien-2449864.html",
      "https://tahico.com/thay-nhot-xe-may-bao-nhieu-tien/"
    ]
  },
  injector_cleaning: {
    min: 150_000,
    max: 500_000,
    sources: [
      "https://cor55.com/tin-tuc/gia-ve-sinh-kim-phun-buong-dot-honda/",
      "https://shop2banh.vn/tu-van/ve-sinh-buong-dot-kim-phun-xe-giorno-gia-bao-nhieu-8163.html"
    ]
  },
  brake_pad_replace: {
    min: 80_000,
    max: 350_000,
    sources: [
      "https://yamaha-motor.com.vn/phu-tung/loai/phu-tung/",
      "https://www.headkhanhan.vn/blogs/bao-duong-xe/phu-tung-xe-may-honda-chinh-hang-bang-gia-dia-chi-mua-uy-tin"
    ]
  },
  drive_belt_replace: {
    min: 350_000,
    max: 750_000,
    sources: [
      "https://yamaha-motor.com.vn/phu-tung/bo-day-curoa-va-con-lan/",
      "https://www.headkhanhan.vn/blogs/bao-duong-xe/phu-tung-xe-may-honda-chinh-hang-bang-gia-dia-chi-mua-uy-tin"
    ]
  },
  tire_puncture_repair: {
    min: 20_000,
    max: 100_000,
    sources: [
      "https://alobike.vn/tu-van/va-lop-xe-may-bao-nhieu-tien-1285",
      "https://vnexpress.net/va-xe-dien-kho-khong-cach-va-lui-lop-khong-ruot-xe-dien-va-xe-dien-bao-nhieu-tien-tiem-sua-xe-gan-day-5063095.html"
    ]
  }
} as const;

export type RepairPriceId = keyof typeof repairPrices;

// Most common repair per component. ELECTRICAL_SYSTEM and UNKNOWN have no reliable public price.
export const defaultPriceByComponent: Partial<Record<ComponentCode, RepairPriceId>> = {
  BATTERY: "battery_replace",
  SPARK_PLUG: "spark_plug_replace",
  AIR_FILTER: "air_filter_replace",
  ENGINE_OIL: "engine_oil_change",
  BRAKE_SYSTEM: "brake_pad_replace",
  DRIVE_BELT: "drive_belt_replace",
  TIRE: "tire_puncture_repair",
  FUEL_SYSTEM: "injector_cleaning"
};

export function priceRange(priceId: RepairPriceId | null | undefined): { min: number; max: number } {
  return priceId ? { min: repairPrices[priceId].min, max: repairPrices[priceId].max } : { min: 0, max: 0 };
}

// Hypotheses are alternatives, so the total spans the cheapest to the most expensive priced one.
export function estimateTotal(hypotheses: Pick<Hypothesis, "estimated_cost_min" | "estimated_cost_max">[]) {
  const priced = hypotheses.filter((hypothesis) => hypothesis.estimated_cost_max > 0);
  return {
    currency: "VND" as const,
    min: priced.length ? Math.min(...priced.map((hypothesis) => hypothesis.estimated_cost_min)) : 0,
    max: priced.length ? Math.max(...priced.map((hypothesis) => hypothesis.estimated_cost_max)) : 0
  };
}
