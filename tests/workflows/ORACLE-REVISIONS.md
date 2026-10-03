# Các lần hiệu chỉnh bộ test

Không đọc application/service/handler/repository implementation để xây oracle
ban đầu. Sau khi chốt test và chạy baseline, user yêu cầu tiếp tục implement;
audit/sửa backend dùng kỳ vọng đã chốt, không đổi test theo implementation.
Mỗi lần chạy lưu oracle, mã test và SHA-256
trước khi chạy. Các báo cáo cũ được giữ nguyên, kể cả những lần setup thất bại.

1. Cách ly kết nối: module hook không bắt được dependency đã bundle của Next;
   thay bằng `search_path` trong connection URL, kiểm chứng read-only trước worker.
   Lần kiểm chứng thất bại tạo một profile fixture mới trong public; tài khoản này
   đã bị khóa. Các dữ liệu nghiệp vụ có sẵn không bị sửa. Các lần chạy chính dùng
   schema riêng, không áp dụng migration035 vào public.
2. Clock của test: thay class Date bằng wrapper giữ prototype/hành vi native; giới
   hạn clock điều khiển vào nghiệp vụ. Xác thực JWT user sử dụng clock thật.
   Khóa JWKS công khai được tải từ Supabase thật và cache; chữ ký/issuer/expiry JWT
   vẫn do backend kiểm tra. Fixture access token được refresh theo TTL trả từ Auth.
3. Thời hạn chờ: 45 giây không đủ cho worker xử lý batch trên DB hosted. Tăng
   thời hạn của client test; không đổi logic/state machine. Timeout là BLOCKED,
   không phải bằng chứng lỗi nghiệp vụ. Latency HTTP được lưu để xem lại riêng.
4. Tách fixture dispatch: ca tự tìm thợ vẫn gọi outbox và kiểm tra offer. Các
   fixture độc lập dùng endpoint dispatch đã được tài liệu cho phép, để lỗi worker
   không che các ca báo giá/thanh toán. Quote fixture có expiry 24h; ca hết hạn dùng
   expiry riêng. Không duyệt quote hoặc ghi trạng thái thanh toán bằng SQL.
5. Điều chỉnh oracle HTTP theo contract: purpose `standard` không hợp lệ của
   maintenance có thể bị chặn ở validation hoặc state guard (400/422/409); tài liệu
   không bắt buộc riêng 409. Payment schema không đóng additionalProperties, nên
   quote UUID không tồn tại có thể trả 404 dù có field dư. Ca financial độc lập
   EXT kiểm tra field amount/status/provider với quote hợp lệ: phải bị từ chối
   hoặc không được thay giá/trạng thái server. Không chấp nhận thanh toán sai giá.
6. Bằng chứng SQL dùng đúng tên/enum công khai trong migrations:
   `device_delivery_credentials`, receipt `sent`. Provider signer kiểm chứng bằng
   test vector payOS công khai, chuẩn hóa array đúng protocol; wire stub kiểm tra
   header payOS, chữ ký JWT service account và bearer/payload FCM.
7. Bổ sung các ca cạnh tranh, điều kiện kỹ năng/vị trí/trạng thái thợ, múi giờ,
   480 phút/biên liền kề, chuẩn bị lịch, reconcile thiếu tiền và close_unpaid.
   Các ca này vẫn cần gọi HTTP và kiểm tra dữ liệu thật; không coi unit test đạt
   là bằng chứng E2E.
8. PAY-017: field dư `amount` có thể bị bỏ qua theo schema mở trong contract.
   Sửa trước khi quan sát phản hồi của lần chạy chính: chấp nhận reject hoặc ignore,
   nhưng order tạo thành công phải giữ đúng tổng server và trạng thái pending.
   Oracle cũ đã nạp vào tiến trình vẫn trả FAIL khi nhận 201; chạy lại độc lập với
   quote hợp lệ và giữ báo cáo cũ. Không nới lỏng kiểm tra tiền.
9. Push: worker chạy batch hữu hạn. Bằng chứng DB của lần chạy chính cho thấy các
   notice mới pending, còn receipt sent/invalid thuộc notice cũ. Một lần worker
   không đủ xử lý backlog; token UNREGISTERED có thể bị vô hiệu hóa do notice cũ.
   Chờ hết các fixture cũ trước đăng ký token, rồi chờ attempt của đúng notice.
   Giữ nguyên yêu cầu không gửi trùng/Retry-After/invalidation. Ca quota dùng mốc
   sớm 30s và kiểm chứng next_attempt_at tối thiểu 120s, tránh cộng 119s rồi bỏ qua
   thời gian HTTP thật. Query outbox dùng cột `topic` theo migration002; kết nối
   event-notice qua `aggregate_id` (read-only DB evidence), không giả payload key.
   Clock của provider FCM/OAuth mô phỏng cũng theo clock nghiệp vụ để Retry-After
   tương đối không bị biến thành timestamp quá khứ sau shift. OAuth stub kiểm tra
   chữ ký và iat/exp theo cùng clock này; xác thực JWT Supabase vẫn theo clock thật.
   Fixture503 dùng Retry-After60s để request/SQL hosted không vô tình vượt cửa sổ
   2s trước assertion. Test đòi next_attempt_at đủ60s và không gửi lại sớm.
