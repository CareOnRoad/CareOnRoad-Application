import type { ComponentType, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

type IconCmp = ComponentType<IconProps>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

function makeIcon(paths: React.ReactNode): IconCmp {
  const Cmp: IconCmp = (props) => (
    <svg {...base} {...props}>
      {paths}
    </svg>
  );
  Cmp.displayName = "CareOnRoadIcon";
  return Cmp;
}

const wrap = makeIcon;

export const PhoneIcon = wrap(
  <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
);
export const MailIcon = wrap(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </>
);
export const ChatIcon = wrap(
  <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z" />
);
export const LocationIcon = wrap(
  <>
    <path d="M12 22s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </>
);
export const ChevronDownIcon = wrap(<path d="m6 9 6 6 6-6" />);
export const ChevronRightIcon = wrap(<path d="m9 6 6 6-6 6" />);
export const ArrowRightIcon = wrap(
  <>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </>
);
export const MenuIcon = wrap(
  <>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </>
);
export const CloseIcon = wrap(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </>
);
export const StarIcon = wrap(
  <path
    fill="currentColor"
    stroke="none"
    d="m12 17.3-6.16 3.7 1.64-7.03L2 9.24l7.19-.62L12 2l2.81 6.62L22 9.24l-5.48 4.73L18.16 21z"
  />
);
export const BoltIcon = wrap(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />);
export const BatteryIcon = wrap(
  <>
    <rect x="2" y="7" width="18" height="10" rx="2" />
    <path d="M22 11v2" />
    <path d="M6 10v4" />
    <path d="M10 10v4" />
    <path d="M14 10v4" />
  </>
);
export const TireIcon = wrap(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v4" />
    <path d="M12 17v4" />
    <path d="M3 12h4" />
    <path d="M17 12h4" />
  </>
);
export const EngineIcon = wrap(
  <>
    <rect x="3" y="8" width="13" height="8" rx="1" />
    <path d="M16 10h3v4h-3" />
    <path d="M19 12h2" />
  </>
);
export const OilIcon = wrap(
  <path d="M12 3c4 4 6 7 6 11a6 6 0 1 1-12 0c0-4 2-7 6-11z" />
);
export const TowIcon = wrap(
  <>
    <path d="M3 17V7h11v10" />
    <path d="M14 11h4l3 3v3h-7" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </>
);
export const ShieldIcon = wrap(
  <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3z" />
);
export const ClockIcon = wrap(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
);
export const WrenchIcon = wrap(
  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-2.6 2.4-2.4z" />
);

export const iconRegistry = {
  phone: PhoneIcon,
  mail: MailIcon,
  chat: ChatIcon,
  location: LocationIcon,
  battery: BatteryIcon,
  tire: TireIcon,
  bolt: BoltIcon,
  engine: EngineIcon,
  oil: OilIcon,
  tow: TowIcon,
  shield: ShieldIcon,
  clock: ClockIcon,
  wrench: WrenchIcon,
} as const satisfies Record<string, IconCmp>;

export type IconKey = keyof typeof iconRegistry;
