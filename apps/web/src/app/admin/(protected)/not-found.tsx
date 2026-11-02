import Link from "next/link";

/**
 * The 404 screen of the protected admin area.
 *
 * A detail page calls `notFound()` when the backend answers 404 for the id in
 * the URL. That is the correct semantic: the resource genuinely does not
 * exist (or is not visible to this admin), so the router should render a 404
 * screen rather than an "empty" detail page — an empty page would tell the
 * admin "the record has no data", which is a different and wrong statement.
 *
 * The screen deliberately does NOT say whether the id exists. Distinguishing
 * "does not exist" from "exists but you may not see it" would leak the
 * existence of records the admin is not allowed to read.
 */
export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl bg-white p-8 shadow-sm" style={{ border: "1px solid #e5e9ef" }}>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-bold" style={{ color: "#162130" }}>
          Không tìm thấy dữ liệu
        </h1>
        <p className="text-sm" style={{ color: "#3d4d63" }}>
          Bản ghi này không tồn tại hoặc không còn hiển thị được. Kiểm tra lại
          mã định danh trên thanh địa chỉ.
        </p>
      </div>

      <Link
        href="/admin/dashboard"
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
        style={{ backgroundColor: "#162130" }}
      >
        ← Về tổng quan
      </Link>
    </div>
  );
}