10. Nếu một ca trước dừng giữa workflow, thợ có thể còn giữ việc hiện tại.
    Positive fixture kiểm tra điều kiện này và ghi BLOCKED thay vì báo lỗi
    matching giả. Các ca bị ảnh hưởng được chạy lại với schema/fixture sạch;
    lỗi gốc vẫn giữ FAIL nếu tái hiện. Ca eligibility phải chứng minh cả hai thợ
    eligible trước khi thay một điều kiện, tránh pass do thợ vốn đã bị chặn.
11. PATCH reminder dùng `ReminderRuleInput` với bốn field required theo contract
    backend-api.yaml; payload chỉ có enabled/next_due_at trong test cũ là sai.
    Chạy lại với payload hợp lệ để kiểm chứng snooze/ownership/recurrence.
    Payment cancel contract cho phép created/pending/failed; order canceled là
    terminal. Repeat có thể trả409 hoặc200, nhưng GET phải còn canceled, paid=0,
    tạo khoản thay thế và hoàn tất đúng tiền. Không yêu cầu200 ngoài contract.
12. Positive booking đặt trước20 phút, vẫn trong preparation window30 phút.
    HTTP hosted trước acceptance có thể sát60s nên fixture+60s dễ hết hạn giữa
    các request. Các ca thời gian quá khứ/hết hạn/biên30 phút dùng mốc riêng.
    Prerequisite current workload dùng tập active status công khai; trạng thái
    terminal `recovery_canceled` không được tính thành việc còn đang làm.
13. Các ca auto-matching đợi đúng event `maintenance.dispatch.requested` qua
    worker batch có giới hạn rồi mới kiểm tra offer/escalation. Không coi một
    lần worker là đã xử lý hết backlog. Không gọi endpoint dispatch trong ca đó.

Baseline dữ liệu sạch tái hiện PAY-038: currency USD có chữ ký hợp lệ trả401.
Đặc tả payment yêu cầu currency mismatch vào needs_review. Giữ nguyên oracle;
sửa backend để nhận diện receipt đã xác thực và chuyển review, không ghi paid.
14. Những nhóm độc lập dùng bản sao source/config API nguyên trạng, mỗi process
    có port/output Next riêng; không sửa service hoặc payload để chạy song song.
    Smoke payOS thật khởi tạo counter mã order trong schema fixture riêng nhằm
    tránh sequence mặc định đụng merchant order cũ. Lượt live đang chạy được
    khởi tạo trước payment, sau khi chứng minh toàn bộ user fixture thuộc run;
    bằng chứng lưu `live-counter-fixture.json`. Không ghi trạng thái nghiệp vụ.
15. MNT-093 dùng lịch tương lai4h và dịch clock tới đúng scheduled_start_at-30m.
    Khoảng3h trước đó chỉ vừa đủ ngay tại thời điểm bắt đầu test cho việc tức thời
    mặc định120m + buffer30m; các HTTP diễn ra sau đó làm hai khoảng thực sự trùng.
    Tạo một khoảng trống thật cho ca "unrelated immediate job", giữ ca overlap
    riêng và kiểm tra việc đang làm vẫn chặn activation ở đúng preparation window.
16. Observer lỗi DB chỉ đọc frame socket và ghi code/routine/constraint/category;
    không ghi query, message hoặc parameters. Có check runnable chứng minh không
    đổi byte/emit và không lộ nội dung. Hai ca500 được chạy lại với cùng backend
    và PASS; chưa đủ chứng cứ quy lỗi trước đó thành lỗi logic hoặc khẳng định
    nguyên nhân tài nguyên cụ thể.
17. PAY-042 dữ liệu sạch tái hiện provider503 -> API409. Giữ oracle retry/service
    failure; sửa payOS client trả503 cho5xx/429/network, còn business rejection
    giữ409. Phiên bản giữa lượt HTTP dài lưu application-changes.json; baseline
    trước sửa và lượt chạy độc lập sau sửa được giữ riêng.
18. Bổ sung restart/barrier cho PAY-045 và NTF-048 vốn đã có trong ma trận manual.
    Chỉ dừng process API copy do runner tạo, kiểm tra port không còn phục vụ và
    giữ schema/fixture config qua restart. Lượt setup gặp DDL deadlock vẫn lưu
    BLOCKED; các schema riêng còn chia sẻ catalog/extension PostgreSQL, nên fixture
    migration được tuần tự hóa trên một reserved connection bằng advisory lock.
    Không khóa request/assignment/payment và không sửa public migration state.
