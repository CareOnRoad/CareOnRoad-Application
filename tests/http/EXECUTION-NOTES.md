# Kết quả kiểm thử HTTP black-box CareOnRoad

**726 PASS · 4 FAIL · 22 BLOCKED / 752 case catalogue.**

Đây là kết quả hợp nhất theo case qua lần chạy đầy đủ và các recheck có chọn lọc; không phải một run mới chạy toàn bộ suite. Giữ nguyên các báo cáo gốc và observations trong assessment.json. 13 nhóm INF mô tả tiền điều kiện/hạ tầng; không quy đổi nhóm chưa chạy thành PASS.

Có 706 request trong Postman collection; workflow/race và một số probe OAuth chạy bằng runner Node. 99 thư mục route: 8 payment bị loại, 91 route còn lại có mapping. Mapping không chứng minh mọi nhánh hoặc mọi tổ hợp state đã được kiểm thử.

## FAIL còn tái hiện

- **OAUTH-01/02:** Google provider tắt (`external.google=false`); authorize nhận `400 validation_failed`. Callback với state giả không cấp token/code. Google login thật vẫn BLOCKED theo lựa chọn người dùng.
- **HTTP-0700:** Admin grant mechanic trên fixture rider2 thành công, nhưng revoke role đó nhận `422 DATABASE_CONSTRAINT_VIOLATION`; tái hiện ở recheck.
- **HTTP-0741:** “Xe đang chạy thì chết máy” không trả risk high/critical như spec; tái hiện. Câu mẫu “Xe chết máy khi đang chạy” đạt. Không suy ra giá trị can_continue_riding vì assertion risk đã dừng case.

**Observation cần theo dõi:** HTTP-0522 từng nhận `500 DATABASE_ERROR` khi mechanic ghi media sang assignment không thuộc mình. Recheck trên assignment/actor context khác trả `403`; không coi là đã sửa app hoặc chứng minh lỗi không còn.

## Các lần chạy thật

| Run (UTC) | Case ghi nhận | PASS | FAIL | BLOCKED | HTTP trong trace |
|---|---:|---:|---:|---:|---:|
| [2026-09-30T18-53-52-693Z-129bdd76](reports/2026-09-30T18-53-52-693Z-129bdd76/REPORT.md) | 752 | 691 | 50 | 11 | 848 |
| [2026-09-30T19-49-55-897Z-a1feb3c7](reports/2026-09-30T19-49-55-897Z-a1feb3c7/REPORT.md) | 89 | 66 | 5 | 18 | 125 |
| [2026-09-30T20-06-48-115Z-8f60c3cb](reports/2026-09-30T20-06-48-115Z-8f60c3cb/REPORT.md) | 10 | 10 | 0 | 0 | 71 |
| [2026-09-30T20-22-34-214Z-251ec2b8](reports/2026-09-30T20-22-34-214Z-251ec2b8/REPORT.md) | 7 | 7 | 0 | 0 | 41 |

Auth setup/login và signed-upload trực tiếp không phải mọi call đều nằm trong trace. Báo cáo recheck đầu dùng mẫu header mẫu số catalogue 752; thực tế có 89 case, như JSON đã ghi. Counts không bị thay đổi.

## Chỉnh lỗi test và tiền điều kiện

- Không đọc implementation/unit tests để dựng oracle. Nguồn: AGENTS, README, OpenAPI/contracts, spec/data-model. Không sửa application để làm test pass.
- Location `204`; cancel bắt buộc reason; Motorcycle/Reminder PATCH dùng đủ input; diagnosis pre-quote sửa một current record. Account type phải bất biến nhưng spec không bắt buộc luôn trả 409.
- Tách idempotency keys khỏi fixture IDs; replay so sánh JSON theo cấu trúc, không theo thứ tự property. Concurrent create cho phép conflict tạm thời nhưng retry phải về cùng một resource và owner list không có duplicate.
- Missing quote UUID có thể bị 404; test role trên resource thật vẫn kiểm tra riêng. safety_answers cho phép additionalProperties theo OpenAPI; audit/outbox redaction được verify riêng.
- PATCH auth/profile có tài liệu mâu thuẫn; request-list filter/cursor validation chưa đủ contract. 12 case này BLOCKED, loại khỏi collection runnable.
- Recheck metadata dùng assignment mới. Account-type/force-unavailable được kiểm tra trên fixture có tiền điều kiện phù hợp; mechanic bị ban nghiệp vụ không được bật lại.
- RECHECK-RELEASE đã sai tiền điều kiện: recovery chỉ accepted/en_route; 409 ở diagnosis là đúng spec. Sáu workflow bị BLOCKED vì mechanic đang bận được chạy lại trên profile idle đã grant cho rider2 fixture: 10/10 đạt, không tạo Auth user mới.
- Review dùng quyền thay đổi trạng thái fixture người dùng đã cấp: xác minh assignment/request riêng không có quote, PATCH trạng thái owner-scoped để tạo completed precondition; không gọi payment hoặc giả paid. Test state mismatch, roles, comments, concurrency, canonical replay, immutable conflict và hai review cho average 3.5/count 2 đều đạt (7/7). Đây không phải bằng chứng workflow completion/payment.
- 80 invalid messages không phải oracle rate-limit có trong spec; recheck valid messages theo T006 (10/hour) nhận 429 và Retry-After. Latest diagnosis vẫn restore đúng sau một case risk FAIL.

