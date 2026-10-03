# Admin reminder recovery, dashboard và dispatch configuration

Batch 13 và 15 dùng migrations **044–046**. Các migration đã apply trên Docker test riêng; production rollout vẫn cần preflight và approval triển khai riêng. Các APIs chỉ dành cho app user active có role admin hiện tại; không có admin frontend.

## Reminder recovery

- `GET /api/v1/admin/reminders`: metadata rule, filter `rider_id`, `enabled=true|false`, `from`, `to`, `limit`, `cursor`.
- `GET /api/v1/admin/reminders/{id}` và `/{id}/occurrences`: metadata rule/occurrences; occurrence filter `status`, date window và cursor.
- `GET /api/v1/admin/reminders/worker-health`: worker-run records của `reminders`, phân trang theo completed time.
- `POST /api/v1/admin/reminders/{id}/disable`: `{reason}`.
- `POST /api/v1/admin/reminders/{id}/enable`: `{reason,next_due_at}`; due time phải ở tương lai.
- `POST /api/v1/admin/reminder-occurrences/{id}/retry`: `{reason}`, trả 202. Chỉ occurrence failed, rule enabled, owner/bike còn hợp lệ, tối đa 3 retry. Không retry sent/dismissed/queued, rule/outbox/receipt đang leased, notification terminal hoặc credentials không còn hợp lệ.

Mọi mutation cần `X-Idempotency-Key`; replay giữ cùng response và không tăng retry/version. Khóa bike trước rule để serialize với archive. Archive disables reminder; không được enable/retry hoặc tạo maintenance job từ bike archived. Retry giữ unique `(rule_id,due_at)` và notification dedupe, không tạo lại service request. `failure_count` là lịch sử lỗi tích lũy; successful processing không xóa lịch sử. Inbox/receipt delivery state vẫn thuộc notification pipeline, không dùng occurrence `sent` để giả lập push.

## Dashboard derived từ SQL

`GET /api/v1/admin/dashboard/{summary,dispatch,assignments,mechanics,requests,workers}` nhận `from/to`. Window mặc định 7 ngày, tối đa 31 ngày; counts là trạng thái hiện tại của records tạo trong window (dispatch rounds dùng started time). Current work tách với future reservations và closed history. Không có dashboard table/cache.

`GET /api/v1/admin/dashboard/stuck-workflows` thêm `category`, `limit` (20 mặc định, tối đa 100), opaque `cursor`. Categories: dispatch overdue; manual escalation/no valid offer; stale assignment/unactivated appointment; request/assignment state divergence; outbox dead letter; reminder failures; pending quote/payment; worker missing progress. UUID finding ổn định theo target+category nên một target có nhiều loại lỗi vẫn phân trang đúng.

Thresholds phút: accepted 30, en_route 60, on_site/diagnosis 45, quoted/awaiting_payment 60, in_progress 180; appointment grace 15; pending quote/payment 60; worker progress 15; reminder failure count 3. Response trả thresholds và safe investigation/note/read codes. Không force paid, override state hoặc quảng cáo auto-resolution khi chỉ hỗ trợ điều tra. Reads không thêm audit/outbox; SQL timeout 5 giây.

## Optional dispatch configuration

`ADMIN_DISPATCH_CONFIGURATION_ENABLED=false` mặc định. Khi off, dispatch và admin read dùng policy gốc. Sau schema 046, opt-in `true` để dùng giá trị lưu trong DB.

`GET /api/v1/admin/configuration` đọc effective values/current versions và tối đa 20 phiên bản metadata gần nhất. `PUT /api/v1/admin/configuration/dispatch` nhận `{reason,values}` và idempotency header. `values` gồm ít nhất một trong bốn keys:

| Key | Default | Bounds |
|---|---|---|
| `dispatch.radius_steps_km` | `[2,5,8,12]` | 1–8 số tăng nghiêm ngặt, mỗi số 1–100 km |
| `dispatch.offer_expiry_seconds` | 60 | integer 30–300 |
| `dispatch.max_rounds` | 4 | integer 1–8 |
| `dispatch.total_wait_seconds` | 360 | integer 60–1800, >= effective offer expiry |

Updates khóa cả bộ bốn keys, validate merged policy trước ghi, version tăng atomically, history append-only có RLS và không cấp quyền trực tiếp cho anon/authenticated. SQL cũng kiểm tra bounds/cross-field budget. Không có generic settings, secrets, provider-budget/feature-flag/maintenance/payment-timing mutations.

Migration 046 thay CHECK chỉ cho bốn bán kính mặc định bằng range 1.000–100.000 meters. Config km được làm tròn tới meter gần nhất ở helper chung cho ranking/SQL/explanation. Native regression chạy `[1.0001,3.1234,99.9999]` km thành `[1000,3123,100000]` m qua dispatch và worker, giữ episode snapshot khi config thay đổi. Migration 044/045 đã apply được giữ nguyên; correction dùng migration forward riêng.

Mỗi đợt tìm thợ mới chụp policy vào dispatch round đầu tiên, các round/worker/restart trong cùng đợt dùng snapshot đó. Legacy rounds thiếu snapshot dùng policy gốc. Admin retry mở đợt mới dùng cấu hình mới. Nếu max rounds lớn hơn số radius steps, các round còn lại dùng radius cuối; nếu nhỏ hơn thì dừng ở max rounds. Existing offer expirations không bị sửa khi update config. Disable opt-in khôi phục policy gốc cho runtime.

`GET /api/v1/admin/configuration/provider-budgets` chỉ trả provider configuration metadata; `usage/limit/remaining=null`, `budget_source=unavailable` khi không có nguồn quota. Không bịa remaining credits hoặc trả credential.

## Local acceptance và giới hạn

Chạy `pnpm.cmd test`, `pnpm.cmd run test:db`, typecheck/lint/build; sau build chạy `pnpm.cmd run test:http`. HTTP suite yêu cầu Docker Auth `supabase_auth_careonroad-batch00-test` và DB test riêng đã confirmed. Suite tạo schema/auth accounts tạm, dùng JWT ES256 thật từ Supabase Auth, Next runtime thật và payOS HTTP/signature mô phỏng local; không seed paid/completed. Cleanup chỉ xóa fixtures của suite. `.env.local` production không được sửa và env keys trong child server được override/clear.

HTTP kiểm tra restart thực sau accept, giữa payment initialization và sau khi outbox worker đã claim. Các test chỉ dịch expiry/retry/lease clocks của fixture để vượt thời gian chờ; một occurrence failure được inject để kiểm tra admin retry, còn provider failures và dead-letter do worker xử lý thật. Không seed paid/completed. Performance dùng ít nhất 100 users, 50 mechanics, 100 requests, 50 assignments, 500 audit, 100 notification/outbox/rule/occurrence records; mỗi admin GET có 5 warmups và 20 measured requests.

payOS transaction thật, FCM tới Android/iOS, Google Routes/live tracking enabled và hosted rollout cần môi trường/provider/device riêng. Local mock/signature tests không thay bằng chứng thanh toán hoặc push thật. Xem report batch để biết gate nào đã PASS hoặc còn pending.
