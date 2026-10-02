# Kết quả kiểm thử HTTP ba workflow

**301 PASS · 0 FAIL · 5 BLOCKED / 306 ca riêng biệt.**

Oracle được xây từ tài liệu nghiệp vụ, API contract và giao thức provider công khai trước khi đọc mã triển khai backend. Sau baseline, audit/sửa backend dùng các kỳ vọng đã chốt; kết quả trước sửa được giữ riêng. Mỗi lần chạy lưu mã test/oracle/hash trước khi gửi HTTP. Hiệu chỉnh harness theo contract có chứng cứ trong [ORACLE-REVISIONS.md](ORACLE-REVISIONS.md). Kết quả tổng hợp dùng lần chạy lại được liệt kê bên dưới cho cùng ID, không cộng trùng case.

Đây là tổng hợp baseline và các lượt kiểm tra lại có provenance theo từng ID, không phải một full run trên một snapshot code cuối. Các ca bị ảnh hưởng bởi bốn bản sửa đã chạy lại; unit regression/build dùng code hiện tại.

Kiểm tra workspace cuối:169 file/578 unit-static-route test PASS; typecheck, lint và build API/web PASS. Bản kiểm tra này bao gồm thay đổi health/schema xuất hiện đồng thời trong workspace, ngoài bốn lỗi sửa của lượt này.

JWT Supabase, API HTTP và PostgreSQL thật, migrations001–035 trong schema riêng. SQL chuẩn bị admin và đọc bằng chứng, không ép trạng thái nghiệp vụ. Các ca webhook, đối soát và lỗi FCM dùng provider mô phỏng ở biên mạng. LIVE-001 gọi payOS thật để tạo/đọc/hủy link, không chuyển tiền.

Chế độ legacy tạo fixtures qua API tại commit5307fcc với migrations001–033, rồi dừng process, nâng schema riêng qua034/035 và chạy API hiện tại. Bao gồm quote standard chưa trả, order đã trả trước migration và request thiếu tọa độ; không giả lịch sử bằng SQL.

Backend đã sửa race cùng khóa idempotency ở PostgreSQL, lọc reservation trùng trước dispatch, chuyển webhook sai currency có chữ ký hợp lệ sang needs_review và trả503 cho provider gián đoạn/quota/network. [Bản sửa và bằng chứng](IMPLEMENTATION-FINDINGS.md).

| Nhóm | Tổng | PASS | FAIL | BLOCKED |
|---|---:|---:|---:|---:|
| SEC | 88 | 88 | 0 | 0 |
| MNT | 95 | 95 | 0 | 0 |
| PAY | 45 | 44 | 0 | 1 |
| NTF | 50 | 46 | 0 | 4 |
| EXT | 27 | 27 | 0 | 0 |
| LIVE | 1 | 1 | 0 | 0 |

## Ca chưa đạt

| ID | Case | Kết quả | Bằng chứng/lý do |
|---|---|---|---|
| PAY-043 | Real bank transfer + signed external payOS webhook | BLOCKED | Approved test bank account and explicit money-transfer execution; stub cannot prove settlement [run](reports/2026-10-01T15-05-10.391Z-933b7576/REPORT.md) |
| NTF-044 | Android physical receipt foreground/background/app terminated | BLOCKED | FCM service credentials + registered real-device token + physical receipt observer [run](reports/2026-10-01T15-05-10.391Z-933b7576/REPORT.md) |
| NTF-045 | iOS physical receipt foreground/background/app terminated | BLOCKED | APNs/FCM setup + registered iOS device + physical receipt observer [run](reports/2026-10-01T15-05-10.391Z-933b7576/REPORT.md) |
| NTF-046 | Permission denied/offline/device reconnect/notification tap | BLOCKED | Physical client/device automation and authenticated navigation observer [run](reports/2026-10-01T15-05-10.391Z-933b7576/REPORT.md) |
| NTF-047 | Logout/account switch does not send previous user notices | BLOCKED | Mobile client session/token lifecycle on physical device [run](reports/2026-10-01T15-05-10.391Z-933b7576/REPORT.md) |

## Các lần chạy dùng trong kết luận

