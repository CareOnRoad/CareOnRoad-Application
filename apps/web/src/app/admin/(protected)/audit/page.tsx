import {
  fetchAdminAudit,
  fetchAdminAuditActor,
  fetchAdminAuditAdminActions,
  fetchAdminAuditEntity,
  fetchAdminAuditExport
} from "@/lib/api/admin";
import {
  flattenSearchParams,
  getAdminSession,
  readParam,
  settle,
  type AdminSearchParams
} from "@/lib/admin/session";

import { AdminLayout } from "@/components/admin/admin-layout";
import {
  CursorPagination,
  DataTable,
  buildCursorHref,
  formatDateTime,
  type AdminTableColumn
} from "@/components/admin/data-table";
import { ErrorState, PageHeader, Panel } from "@/components/admin/page-header";
import { BooleanBadge } from "@/components/admin/status-badge";

import type { AdminAuditRow } from "@careonroad/api-contract/admin/audit";

/**
 * /admin/audit — the "Nhật ký" tab.
 *
 * Reads `GET /api/v1/admin/audit`, the admin-only action log and the export
 * envelope.
 *
 * IMPORTANT — the audit trail is APPEND-ONLY in PostgreSQL (a trigger
 * rejects any mutation). This page therefore offers NO delete or edit
 * action, and the wording never suggests one is possible.
 */
