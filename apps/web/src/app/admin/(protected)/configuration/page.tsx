import {
  fetchAdminConfiguration,
  fetchAdminProviderBudgets
} from "@/lib/api/admin";
import { getAdminSession, settle } from "@/lib/admin/session";

import { AdminLayout } from "@/components/admin/admin-layout";
import { formatDateTime } from "@/components/admin/data-table";
import {
  DetailField,
  StatusBadge
} from "@/components/admin/status-badge";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";

import { DispatchPolicyForm } from "./dispatch-policy-form";

/**
 * /admin/configuration — the "Cấu hình" tab.
 *
 * Reads the live dispatch policy (`GET /api/v1/admin/configuration`) and the
 * provider budgets (`GET /api/v1/admin/configuration/provider-budgets`).
 *
 * Two backend guarantees shape this page:
 *
 * 1. The policy change applies to NEW dispatch episodes only, so the page
 *    states that before the admin edits anything.
 * 2. The configuration history table is APPEND-ONLY (trigger
 *    `admin_operation_config_versions_append_only`), so the history is
 *    rendered read-only and no delete action is offered.
 */
export default async function AdminConfigurationPage() {
  const { actor, session } = await getAdminSession();

  const [configuration, budgets] = await Promise.all([
    settle(fetchAdminConfiguration(session)),
    settle(fetchAdminProviderBudgets(session))
  ]);

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Cấu hình"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Cấu hình"
          description="Chính sách điều phối đang chạy và trạng thái cấu hình nhà cung cấp."
          endpoint="GET /api/v1/admin/configuration"
        />

        {!configuration.ok ? (
          <ErrorState
            title="Không tải được cấu hình"
            message={configuration.error.message}
          />
        ) : (
          <>
            <Panel
              title="Chính sách điều phối hiện tại"
              description={`Phạm vi áp dụng: ${configuration.data.applies_to}. Lịch sử cấu hình là bản ghi chỉ-đọc (append-only), không thể xoá.`}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label="Bán kính điều phối (km)">
                  {configuration.data.values["dispatch.radius_steps_km"].join(", ")}
                </DetailField>
                <DetailField label="Thời hạn đề nghị (giây)">
                  {configuration.data.values["dispatch.offer_expiry_seconds"]}
                </DetailField>
                <DetailField label="Số vòng điều phối tối đa">
                  {configuration.data.values["dispatch.max_rounds"]}
                </DetailField>
                <DetailField label="Tổng thời gian chờ (giây)">
                  {configuration.data.values["dispatch.total_wait_seconds"]}
                </DetailField>
              </div>
            </Panel>

            <Panel
              title="Cập nhật chính sách điều phối"
              description="PUT /api/v1/admin/configuration/dispatch"
            >
              <DispatchPolicyForm current={configuration.data.values} />
            </Panel>

            <Panel
              title="Lịch sử thay đổi cấu hình"
              description={`Chỉ hiển thị ${configuration.data.history_limit} bản ghi gần nhất. Bảng lịch sử là append-only.`}
            >
              {configuration.data.history.length === 0 ? (
                <p className="text-sm" style={{ color: "#3d4d63" }}>
                  Chưa có thay đổi cấu hình nào.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {configuration.data.history.map((entry, index) => (
                    <li
                      key={`${entry.key}-${entry.version}-${index}`}
                      className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs"
                      style={{ backgroundColor: "#f8fafc" }}
                    >
                      <span className="font-semibold" style={{ color: "#162130" }}>
                        {entry.key}
                      </span>
                      <StatusBadge
                        status={`v${entry.version}`}
                        tone="info"
                        label={`phiên bản ${entry.version}`}
                      />
                      <span style={{ color: "#3d4d63" }}>
                        Cập nhật bởi {entry.updated_by}
                      </span>
                      <span style={{ color: "#6b7a8d" }}>
                        {formatDateTime(entry.updated_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}

        <Panel
          title="Ngân sách nhà cung cấp"
          description="GET /api/v1/admin/configuration/provider-budgets — chỉ đọc."
        >
          {!budgets.ok ? (
            <ErrorState
              title="Không tải được trạng thái nhà cung cấp"
              message={budgets.error.message}
            />
          ) : budgets.data.providers.length === 0 ? (
            <p className="text-sm" style={{ color: "#3d4d63" }}>
              Không có nhà cung cấp nào được cấu hình.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {budgets.data.providers.map((provider) => (
                <li
                  key={provider.provider}
                  className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs"
                  style={{ backgroundColor: "#f8fafc" }}
                >
                  <span className="font-semibold" style={{ color: "#162130" }}>
                    {provider.provider}
                  </span>
                  <StatusBadge
                    status={provider.configured ? "configured" : "not_configured"}
                    tone={provider.configured ? "success" : "neutral"}
                    label={provider.configured ? "Đã cấu hình" : "Chưa cấu hình"}
                  />
                  <span style={{ color: "#3d4d63" }}>
                    Nguồn ngân sách: {provider.budget_source}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}