## BLOCKED và giới hạn

| Case | Lý do |
|---|---|
| HTTP-0010: PATCH /api/v1/auth/profile: anonymous bị từ chối | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. |
| HTTP-0011: PATCH /api/v1/auth/profile: invalid bị từ chối | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. |
| HTTP-0367: Profile input sai bị chặn | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. |
| HTTP-0368: Profile input sai bị chặn | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. |
| HTTP-0369: Profile input sai bị chặn | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. |
| HTTP-0370: Profile input sai bị chặn | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. |
| HTTP-0371: Đổi display name | AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract. |
| HTTP-0373: Google JWT thật được backend chấp nhận và provider là google | Chưa có API_TEST_GOOGLE_ACCESS_TOKEN từ login Google thật; password JWT không thay thế |
| HTTP-0374: Refresh Google session giữ đúng user; refresh token sai bị từ chối | Thiếu refresh token của Google session test |
| HTTP-0492: Request filter limit=0 | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. |
| HTTP-0493: Request filter limit=101 | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. |
| HTTP-0494: Request filter cursor=invalid | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. |
| HTTP-0495: Request filter status=invalid | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. |
| HTTP-0496: Request filter service_type=invalid | Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation. |
| HTTP-0701: Không revoke last admin chỉ khi fixture thực sự là admin cuối | Project có admin khác; không giả tiền điều kiện last admin |
| HTTP-0721: Worker authorized /reminders/run cần project cô lập | Worker có thể xử lý dữ liệu ngoài fixture; chỉ chạy với API_TEST_ALLOW_GLOBAL_WORKERS=true trên project disposable |
| HTTP-0722: Worker authorized /dispatch/run cần project cô lập | Worker có thể xử lý dữ liệu ngoài fixture; chỉ chạy với API_TEST_ALLOW_GLOBAL_WORKERS=true trên project disposable |
| HTTP-0723: Worker authorized /outbox/run cần project cô lập | Worker có thể xử lý dữ liệu ngoài fixture; chỉ chạy với API_TEST_ALLOW_GLOBAL_WORKERS=true trên project disposable |
| HTTP-0724: Worker authorized /media-uploads/cleanup cần project cô lập | Worker có thể xử lý dữ liệu ngoài fixture; chỉ chạy với API_TEST_ALLOW_GLOBAL_WORKERS=true trên project disposable |
| HTTP-0725: Worker authorized /reviews/rebuild-ratings cần project cô lập | Worker có thể xử lý dữ liệu ngoài fixture; chỉ chạy với API_TEST_ALLOW_GLOBAL_WORKERS=true trên project disposable |
| HTTP-0726: Worker authorized /live-locations/cleanup cần project cô lập | Worker có thể xử lý dữ liệu ngoài fixture; chỉ chạy với API_TEST_ALLOW_GLOBAL_WORKERS=true trên project disposable |
| HTTP-0750: WAV thật → transcription → text diagnosis | Chưa có API_TEST_WAV_PATH/models ONNX hợp lệ |

Ngoài các case trên, nhóm INF gồm Google consent/PKCE browser thực, ASR WAV/models, FCM delivery, worker lease/crash, tracking enabled/expiry, route-provider faults, shared runtime/restart, retention execution và kiểm soát thời gian/offer expiry. Global workers chưa chạy vì quyền chỉ áp dụng fixture riêng; worker có thể tác động dữ liệu ngoài tám account. Retention chỉ dry-run. Standard completion/payment ngoài scope.

## Cleanup và dữ liệu nhạy cảm

- Xác minh bằng HTTP read-only: **8/8 Auth accounts ban**, **6/6 mechanic profiles unavailable**. Cả bốn run dùng đúng cùng tám Auth IDs; không sửa user thật.
- Kiểm tra **208 audit rows, 158 outbox rows** thuộc fixture: không có credential env, raw audio, marker safety token, full diagnosis hoặc review comment marker đã dùng trong test.
- Giữ domain/history/audit để điều tra. Không seed/reset schema, không hard-delete audit, không gọi payOS. Fixture completed chỉ phục vụ test Review được nêu rõ trên.
- Không lưu password, access/refresh token, signed-upload URL hoặc raw .env trong report/collection.

## Chạy và artifact

- [Hướng dẫn](README.md), [catalogue](TEST-CASES.md), [JSON case/payload](test-cases.json), [Postman collection](careonroad.postman_collection.json).
- [Assessment JSON](assessment.json) chứa provenance và mọi failure ban đầu; [verification](reports/2026-09-30T20-22-34-214Z-251ec2b8/fixture-verification.json) ghi cleanup/audit/outbox.
- Node syntax/self-check và 881 Postman scripts đã kiểm tra syntax. Không chạy Vitest/payment/DB reset suite vì yêu cầu là HTTP black-box ngoài payment; không sửa API/TypeScript/schema/frontend.