export default async function AdminAuditPage({
  searchParams
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const { actor, session } = await getAdminSession();
  const params = await searchParams;

  const action = readParam(params, "action");
  const entityType = readParam(params, "entity_type");
  const entityId = readParam(params, "entity_id");
  const actorId = readParam(params, "actor_id");
  const cursor = readParam(params, "cursor");
  const flatParams = flattenSearchParams(params);

  const [listResult, adminActionsResult, exportResult] = await Promise.all([
    settle(
      fetchAdminAudit(session, {
        action,
        entity_type: entityType,
        entity_id: entityId,
        actor_id: actorId,
        cursor,
        limit: 20
      })
    ),
    settle(fetchAdminAuditAdminActions(session, { cursor, limit: 20 })),
    settle(
      fetchAdminAuditExport(session, {
        actor_id: actorId,
        entity_type: entityType,
        entity_id: entityId,
        action,
        limit: 100
      })
    )
  ]);

  // The actor and entity views are the two scoped audit reads. They are only
  // requested when the admin actually supplied the corresponding ids, so a
  // plain list view does not pay for two extra round trips.
  const actorResult = actorId
    ? await settle(fetchAdminAuditActor(session, actorId, { limit: 20 }))
    : null;
  const entityResult =
    entityType && entityId
      ? await settle(
          fetchAdminAuditEntity(session, entityType, entityId, { limit: 20 })
        )
      : null;

  return (
    <AdminLayout
      crumb={["CareOnRoad", "Điều hành", "Nhật ký"]}
      userName={actor.display_name?.trim() || "Quản trị viên"}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Nhật ký kiểm toán"
          description="Nhật ký chỉ đọc và chỉ ghi thêm — không thể sửa hoặc xoá. Mọi thao tác quản trị đều được ghi lại kèm lý do."
          endpoint="GET /api/v1/admin/audit"
        />

        <Panel title="Bộ lọc">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <TextField label="Hành động" name="action" defaultValue={action} />
            <TextField label="Loại đối tượng" name="entity_type" defaultValue={entityType} />
            <TextField label="Mã đối tượng (UUID)" name="entity_id" defaultValue={entityId} />
            <TextField label="Mã người thực hiện (UUID)" name="actor_id" defaultValue={actorId} />
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "#162130" }}
            >
              Áp dụng
            </button>
          </form>
        </Panel>

        <Panel title="Nhật ký">
          {!listResult.ok ? (
            <ErrorState
              title="Không tải được nhật ký kiểm toán"
              message={listResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminAuditRow>
                caption="Nhật ký kiểm toán"
                rows={listResult.data.items}
                emptyLabel="Không có bản ghi nào khớp bộ lọc."
                columns={columns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={listResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}
        </Panel>

        {actorResult ? (
          <Panel
            title="Nhật ký theo người thực hiện"
            description={`GET /api/v1/admin/audit/actors/${actorId}`}
          >
            {!actorResult.ok ? (
              <ErrorState
                title="Không tải được nhật ký theo người thực hiện"
                message={actorResult.error.message}
              />
            ) : (
              <DataTable<AdminAuditRow>
                caption="Nhật ký theo người thực hiện"
                rows={actorResult.data.items}
                emptyLabel="Người thực hiện này chưa có hành động nào."
                columns={columns}
                rowKey={(row) => row.id}
              />
            )}
          </Panel>
        ) : null}

        {entityResult ? (
          <Panel
            title="Nhật ký theo đối tượng"
            description={`GET /api/v1/admin/audit/entities/${entityType}/${entityId}`}
          >
            {!entityResult.ok ? (
              <ErrorState
                title="Không tải được nhật ký theo đối tượng"
                message={entityResult.error.message}
              />
            ) : (
              <DataTable<AdminAuditRow>
                caption="Nhật ký theo đối tượng"
                rows={entityResult.data.items}
                emptyLabel="Đối tượng này chưa có hành động nào."
                columns={columns}
                rowKey={(row) => row.id}
              />
            )}
          </Panel>
        ) : null}

        <Panel
          title="Hành động quản trị"
          description="GET /api/v1/admin/audit/admin-actions"
        >
          {!adminActionsResult.ok ? (
            <ErrorState
              title="Không tải được danh sách hành động quản trị"
              message={adminActionsResult.error.message}
            />
          ) : (
            <>
              <DataTable<AdminAuditRow>
                caption="Hành động quản trị"
                rows={adminActionsResult.data.items}
                emptyLabel="Chưa có hành động quản trị nào."
                columns={columns}
                rowKey={(row) => row.id}
              />
              <CursorPagination
                page={adminActionsResult.data.page}
                buildHref={(next) => buildCursorHref(flatParams, next)}
              />
            </>
          )}
        </Panel>

        <Panel
          title="Kết xuất nhật ký"
          description="GET /api/v1/admin/audit/export"
        >
          {!exportResult.ok ? (
            <ErrorState
              title="Không tải được dữ liệu kết xuất"
              message={exportResult.error.message}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#3d4d63" }}>
                <span>
                  Đã kết xuất{" "}
                  <strong style={{ color: "#162130" }}>
                    {exportResult.data.exported_count}
                  </strong>{" "}
                  bản ghi
                </span>
                <span>
                  Thời điểm: {formatDateTime(exportResult.data.exported_at)}
                </span>
                <span>
                  {exportResult.data.has_more
                    ? "Còn dữ liệu ngoài lô kết xuất này."
                    : "Đã kết xuất toàn bộ kết quả lọc."}
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

const columns: AdminTableColumn<AdminAuditRow>[] = [
  {
    key: "action",
    header: "Hành động",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#162130" }}>
        {row.action}
      </span>
    )
  },
  {
    key: "entity",
    header: "Đối tượng",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {row.entity_type}
        {row.entity_id ? ` · ${row.entity_id}` : ""}
      </span>
    )
  },
  {
    key: "actor",
    header: "Người thực hiện",
    render: (row) => (
      <span className="font-mono text-xs" style={{ color: "#6b7a8d" }}>
        {row.actor_id ?? "—"}
        {row.actor_role ? ` (${row.actor_role})` : ""}
      </span>
    )
  },
  {
    key: "has_admin_reason",
    header: "Có lý do",
    render: (row) => <BooleanBadge value={row.has_admin_reason} />
  },
  {
    key: "created_at",
    header: "Thời điểm",
    render: (row) => (
      <span className="text-xs" style={{ color: "#3d4d63" }}>
        {formatDateTime(row.created_at)}
      </span>
    )
  }
];

function TextField({
  label,
  name,
  defaultValue
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "#3d4d63" }}
      >
        {label}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? ""}
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          border: "1px solid #e5e9ef",
          backgroundColor: "#fff",
          color: "#162130"
        }}
      />
    </label>
  );
}