- [2026-10-01T15-05-10.391Z-933b7576](reports/2026-10-01T15-05-10.391Z-933b7576/REPORT.md): 257 PASS, 35 FAIL, 11 BLOCKED; schema cor_http_8aa8496dfa2f0568.
- [2026-10-01T17-23-09.921Z-06e836f5](reports/2026-10-01T17-23-09.921Z-06e836f5/REPORT.md): 4 PASS, 2 FAIL, 6 BLOCKED; schema cor_http_55ff98540ea68e20.
- [2026-10-01T18-15-30.756Z-cdec95f8](reports/2026-10-01T18-15-30.756Z-cdec95f8/REPORT.md): 0 PASS, 1 FAIL, 0 BLOCKED; schema cor_http_5b6ffd0a02b517e2.
- [2026-10-01T17-57-02.040Z-ae97fd20](reports/2026-10-01T17-57-02.040Z-ae97fd20/REPORT.md): 27 PASS, 7 FAIL, 0 BLOCKED; schema cor_http_083f61762b49e781.
- [2026-10-01T17-59-44.285Z-c7d5b7a2](reports/2026-10-01T17-59-44.285Z-c7d5b7a2/REPORT.md): 10 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_bfe38f6f31bd5b4a.
- [2026-10-01T18-00-30.601Z-5476c720](reports/2026-10-01T18-00-30.601Z-5476c720/REPORT.md): 1 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_4742997cdd7103a7.
- [2026-10-01T18-04-29.096Z-68080d25](reports/2026-10-01T18-04-29.096Z-68080d25/REPORT.md): 1 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_67c8b686788cc2c7.
- [2026-10-01T18-10-48.792Z-03babd5a](reports/2026-10-01T18-10-48.792Z-03babd5a/REPORT.md): 0 PASS, 1 FAIL, 0 BLOCKED; schema cor_http_8586b0e2833b24c1.
- [2026-10-01T18-26-39.360Z-7ad33cef](reports/2026-10-01T18-26-39.360Z-7ad33cef/REPORT.md): 2 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_40ce0bd025bc38c5.
- [2026-10-01T18-40-10.338Z-39d6511f](reports/2026-10-01T18-40-10.338Z-39d6511f/REPORT.md): 1 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_9ee2f496361376d3.
- [2026-10-01T18-48-16.894Z-ed57fc68](reports/2026-10-01T18-48-16.894Z-ed57fc68/REPORT.md): 0 PASS, 1 FAIL, 0 BLOCKED; schema cor_http_81c37b6a5eff9953.
- [2026-10-01T18-48-51.984Z-cf440875](reports/2026-10-01T18-48-51.984Z-cf440875/REPORT.md): 0 PASS, 0 FAIL, 1 BLOCKED; schema cor_http_3027caabe28664f2.
- [2026-10-01T18-50-53.230Z-89b5c649](reports/2026-10-01T18-50-53.230Z-89b5c649/REPORT.md): 1 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_004fa1db50a19647.
- [2026-10-01T18-54-44.746Z-a384f2c6](reports/2026-10-01T18-54-44.746Z-a384f2c6/REPORT.md): 1 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_e9ef0a1f72ba3e91.
- [2026-10-01T19-10-00.684Z-4bd0e49c](reports/2026-10-01T19-10-00.684Z-4bd0e49c/REPORT.md): 0 PASS, 1 FAIL, 0 BLOCKED; schema cor_http_d24bafc64caa6f53.
- [2026-10-01T19-20-36.493Z-8eb7dea4](reports/2026-10-01T19-20-36.493Z-8eb7dea4/REPORT.md): 0 PASS, 1 FAIL, 0 BLOCKED; schema cor_http_206702779e7b7922.
- [2026-10-01T19-31-22.553Z-40ca5d4c](reports/2026-10-01T19-31-22.553Z-40ca5d4c/REPORT.md): 0 PASS, 0 FAIL, 1 BLOCKED; schema cor_http_a9a05eb6d1c9a162.
- [2026-10-01T19-31-08.375Z-607d1474](reports/2026-10-01T19-31-08.375Z-607d1474/REPORT.md): 1 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_e01d2026ad79d2b6.
- [2026-10-01T19-36-22.017Z-884ce102](reports/2026-10-01T19-36-22.017Z-884ce102/REPORT.md): 1 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_6836c34acbf4a17f.
- [2026-10-01T19-39-13.713Z-c8b0696f](reports/2026-10-01T19-39-13.713Z-c8b0696f/REPORT.md): 3 PASS, 1 FAIL, 0 BLOCKED; schema cor_http_b36588cb6bcc8e19.
- [2026-10-01T20-12-15.997Z-9da4d433](reports/2026-10-01T20-12-15.997Z-9da4d433/REPORT.md): 1 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_b456ae0668e00ded.
- [2026-10-01T20-07-53.513Z-cf2f2859](reports/2026-10-01T20-07-53.513Z-cf2f2859/REPORT.md): 2 PASS, 0 FAIL, 0 BLOCKED; schema cor_http_a7301e456ed9fcb9.

- Lượt 2026-10-01T17-57-02.040Z-ae97fd20 có cập nhật backend giữa lượt ở 2026-10-01T18:39:27.392Z; xem application-changes.json và report tái hiện trước sửa. Oracle không đổi.

## Giới hạn và cách chạy lại

Không có bằng chứng chuyển tiền ngân hàng thật hoặc notice hiển thị trên điện thoại từ các lượt này. Các ca thiết bị/ngân hàng cần observer trong [MANUAL-CASES.md](MANUAL-CASES.md); xem trạng thái từng ID ở bảng trên. Crash/fencing dùng process thật và provider mô phỏng, không chứng minh thanh toán hoặc nhận push vật lý. Ma trận bao phủ các nhánh nghiệp vụ/rủi ro đã liệt kê; không khẳng định đã vét hết mọi input, lịch chạy đồng thời hay hệ điều hành.

Migration035 chưa được áp dụng vào public trong quá trình test. Các schema test được giữ làm bằng chứng; tài khoản Auth fixture được khóa theo cleanup trong từng results.json.

Chạy tự động: `node tests/workflows/run.mjs`. Chạy ID độc lập: `node tests/workflows/run.mjs --only=PAY-017`. Smoke payOS thật: `node tests/workflows/run.mjs --live-payment-smoke`. Các ca phụ thuộc cần fixture trước đó. [Catalogue](TEST-CASES.md), [README](README.md), [Postman HTTP examples](careonroad-workflows.postman_collection.json). Collection lưu ví dụ HTTP; runner thực hiện assertion nghiệp vụ, race, thời gian và lỗi provider.