19. NTF-048 kiểm chứng receipt đang giữ lease, status pending và completed_at NULL
    theo enum migration023/columns035; receipt không có enum processing. Lượt đầu
    đã dừng API nhưng assertion enum sai nên giữ FAIL; chạy lại với bằng chứng
    lease + chưa completed, không chấp nhận receipt đã gửi/hoàn tất.

20. NTF-049 lượt4bd0e49c đã có hai process riêng, hai transport acceptance và
    outbox attempt_count=2; receipt chỉ có một kết quả đã commit (attempt_count=1).
    Contract không quy định counter receipt phải tăng ngay lúc claim, trước khi
    kết quả provider được commit. Không dùng counter đó làm bằng chứng reclaim.
    Chạy lại yêu cầu receipt pending/lease held/incomplete khi process cũ đã pause,
    process mới gửi lần thứ hai, outbox claim ít nhất hai lần, rồi resume process
    cũ và so sánh toàn bộ terminal status/completion timestamp/counter không đổi.
    Giữ nguyên kỳ vọng fencing và rotation; không coi hai transport là hai inbox.
    Khởi động peer trước barrier và resume ngay khi receipt/outbox terminal,
    trong deadline FCM30s. Không chờ toàn bộ batch rồi vô tình chỉ kiểm tra stale
    timeout. Nếu DB chậm khiến vượt deadline, ghi BLOCKED, không suy diễn success.
21. NTF-013 contract ReminderRule chỉ yêu cầu id/rider_id/created_at/updated_at;
    snoozed_until là field optional. Response bỏ field khi hết snooze là hợp lệ.
    Test chấp nhận absent/null nhưng yêu cầu cột DB thực sự NULL và reminder chỉ
    tạo một notice theo lịch đã sửa. Bổ sung worker qua mốc due cũ trước PATCH để
    chứng minh snooze đang hoãn nhắc nhở, rồi mới kiểm tra xóa snooze.
22. NTF-049 lượt8eb7dea4 đọc dòng lịch sử credential rotated vì SELECT theo
    device_id không lọc enabled. Migration022 giữ lịch sử và chỉ unique active
    credential; DB có version1 disabled/rotated và version2 enabled sau phản hồi
    UNREGISTERED cũ. Chạy lại đòi đúng một credential active với version mới,
    enabled và notice tiếp theo thực sự đi tới token mới. Không xóa/giả dòng DB.
23. Lượt40ca5d4c gặp deadlock khi setup schema, chưa tạo Auth hay gọi API.
    Reserved client connection không bảo đảm cùng PostgreSQL backend qua một
    transaction pooler, nên session advisory lock giữa các statement không đủ.
    Fixture DDL dùng transaction advisory lock trong từng migration và commit
    từng file, giữ yêu cầu enum additions được commit trước migration tiếp theo.
    Chỉ đổi dựng fixture; không đổi migration SQL hoặc khóa workflow của app.
24. Lượt ae97fd20 mất apps/api/.next/routes-manifest.json và vendor chunk trong
    khi đang chạy, dẫn tới HTML500 ở worker/dispatch/availability. Không quy các
    ca đó thành lỗi domain; giữ FAIL gốc và chạy lại cùng oracle với API copy.
    Runner mặc định luôn sao nguyên source/config và dùng .next riêng, tránh
    build/dev khác trong workspace làm hỏng runtime và giữ app snapshot ổn định.
25. MNT-094 lượt c8b0696f đã đạt manual_escalation và notice; FAIL đến từ cleanup
    đòi rider cancel200. State graph data-model.md chỉ cho submitted/dispatching/
    offered -> canceled; manual_escalation dùng can thiệp riêng. Không đổi policy
    app. Chạy lại giữ kỳ vọng escalation/notice, thêm zero assignment và cancel409
    phải giữ trạng thái escalation. Schema riêng/fixture Auth khóa sau run.
26. Git còn commit5307fcc trước migrations034/035. Chế độ legacy dùng nguyên API
    tại commit đó để tạo báo giá standard đã duyệt, order đã trả và request NULL
    location; rồi stop API, áp migration034/035 trong schema riêng và mở API hiện
    tại. Fixtures hình thành qua HTTP, không sửa trạng thái SQL. Kiểm chứng cả
    chưa trả (vẫn cần prepayment) và đã trả (giữ tiền/lịch sử, không thu lại), cùng
    owner-only/idempotent repair và event matching duy nhất. Runtime dependency
    hiện có được dùng lại; provenance commit và hai source snapshot được lưu.

FCM service credentials và token thiết bị thật chưa được cung cấp đủ cho bộ test
vật lý. Không có chuyển tiền ngân hàng thật hoặc observer trên Android/iOS; các
ca đó được ghi BLOCKED. Lỗi prerequisite khiến các ca phụ thuộc BLOCKED.
