# Kho kiến thức chatbot CareOnRoad

Phiên bản hiện tại: `2026-10-03.2`, đối chiếu nguồn ngày **03/10/2026**.
Kho hiện có 32 mục: **28 mục đã đối chiếu nguồn**, **2 quy tắc nội bộ hỏi thêm**,
**2 mục chờ xác minh bị loại khỏi retrieval**. Dữ liệu nằm trong
`src/features/chatbot/knowledge-base.ts`; danh mục 13 nguồn nằm trong
`src/features/chatbot/knowledge-sources.ts`.

## Nguồn và phạm vi

Các nguồn dưới đây thuộc website chính thức Yamaha, Honda, Suzuki, SYM và Piaggio. Chỉ biên soạn
các ghi chú ngắn bằng tiếng Việt và giữ liên kết; không sao chép toàn bộ bài viết,
ảnh hoặc sách hướng dẫn. Ngày bài viết được lưu khi trang có ghi; nếu không thì
`published_at = null`, không suy đoán ngày xuất bản.

| ID nguồn | Tài liệu | Phần được sử dụng |
| --- | --- | --- |
| `yamaha-battery` | [Ắc quy yếu/hết điện](https://yamaha-motor.com.vn/tin-tuc/xe-may-het-ac-quy-phai-lam-sao/) | §1, §3.2: dấu hiệu và cần kiểm tra |
| `yamaha-shutdown` | [Xe tắt máy khi đang chạy](https://yamaha-motor.com.vn/tin-tuc/xe-may-dang-chay-bi-tat-may/) | Mở đầu; §1.1, 1.4, 1.5, 1.7, 1.9 |
| `yamaha-air-filter` | [Kiểm tra, vệ sinh lọc gió](https://yamaha-motor.com.vn/tin-tuc/huong-dan-cach-ve-sinh-loc-gio-xe-may-va-luu-y-khi-thuc-hien/) | §1, §3: triệu chứng và khác biệt loại lọc |
| `yamaha-brake-check` | [Kiểm tra độ mòn má phanh](https://yamaha-motor.com.vn/dich-vu/kiem-tra-mon-ma-phanh/) | Độ mòn, bảo dưỡng và vệ sinh sau mưa |
| `yamaha-tires` | [Lốp và kiểm tra áp suất](https://yamaha-motor.com.vn/dich-vu/lop-xe-va-nhung-dieu-can-biet/) | Vai trò điều khiển; thủng lốp; lưu ý |
| `yamaha-fuel-consumption` | [Dấu hiệu và nguyên nhân hao xăng](https://yamaha-motor.com.vn/tin-tuc/cach-khac-phuc-xe-may-hao-xang/) | §1: mùi xăng, khói; §2.2: bugi |
| `yamaha-low-speed-jerk` | [Xe giật khi chạy chậm](https://yamaha-motor.com.vn/tin-tuc/xe-may-di-cham-bi-giat/) | §1.1, 1.5, 1.6, 1.7 |
| `yamaha-oil-check` | [Kiểm tra dầu động cơ](https://yamaha-motor.com.vn/tin-tuc/huong-dan-cach-kiem-tra-nhot-xe-may-chi-tiet-va-don-gian/) | §3, §4.1: dầu đổi màu và dấu hiệu |
| `yamaha-flood` | [Xe ngập nước](https://yamaha-motor.com.vn/tin-tuc/cach-xu-ly-xe-may-bi-ngap-nuoc-luu-y-di-duong-mua-mua/) | §1: không cố đề, dầu nhiễm nước; §4.2: ly hợp xe ga |
| `honda-vn-technical-faq` | [FAQ kỹ thuật Honda Việt Nam](https://www.honda.com.vn/index.php/cau-hoi-thuong-gap?category=xe-may) | Mùa mưa, dầu láp; cảnh báo MIL trong nội dung về SH150i |
| `suzuki-ph-raider-fi-manual` | [Sách Raider R150 FI / FU150MF, Suzuki Philippines](https://mc.suzuki.com.ph/wp-content/uploads/2023/10/FU150MF-XE617MF-OWNERS-MANUAL-FINAL-Raider-R150-Fi.pdf) | Troubleshooting: trang in 7-2–7-4, PDF 73–74; Fuses: trang in 6-70–6-71, PDF 69–70 |
| `sym-vn-maintenance` | [Bảo dưỡng định kỳ SYM Việt Nam](https://www.sym.com.vn/tin-tuc/ly-do-phai-bao-duong-xe-may-dinh-ky-76.html) | Kiểm tra bugi; phát hiện sớm tiếng động bất thường |
| `piaggio-vn-maintenance` | [Hướng dẫn bảo dưỡng Piaggio Việt Nam](https://www.piaggio.com/vn_VI/aftersales/scheduled-maintenance/) | Kiểm tra khi vận hành bất thường; lịch bảo dưỡng theo mẫu xe |

Đây là kiến thức tư vấn phổ thông, chủ yếu cho xe máy xăng. Không suy ra mã lỗi
FI/ABS từ bài viết chung hoặc số lần đèn nháy. `petrol_scooters` chỉ áp dụng cụm nồi/dây đai cho xe ga;
`all_motorcycles` dùng cho kiểm tra lốp/phanh và hỏi rõ triệu chứng.
Retrieval loại kiến thức động cơ xăng khi người dùng nói rõ xe điện và loại kiến
thức CVT khi nói rõ xe số/xe côn hoặc nhận ra Raider/Wave Alpha. Nếu chưa biết loại xe,
prompt yêu cầu hỏi thêm. Chưa có tra cứu đời xe từ hồ sơ xe hoặc đọc mã lỗi chuyên biệt.

Các mục mới có `applicability`: hãng, alias mẫu xe, đời đã xác minh, thị trường và
ghi chú giới hạn. `models = []` chỉ là tư vấn chung trong hãng. `model_years = null`
nghĩa là chưa xác minh đời xe; không được hiểu là mọi đời có cùng thông số.
Không nhập chu kỳ bảo dưỡng, trị số cầu chì, áp suất, loại dầu hoặc bảng mã lỗi
khi chưa đọc sách đúng phiên bản.

Retrieval nhận diện từ **tin nhắn hiện tại**, chưa lấy hồ sơ xe hay ghép các câu
hỏi qua nhiều lượt. Nêu hãng trực tiếp được ưu tiên; một số alias Vision, SH150i,
Raider/FU150MF, Liberty/Medley giúp nhận diện hãng khi người dùng chỉ nêu mẫu.
Alias không phải danh mục đầy đủ. Khi nhiều hãng hoặc hai thị trường cùng xuất
hiện, các mục có giới hạn tương ứng không được đưa vào prompt. Với cùng điểm
triệu chứng, mục đúng hãng/mẫu được ưu tiên; kiến thức chung về lốp, phanh và
triệu chứng khác vẫn được dùng khi phù hợp.

Thị trường mặc định là Việt Nam. Nội dung từ sách Suzuki Philippines chỉ được
truy xuất khi tin nhắn nêu rõ Philippines/bản PH **và** Raider FI hoặc FU150MF;
không dùng cho Satria, Raider bình xăng con hoặc bản Việt Nam. Chưa rõ thị trường
thì chatbot hỏi phiên bản Raider, giữ `UNKNOWN` và không đoán linh kiện. Người
dùng cần nhắc lại mẫu/thị trường khi trả lời, ví dụ: “Raider FI bản Philippines,
đèn FI còn sáng khi máy chạy”. Năm `2023` trong đường dẫn PDF không được dùng làm
năm xuất bản hoặc đời xe.

Honda có ghi chú chung về ngập nước; mục dầu láp yêu cầu xe ga đã được nhận diện.
Mục MIL giới hạn SH150i theo phần FAQ đã đọc; chưa mở rộng sang Vision/SH350i.
Đèn sáng lúc bật khóa chưa đủ để xác định lỗi, nên câu hỏi làm rõ đèn khi máy chạy
được đưa vào kho/prompt. SYM và Piaggio hiện dùng bài tư vấn bảo dưỡng chung,
chưa phải sách sửa chữa chuyên sâu hoặc danh mục lỗi của từng mẫu.

Đã tìm thấy sách Honda Vision trên CDN chính thức nhưng công cụ đọc bị trả HTTP
403; tài liệu đó **không được dùng để xác minh mục nào**. Các mục Honda mới dùng
FAQ đã đọc được, không gán cho sách Vision một kết luận chưa kiểm tra.

## Ý nghĩa kiểm duyệt

- `source_checked`: nội dung đã được đối chiếu với phần nguồn ghi tại `source_refs`.
  Đây là kiểm tra biên tập, **chưa có thợ xác nhận chuyên môn**. Từ khóa triệu chứng
  và câu hỏi là cách diễn đạt để tìm kiếm/làm rõ, không phải bằng chứng xác định
  linh kiện hỏng. Các mục giữ cách nói khả năng và khuyến nghị kiểm tra.
- `internal_policy`: chỉ dùng cho `UNKNOWN`, hỏi vị trí/thời điểm tiếng kêu hoặc phiên bản Raider;
  không gán cho hãng một kết luận kỹ thuật.
- `pending`: chưa đủ bằng chứng; không được đưa vào prompt hoặc fallback.
  Hai mục hiện chờ xác minh là `wheel-bearing-or-tire-noise` và
  `charging-system-weak`. Khi không còn mục phù hợp, chatbot hỏi thêm.

Mức rủi ro, quyền tiếp tục chạy và quyết định gọi hỗ trợ là chính sách bảo thủ của
CareOnRoad. Nguồn có thể nêu khả năng liên quan đến lốp/phanh; không được hiểu
nguồn đã xác nhận nguyên nhân chính xác cho người dùng. Safety gate hiện có tiếp
tục ưu tiên cảnh báo nguy hiểm, độc lập với trạng thái nguồn.

Không đưa vào kho các bước tự tháo bugi, đấu kích bình, rửa lọc bằng xăng, tháo
phanh, mở nắp làm mát lúc nóng hoặc khởi động lại sau ngập. Các thông số áp suất,
chu kỳ bảo dưỡng và loại dầu phải theo sách đúng mẫu xe; không đặt một giá trị
chung cho mọi xe.

## Giá và truy vết câu trả lời

Chưa có nguồn xác minh **tổng giá sửa chữa** gồm phụ tùng, công và chi phí di
chuyển. Các khoảng giá cũ được bỏ; `price_status = unverified`, giá `0/0` biểu
thị **chưa có ước tính**, không có nghĩa sửa miễn phí. View model hiện có hiển thị
“Chưa ước tính”. Prompt cấm tạo giá; post-validation bỏ mọi giá số do model trả
trong các trường giá có cấu trúc. Nội dung văn bản do model sinh vẫn cần đánh giá
trước triển khai thực tế; không có cam kết loại hết mọi sai lệch bằng prompt.

Pipeline dùng kho có sẵn trong repo, không tải internet trong mỗi lượt chat.
Prompt chỉ nhận tối đa 2 mục cùng phạm vi, câu hỏi, ID nguồn, phần nguồn và phiên
bản. Trả lời dự phòng cũng dùng mục đã đối chiếu và câu hỏi tương ứng.
Khi mục chính là quy tắc nội bộ hỏi thêm, backend giữ giả thuyết `UNKNOWN`, câu
hỏi/hành động của kho và giới hạn độ tin cậy dù model trả một kết luận khác.
Safety gate vẫn có thể yêu cầu dừng xe/gọi hỗ trợ nếu triệu chứng nguy hiểm.

`DiagnosisService` tự gắn `knowledge_provenance` cho cả kết quả model và fallback:
`version`, `reviewed_at`, `entry_ids`, `source_ids`. Metadata được lưu cùng JSON
chẩn đoán trong memory/PostgreSQL và trả khi khôi phục chẩn đoán. Model không
quyết định metadata này. Đây là nguồn **được truy xuất**, không phải chứng nhận
mọi câu model sinh đều được nguồn hỗ trợ. Khi không có mục khớp, các ID rỗng.
Trường này là tùy chọn để đọc được bản ghi cũ; frontend hiện chưa hiển thị link nguồn.
Log hoàn tất có phiên bản và ID mục, không chứa tài liệu hoặc toàn bộ lời người dùng.

## Cập nhật lần sau

1. Tìm nguồn hãng hoặc sách đúng mẫu xe; đọc nội dung thực tế, ghi URL và phần/trang.
   Nếu không truy cập được, để `pending`, không chỉ dựa vào tiêu đề.
2. Thêm nguồn vào `knowledge-sources.ts`; biên soạn ngắn, giữ điều kiện áp dụng.
3. Thêm/sửa mục trong `knowledge-base.ts`: từ khóa, khả năng, phạm vi, nguồn và
   tối đa 2 câu hỏi. Với nguồn chung, không viết thành kết luận hỏng chắc chắn.
   Với sách hãng/mẫu, ghi `applicability` và cập nhật alias nhận diện khi cần;
   tài liệu thị trường khác phải được chặn nếu chưa xác nhận đúng thị trường.
4. Đối chiếu từng phát biểu; cho thợ review trước khi sử dụng chẩn đoán chuyên sâu.
   Chỉ đổi `pending` thành `source_checked` khi đã kiểm tra nội dung nguồn.
5. Tăng `knowledgeVersion`, cập nhật `knowledgeReviewedAt`, chạy test, typecheck,
   lint và build. Review diff rồi triển khai cùng backend qua quy trình dự án.
   Giữ lịch sử Git để đối chiếu phiên bản của kết quả cũ.

Phiên bản này chỉ triển khai kho kiến thức và tích hợp vào luồng hiện tại.
Việc đổi model/free API, cấm guest và quota 5 tin/ngày là phạm vi riêng,
chưa được triển khai bởi thay đổi này.
