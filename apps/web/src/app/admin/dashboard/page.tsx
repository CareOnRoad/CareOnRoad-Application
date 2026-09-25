import { AdminLayout } from "@/components/admin/admin-layout";
import { BackgroundJobsTable } from "@/components/admin/background-jobs-table";
import { MetricsBento } from "@/components/admin/metrics-bento";
import { NeedsAttentionTable } from "@/components/admin/needs-attention-table";
import { TelemetryMosaic } from "@/components/admin/telemetry-mosaic";
import { WelcomeHeader } from "@/components/admin/welcome-header";

/**
 * /admin/dashboard — Dashboard Tổng quan Điều hành (figma node 253:10232).
 *
 * Layout (theo figma):
 *  - Aside 256px (sidebar với nav + card mạng lưới xe)
 *  - Header 64px (topbar breadcrumb + zone chip + user)
 *  - Main 1136px: 5 sections
 *    1. WelcomeHeader
 *    2. MetricsBento (5 metric cards)
 *    3. TelemetryMosaic (bản đồ + queue surge + geo info)
 *    4. NeedsAttentionTable (bảng 5 yêu cầu cần xử lý)
 *    5. BackgroundJobsTable (4 background jobs)
 */
export default function AdminDashboardPage() {
  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành Cứu hộ", "Trực tiếp — Đã kết nối API thử nghiệm"]}
      active="/admin/dashboard"
    >
      <div className="flex flex-col gap-6">
        <WelcomeHeader />
        <MetricsBento />
        <TelemetryMosaic />
        <NeedsAttentionTable />
        <BackgroundJobsTable />
      </div>
    </AdminLayout>
  );
}
