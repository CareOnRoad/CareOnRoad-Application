import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";
import type {
  RequestCodePrefix,
  RequestCodeRepository
} from "@/server/repositories/contracts/request-code.repository";

const SERVICE_PREFIXES: Record<ServiceType, RequestCodePrefix> = {
  emergency_rescue: "EMR",
  mobile_repair: "MOB",
  at_home_service: "HOME",
  periodic_maintenance: "MNT",
  other: "OTH"
};

export class RequestCodeService {
  constructor(private readonly repository: RequestCodeRepository) {}

  async allocate(serviceType: ServiceType, now: Date): Promise<string> {
    const prefix = SERVICE_PREFIXES[serviceType];
    const localDate = formatHoChiMinhLocalDate(now);
    const sequence = await this.repository.allocateNext(prefix, localDate, now);
    return `COR-${prefix}-${localDate.replaceAll("-", "")}-${sequence.lastSequence}`;
  }
}

export function requestCodePrefixForServiceType(serviceType: ServiceType): RequestCodePrefix {
  return SERVICE_PREFIXES[serviceType];
}

export function formatHoChiMinhLocalDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not format Asia/Ho_Chi_Minh request-code date.");
  }
  return `${year}-${month}-${day}`;
}
