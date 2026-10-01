import Image from "next/image";

/**
 * Operational Telemetry Bar & Map Snippet — Dashboard section #3 (figma node 253:10372).
 * 3 khối ngang:
 *  - Khối lớn trái: Vùng phủ sóng mạng cứu hộ (bản đồ placeholder)
 *  - Khối giữa: Đột biến hàng chờ + bar chart 3 chỉ số + nút "Tối ưu hóa điều phối"
 *  - Khối phải: Thông tin địa điểm (Khu vực + Tọa độ cân bằng tải)
 */
export function TelemetryMosaic() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr_1fr]">
      {/* Map / Coverage */}
      <article className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <header className="flex flex-col gap-1">
          <h2 className="text-base font-bold" style={{ color: "#162130" }}>
            Vùng phủ sóng mạng cứu hộ
          </h2>
          <p className="text-xs" style={{ color: "#3d4d63" }}>
            Tọa độ định vị thời gian thực 42 xe cứu hộ đang trực
          </p>
        </header>
        <div className="relative h-[180px] w-full overflow-hidden rounded-xl" style={{ backgroundColor: "#e5e9ef" }}>
          <Image
            src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 360'><rect width='800' height='360' fill='%23dde4ea'/><text x='50%25' y='50%25' fill='%23162130' font-family='sans-serif' font-size='20' text-anchor='middle' dominant-baseline='middle'>Bản đồ phủ sóng — sẽ thêm sau</text></svg>"
            alt=""
            role="presentation"
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className="rounded-md px-2 py-1 font-semibold"
            style={{ backgroundColor: "rgba(61,109,204,0.14)", color: "#3d6dcc" }}
          >
            Thời gian phản hồi trung bình: 14.8 phút
          </span>
          <span
            className="rounded-md px-2 py-1 font-semibold"
            style={{ backgroundColor: "#162130", color: "#fff" }}
          >
            Lưu thông: Ổn định
          </span>
        </div>
      </article>

      {/* Queue surge */}
      <article className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <header className="flex flex-col gap-1">
          <h2 className="text-base font-bold" style={{ color: "#162130" }}>
            Đột biến hàng chờ
          </h2>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#3d6dcc" }}
          >
            Thời gian thực
          </span>
        </header>
        <p className="text-xs" style={{ color: "#3d4d63" }}>
          Tỷ lệ phân bổ yêu cầu &amp; tiếp nhận từ mạng lưới cứu hộ
        </p>

        <div className="flex flex-col gap-3">
          <BarRow label="Tỷ lệ nhận cuộc đầu tiên" value="88.4%" tone="blue" />
          <BarRow label="Cam kết thời gian SLA (< 20 phút)" value="94.1%" tone="green" />
          <BarRow label="Tỷ lệ tranh chấp & khiếu nại" value="2.3%" tone="red" reverse />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "#e5e9ef" }}>
          <span className="text-xs" style={{ color: "#3d4d63" }}>
            Đồng cờ tải đang phân bổ
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: "#162130" }}
          >
            ⚡ Tối ưu hóa điều phối
          </button>
        </div>
      </article>

      {/* Geo info */}
      <article className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <header className="flex flex-col gap-1">
          <h2 className="text-base font-bold" style={{ color: "#162130" }}>
            Thông tin địa điểm
          </h2>
        </header>

        <div className="flex flex-col gap-3 text-sm">
          <div>
            <span className="text-xs" style={{ color: "#3d4d63" }}>
              Khu vực
            </span>
            <p className="text-sm font-semibold" style={{ color: "#162130" }}>
              Vinhomes Grand Park, TP. Thủ Đức, TP.HCM
            </p>
            <p className="text-[11px]" style={{ color: "#3d4d63" }}>
              Hệ tọa độ: WGS 84
            </p>
          </div>
          <div className="border-t pt-3" style={{ borderColor: "#e5e9ef" }}>
            <span className="text-xs" style={{ color: "#3d4d63" }}>
              Tọa độ cân bằng tải
            </span>
            <p className="text-sm font-semibold" style={{ color: "#3d6dcc" }}>
              BẬT (Bán kính 25km)
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg p-3" style={{ backgroundColor: "#f3f5f8" }}>
            <p className="text-xs" style={{ color: "#fff" }}>
              <span className="rounded px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: "#162130" }}>
                XE-442 (The Rainbow — 1.8km tới YC-8921)
              </span>
            </p>
            <p className="text-xs" style={{ color: "#162130" }}>
              <span className="rounded px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: "#f3f5f8" }}>
                YC-8904 (Phân khu Origami: đang chờ xe)
              </span>
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

function BarRow({
  label,
  value,
  tone,
  reverse,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "red";
  reverse?: boolean;
}) {
  const colors = {
    blue: { fg: "#3d6dcc" },
    green: { fg: "#00a23a" },
    red: { fg: "#fc555f" },
  }[tone];
  const numeric = parseFloat(value);
  const fillWidth = reverse ? 100 - numeric : numeric;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs" style={{ color: "#3d4d63" }}>
        <span>{label}</span>
        <span className="font-semibold" style={{ color: colors.fg }}>
          {value}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#e5e9ef" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${fillWidth}%`, backgroundColor: colors.fg }}
        />
      </div>
    </div>
  );
}
