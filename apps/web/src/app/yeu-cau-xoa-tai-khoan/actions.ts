"use server";

/**
 * Server actions cho trang Yêu cầu xoá tài khoản.
 *
 * Thiết kế:
 *  - Không cần email service (Resend/SES) — không phụ thuộc DNS domain riêng.
 *  - Mỗi yêu cầu khi user submit form sẽ được ghi xuống file `.txt` trong thư
 *    mục `data/deletion-requests/` trên server. Admin (xem API /tai-ve) có
 *    thể tải về danh sách các yêu cầu để xử lý thủ công.
 *  - User vẫn được hướng dẫn gửi email xác nhận trực tiếp tới
 *    careonroad.work@gmail.com để hoàn tất quy trình xác minh.
 *
 * Tuân thủ Google Play Account Deletion requirements:
 *  - Có URL public cho user khởi tạo yêu cầu.
 *  - Có cách xác minh danh tính (qua email đăng ký).
 *  - Có quy trình xử lý + thông báo hoàn tất.
 *
 * Lưu ý cho production: thư mục `data/` chỉ tồn tại trên server runtime.
 * Nếu dùng Vercel serverless, file này sẽ mất khi function bị đổi instance
 * — phù hợp cho dev/staging/closed-beta. Khi go-live, chuyển sang database.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { DELETION_SUPPORT_EMAIL } from "./constants";

type ActionState =
  | { ok: true; contactEmail: string; savedToFile: boolean }
  | { ok: false; error: string };

const STORAGE_DIR = path.join(process.cwd(), "data", "deletion-requests");

function sanitizeForFilename(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "unknown";
}

async function persistRequestLocally(
  email: string,
  reason: string,
  ip: string | null,
): Promise<boolean> {
  // Vercel serverless không cho ghi file ngoài /tmp → skip im lặng nếu lỗi.
  if (process.env.VERCEL) {
    try {
      await fs.mkdir("/tmp/deletion-requests", { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = path.join(
        "/tmp/deletion-requests",
        `${stamp}-${sanitizeForFilename(email)}.txt`,
      );
      const body = [
        "CareOnRoad — Yêu cầu xoá tài khoản",
        "===================================",
        `Email tài khoản: ${email}`,
        `Lý do: ${reason || "(không cung cấp)"}`,
        `Thời điểm: ${new Date().toISOString()}`,
        `IP (rút gọn): ${ip ?? "(không rõ)"}`,
        "",
        "Vui lòng xác minh qua email đăng ký rồi xử lý xoá trong 7 ngày.",
      ].join("\n");
      await fs.writeFile(file, body, "utf8");
      return true;
    } catch {
      return false;
    }
  }

  // Local / self-hosted: ghi xuống data/deletion-requests/.
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(
      STORAGE_DIR,
      `${stamp}-${sanitizeForFilename(email)}.txt`,
    );
    const body = [
      "CareOnRoad — Yêu cầu xoá tài khoản",
      "===================================",
      `Email tài khoản: ${email}`,
      `Lý do: ${reason || "(không cung cấp)"}`,
      `Thời điểm: ${new Date().toISOString()}`,
      `IP (rút gọn): ${ip ?? "(không rõ)"}`,
      "",
      "Vui lòng xác minh qua email đăng ký rồi xử lý xoá trong 7 ngày.",
    ].join("\n");
    await fs.writeFile(file, body, "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function submitDeletionRequest(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const ip = String(formData.get("ip") ?? "").trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Vui lòng nhập email hợp lệ." };
  }

  const savedToFile = await persistRequestLocally(email, reason, ip);

  return {
    ok: true,
    contactEmail: DELETION_SUPPORT_EMAIL,
    savedToFile,
  };
}

export async function downloadDeletionRequests(): Promise<string> {
  /**
   * Trả về danh sách các yêu cầu đã lưu dưới dạng text thuần.
   * Trên Vercel serverless trả về rỗng (data không persistent).
   * Trên local/self-hosted đọc từ data/deletion-requests/.
   */
  if (process.env.VERCEL) {
    try {
      const dir = "/tmp/deletion-requests";
      const files = await fs.readdir(dir);
      const texts: string[] = [];
      for (const f of files.sort()) {
        const content = await fs.readFile(path.join(dir, f), "utf8");
        texts.push(`--- ${f} ---\n${content}`);
      }
      return texts.join("\n\n");
    } catch {
      return "(Chưa có yêu cầu nào hoặc không truy cập được thư mục /tmp trên Vercel.)";
    }
  }

  try {
    const files = await fs.readdir(STORAGE_DIR);
    const texts: string[] = [];
    for (const f of files.sort()) {
      const content = await fs.readFile(path.join(STORAGE_DIR, f), "utf8");
      texts.push(`--- ${f} ---\n${content}`);
    }
    return texts.join("\n\n") || "(Chưa có yêu cầu nào.)";
  } catch {
    return "(Chưa có yêu cầu nào.)";
  }
}