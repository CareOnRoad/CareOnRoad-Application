import { NextResponse } from "next/server";
import { downloadDeletionRequests } from "@/app/yeu-cau-xoa-tai-khoan/actions";

/**
 * API route cho admin tải về danh sách yêu cầu xoá tài khoản.
 *
 * Bảo vệ đơn giản bằng header `x-admin-token`. Token này phải trùng với
 * env `ADMIN_DOWNLOAD_TOKEN` (tuỳ chọn). Nếu env không đặt, route trả về 404
 * để tránh lộ endpoint công khai.
 *
 * Dùng cho môi trường closed beta / local admin. Production nên thay bằng
 * session admin thực sự (Supabase + role check).
 */
export async function GET(request: Request) {
  const expected = process.env.ADMIN_DOWNLOAD_TOKEN;
  if (!expected) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const provided = request.headers.get("x-admin-token");
  if (provided !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const text = await downloadDeletionRequests();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(text, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="deletion-requests-${stamp}.txt"`,
    },
  });
}