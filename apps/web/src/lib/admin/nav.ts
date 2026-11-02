/**
 * The admin sidebar configuration.
 *
 * ONE source of truth for the 13 admin tabs. Every page imports it (through
 * `AdminLayout`), so a new tab appears in the menu automatically and no page
 * can ship a stale hard-coded `navItems` list.
 *
 * The tab order mirrors the operational priority: what an admin must watch
 * first (overview → live work → accounts → system) comes first.
 */

export type AdminNavBadge = {
  text: string;
  tone?: "neutral" | "danger";
};

export type AdminNavItem = {
  /** The tab label shown in the sidebar. */
  label: string;
  /** The route the tab maps to. */
  href: string;
  /** A short description used as the page subtitle. */
  description: string;
  /**
   * The backend resource this tab reads. Shown on the page header so the
   * admin can tell which API feeds the screen.
   */
  endpoint: string;
  badge?: AdminNavBadge;
};

export type AdminNavSection = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "overview",
    label: "Tổng quan",
    items: [
      {
        label: "Tổng quan",
        href: "/admin/dashboard",
        description: "Số liệu vận hành và các quy trình bị kẹt.",
        endpoint: "/api/v1/admin/dashboard/*"
      }
    ]
  },
  {
    id: "operations",
    label: "Vận hành",
    items: [
      {
        label: "Yêu cầu cứu hộ",
        href: "/admin/service-requests",
        description: "Theo dõi, điều phối và giám sát từng yêu cầu.",
        endpoint: "/api/v1/admin/service-requests/**"
      },
      {
        label: "Điều phối",
        href: "/admin/assignments",
        description: "Phân công kỹ thuật viên và các vòng điều phối.",
        endpoint: "/api/v1/admin/assignments/**"
      },
      {
        label: "Báo giá",
        href: "/admin/quotes",
        description: "Báo giá, tranh chấp và yêu cầu sửa chẩn đoán.",
        endpoint: "/api/v1/admin/quotes/**"
      }
    ]
  },
  {
    id: "accounts",
    label: "Tài khoản & Kỹ thuật viên",
    items: [
      {
        label: "Kỹ thuật viên",
        href: "/admin/mechanics",
        description: "Duyệt, phạt, kích hoạt và cấu hình kỹ thuật viên.",
        endpoint: "/api/v1/admin/mechanics/**"
      },
      {
        label: "Người dùng",
        href: "/admin/users",
        description: "Tài khoản, vai trò, gói dịch vụ và thiết bị.",
        endpoint: "/api/v1/admin/users/**"
      }
    ]
  },
  {
    id: "system",
    label: "Hệ thống",
    items: [
      {
        label: "Nhắc hẹn",
        href: "/admin/reminders",
        description: "Quy tắc nhắc hẹn bảo dưỡng và các lần nhắc.",
        endpoint: "/api/v1/admin/reminders/**"
      },
      {
        label: "Thông báo",
        href: "/admin/notifications",
        description: "Hộp thư thông báo và trạng thái gửi từng thiết bị.",
        endpoint: "/api/v1/admin/notifications/**"
      },
      {
        label: "Outbox",
        href: "/admin/outbox",
        description: "Sự kiện outbox, sự kiện chết và sức khoẻ worker.",
        endpoint: "/api/v1/admin/outbox/**"
      },
      {
        label: "Thanh toán",
        href: "/admin/payments",
        description: "Đối soát và xử lý các đơn thanh toán cần review.",
        endpoint: "/api/v1/admin/payments/**"
      },
      {
        label: "Nhật ký",
        href: "/admin/audit",
        description: "Nhật ký kiểm toán toàn hệ thống (chỉ đọc).",
        endpoint: "/api/v1/admin/audit/**"
      },
      {
        label: "Cấu hình",
        href: "/admin/configuration",
        description: "Chính sách điều phối và ngân sách nhà cung cấp.",
        endpoint: "/api/v1/admin/configuration/**"
      },
      {
        label: "Vận hành hệ thống",
        href: "/admin/operations",
        description: "Hàng đợi giám sát, sức khoẹ dịch vụ và trạng thái DB.",
        endpoint: "/api/v1/admin/operations/**"
      }
    ]
  }
];

/** Every tab, flattened. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_SECTIONS.flatMap(
  (section) => section.items
);

/** Finds the nav item that owns the given pathname, for the active state. */
export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}

/** The label of the tab that owns the pathname, used in the page header. */
export function adminNavLabelFor(pathname: string): string | undefined {
  return findAdminNavItem(pathname)?.label;
}
