# Các lỗi backend đã tái hiện và bản sửa

Oracle HTTP được chốt từ workflow/API/provider contract trước khi đọc implementation.
Baseline được giữ nguyên; việc audit và sửa code chỉ diễn ra sau baseline và yêu cầu
tiếp tục implement. Hiệu chỉnh fixture/contract của harness có ghi trong
[ORACLE-REVISIONS.md](ORACLE-REVISIONS.md).

| Case | Bằng chứng trước sửa | Bản sửa |
|---|---|---|
| MNT-029 | Cùng actor/body/key gửi đồng thời:201 và409 DATABASE_CONFLICT | Transaction advisory lock theo actor/scope/key trước SELECT idempotency. Cùng key replay một request; body khác vẫn conflict. |
| EXT-020 | Lịch trùng một phút vẫn được phát offer | Một query batch tìm reservation trùng trước ranking. Biên kết thúc=bắt đầu vẫn hợp lệ. Scheduled offer dùng thời lượng tối thiểu15m; acceptance vẫn kiểm tra thời lượng thực tế15–480m và DB exclusion. |
| PAY-038 | USD có chữ ký hợp lệ trả401, không vào needs_review | Xác thực chữ ký riêng với kiểm tra currency của order. Receipt sai currency vào review, không credit. Ledger VND lưu event mismatch với currency NULL, không gắn nhãn sai thành VND. |
| PAY-042 | Provider503 bị trả409 CONFLICT tới rider | 5xx/429/network failure trả503 INTERNAL_ERROR để client có thể retry. Provider business rejection giữ409. Retry cùng key giữ một logical order/link, không ghi paid khi lỗi. |

Các file gốc: [idempotency repository](../../apps/api/src/server/repositories/postgres/idempotency.repository.ts),
[dispatch](../../apps/api/src/features/dispatch/dispatch.service.ts),
[payOS verification](../../apps/api/src/features/payments/payos.client.ts),
[payment event persistence](../../apps/api/src/features/payments/payment.service.ts).
Không thêm dependency hoặc migration cho bốn bản sửa.

Lượt baseline303 case:[report](reports/2026-10-01T15-05-10.391Z-933b7576/REPORT.md).
Lượt dữ liệu sạch trước sửa, tái hiện currency và idempotency:
[report](reports/2026-10-01T17-23-09.921Z-06e836f5/REPORT.md).
35 FAIL của baseline bao gồm lỗi fixture/prerequisite/payload test; không phải35 lỗi backend.
Kết luận cuối theo ID và run tương ứng ở [FINAL-REPORT.md](FINAL-REPORT.md).

Đã chạy sau sửa: `pnpm.cmd test` (168 file/568 test PASS),
`pnpm.cmd run typecheck`, `pnpm.cmd run lint`, `pnpm.cmd run build` (API và web)
đều PASS sau bốn bản sửa.
DB integration suite riêng vẫn chưa chạy vì cấu hình test DB trỏ tới application DB;
các HTTP recheck dùng PostgreSQL thật trong schema test riêng.

payOS thật đã qua tạo/đọc/hủy link18.000đ, tiền nhận0:
[LIVE-001](reports/2026-10-01T18-00-30.601Z-5476c720/REPORT.md).
API restart thiếu FCM vẫn giữ inbox và báo lỗi đúng:
[NTF-050](reports/2026-10-01T18-04-29.096Z-68080d25/REPORT.md).
Không có chuyển tiền thật hoặc observer notice trên Android/iOS.

Crash recovery đã có process stop/restart thật với provider wire mô phỏng:
[PAY-045](reports/2026-10-01T18-50-53.230Z-89b5c649/REPORT.md),
[NTF-048](reports/2026-10-01T18-54-44.746Z-a384f2c6/REPORT.md).
PAY-042 sau sửa được kiểm tra riêng:
[report](reports/2026-10-01T18-40-10.338Z-39d6511f/REPORT.md).
Lượt HTTP dài có thêm bản sửa503 giữa lượt; thời điểm/hash được ghi trong
application-changes.json, oracle không đổi. Không gán mọi ca trong lượt đó cho
một application snapshot duy nhất.

Stale-success fencing và rotation lúc token cũ trả UNREGISTERED:
[NTF-049](reports/2026-10-01T19-31-08.375Z-607d1474/REPORT.md) PASS.
Hai process thật, worker cũ pause/resume trong deadline FCM, receipt/outbox
terminal không bị ghi đè và notice tiếp theo gửi tới token mới.
Snooze qua mốc due cũ và xóa snooze khi sửa lịch:
[NTF-013](reports/2026-10-01T19-36-22.017Z-884ce102/REPORT.md) PASS.

Lượt dài ae97fd20 có HTML500 khi mất manifest/vendor chunk trong .next; diagnostics
được giữ trong results.json. Các ca bị ảnh hưởng chạy lại với bản sao API nguyên
source/config và output riêng. Runner hiện luôn dùng copy để ổn định snapshot.

Các ca bị ảnh hưởng bởi .next đã chạy lại:
[reminder + hai nhánh cứu hộ](reports/2026-10-01T19-39-13.713Z-c8b0696f/REPORT.md)
PASS; ca không có thợ bị assertion cleanup ngoài policy và đã
[chạy lại PASS](reports/2026-10-01T20-12-15.997Z-9da4d433/REPORT.md).
Git API trước034/035 tạo fixture legacy qua HTTP rồi nâng schema riêng:
[PAY-044/MNT-095](reports/2026-10-01T20-07-53.513Z-cf2f2859/REPORT.md) PASS,
gồm order đã trả trước migration, quote cũ chưa trả và repair thiếu vị trí.

Tổng hợp301 PASS /0 FAIL /5 BLOCKED trong306 ID, xem FINAL-REPORT.md.
Năm ca còn thiếu bằng chứng ngân hàng/thiết bị vật lý; không tính PASS.

Kiểm tra cuối trên workspace có thêm thay đổi health/schema:169 file/578 test
PASS; typecheck, lint và build API/web PASS. Các thay đổi health/schema đó được
giữ nguyên, không tính vào bốn bản sửa của lượt kiểm thử này.
