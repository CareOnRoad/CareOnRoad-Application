# Hướng dẫn sử dụng ứng dụng CareOnRoad Mobile

> Phiên bản: `1.0.0`
> Đối tượng: người dùng cuối (rider) + thợ sửa xe (mechanic)
> Cập nhật: 2026-10-16

---

## Mục lục

- [Hướng dẫn sử dụng ứng dụng CareOnRoad Mobile](#hướng-dẫn-sử-dụng-ứng-dụng-careonroad-mobile)
  - [Mục lục](#mục-lục)
  - [Phần 0 — Giới thiệu chung](#phần-0--giới-thiệu-chung)
    - [Lần đầu mở app](#lần-đầu-mở-app)
  - [Phần 1 — Đăng ký \& Đăng nhập](#phần-1--đăng-ký--đăng-nhập)
    - [1.1 Tạo tài khoản mới](#11-tạo-tài-khoản-mới)
    - [1.2 Đăng nhập bằng Email / Mật khẩu](#12-đăng-nhập-bằng-email--mật-khẩu)
    - [1.3 Đăng nhập bằng Google](#13-đăng-nhập-bằng-google)
  - [Phần 2 — Hướng dẫn cho RIDER (Khách hàng)](#phần-2--hướng-dẫn-cho-rider-khách-hàng)
    - [2.1 Trang chủ](#21-trang-chủ)
    - [2.2 Yêu cầu cứu hộ khẩn cấp](#22-yêu-cầu-cứu-hộ-khẩn-cấp)
    - [2.3 Theo dõi yêu cầu](#23-theo-dõi-yêu-cầu)
    - [2.4 Duyệt / Từ chối báo giá](#24-duyệt--từ-chối-báo-giá)
    - [2.5 Thanh toán](#25-thanh-toán)
    - [2.6 Đánh giá thợ](#26-đánh-giá-thợ)
    - [2.7 Đặt lịch bảo dưỡng](#27-đặt-lịch-bảo-dưỡng)
    - [2.8 Quản lý xe](#28-quản-lý-xe)
    - [2.9 Hồ sơ cá nhân](#29-hồ-sơ-cá-nhân)
    - [2.10 Thông báo](#210-thông-báo)
  - [Phần 3 — Hướng dẫn cho MECHANIC (Thợ sửa xe)](#phần-3--hướng-dẫn-cho-mechanic-thợ-sửa-xe)
    - [3.1 Tổng quan](#31-tổng-quan)
    - [3.2 Nhận / Từ chối yêu cầu](#32-nhận--từ-chối-yêu-cầu)
    - [3.3 Chi tiết công việc](#33-chi-tiết-công-việc)
    - [3.4 Gửi chẩn đoán](#34-gửi-chẩn-đoán)
    - [3.5 Gửi báo giá](#35-gửi-báo-giá)
    - [3.6 Báo ETA / lý do trễ](#36-báo-eta--lý-do-trễ)
    - [3.7 Chia sẻ vị trí](#37-chia-sẻ-vị-trí)
    - [3.8 Hoàn tất + checklist](#38-hoàn-tất--checklist)
    - [3.9 Hiệu suất](#39-hiệu-suất)
    - [3.10 Lịch làm việc](#310-lịch-làm-việc)
    - [3.11 Hồ sơ cá nhân](#311-hồ-sơ-cá-nhân)
  - [Phần 4 — Câu hỏi thường gặp](#phần-4--câu-hỏi-thường-gặp)
    - [Rider](#rider)
    - [Mechanic](#mechanic)
  - [Phần 5 — Xử lý sự cố](#phần-5--xử-lý-sự-cố)
    - [App không kết nối được máy chủ](#app-không-kết-nối-được-máy-chủ)
    - [Không nhận được thông báo](#không-nhận-được-thông-báo)
    - [Không gửi được vị trí (mechanic)](#không-gửi-được-vị-trí-mechanic)
    - [Quên mật khẩu](#quên-mật-khẩu)
  - [Phụ lục — Trạng thái yêu cầu \& vai trò](#phụ-lục--trạng-thái-yêu-cầu--vai-trò)
    - [Trạng thái yêu cầu dịch vụ (Rider view)](#trạng-thái-yêu-cầu-dịch-vụ-rider-view)
    - [Trạng thái assignment (Mechanic view)](#trạng-thái-assignment-mechanic-view)

---

## Phần 0 — Giới thiệu chung

**CareOnRoad** là ứng dụng cứu hộ và bảo dưỡng xe máy tại Việt Nam. App phục vụ 2 nhóm người dùng:

| Role | Tiếng Việt | Mục đích chính |
|---|---|---|
| **Rider** | Khách hàng / Người dùng | Gọi cứu hộ, đặt lịch bảo dưỡng, duyệt báo giá, thanh toán, đánh giá thợ |
| **Mechanic** | Thợ sửa xe | Nhận yêu cầu, điều phối, chẩn đoán, báo giá, hoàn tất công việc |

### Lần đầu mở app

```
┌────────────────────────────────────┐
│         [Logo CareOnRoad]          │
│                                    │
│   Cứu hộ & bảo dưỡng xe máy       │
│   tại Việt Nam                     │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Email                        │  │
│  │ email@example.com            │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Mật khẩu                  👁 │  │
│  │ ••••••••                     │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │       ĐĂNG NHẬP              │  │
│  └──────────────────────────────┘  │
│                                    │
│  ─────── hoặc ───────              │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  G   Tiếp tục với Google     │  │
│  └──────────────────────────────┘  │
│                                    │
│  Chưa có tài khoản? Đăng ký ngay   │
│                                    │
│  ─────────────────────────────────│
│  Trang chủ / Xe / Cứu hộ /       │
│  Theo dõi / Đặt lịch / Hồ sơ     │
└────────────────────────────────────┘
```

> Mẹo: Nếu đã đăng nhập trước đó, app sẽ tự mở thẳng vào màn hình chính của role tương ứng.

---

## Phần 1 — Đăng ký & Đăng nhập

### 1.1 Tạo tài khoản mới

**Bước 1**: Từ màn hình đăng nhập, nhấn **"Đăng ký ngay"** ở dưới cùng.

**Bước 2**: Điền các trường bắt buộc:

```
┌────────────────────────────────────┐
│  ← Tạo tài khoản                  │
│                                    │
│  Họ và tên                         │
│  ┌──────────────────────────────┐  │
│  │ Nguyễn Văn A                 │  │
│  └──────────────────────────────┘  │
│  Số điện thoại                     │
│  ┌──────────────────────────────┐  │
│  │ 0901 234 567                 │  │
│  └──────────────────────────────┘  │
│  Email                             │
│  ┌──────────────────────────────┐  │
│  │ email@example.com            │  │
│  └──────────────────────────────┘  │
│  Mật khẩu                          │
│  ┌──────────────────────────────┐  │
│  │ ••••••••                  👁  │  │
│  └──────────────────────────────┘  │
│  Vai trò                           │
│  ( ) Khách hàng ( ) Thợ sửa xe    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │       ĐĂNG KÝ                │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Bước 3**: Nhấn **"Đăng ký"**. Hệ thống tự gán role và chuyển vào màn hình chính.

### 1.2 Đăng nhập bằng Email / Mật khẩu

1. Nhập email và mật khẩu đã đăng ký.
2. Nhấn **"Đăng nhập"**.
3. Nếu tài khoản có 2 role, hệ thống sẽ ưu tiên role đã đăng ký gần nhất.

### 1.3 Đăng nhập bằng Google

1. Nhấn nút **"Tiếp tục với Google"** trên màn hình đăng nhập.
2. Trình duyệt mở ra → chọn tài khoản Google.
3. Sau khi xác thực, app tự quay lại và đăng nhập thành công.

---

## Phần 2 — Hướng dẫn cho RIDER (Khách hàng)

### 2.1 Trang chủ

**Đường dẫn**: Tab `Trang chủ` 🏠

```
┌────────────────────────────────────┐
│ CareOnRoad            🔔(3)  👤    │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Xin chào, Nguyễn Văn A        │ │
│ │ Sẵn sàng cho hành trình hôm    │ │
│ │ nay?                           │ │
│ └────────────────────────────────┘ │
│                                    │
│ ⚡ HàNH ĐỘNG NHANH                  │
│ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │ 🚨   │ │ 📍   │ │ 📅   │         │
│ │ Cứu  │ │ Đang │ │ Đặt  │         │
│ │ hộ   │ │ chạy │ │ lịch │         │
│ └──────┘ └──────┘ └──────┘         │
│ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │ 🏍   │ │ 🔔   │ │ 📜   │         │
│ │ Xe   │ │ TB   │ │ Lịch │         │
│ │      │ │      │ │ sử   │         │
│ └──────┘ └──────┘ └──────┘         │
│                                    │
│ 📍 THEO DÕI YÊU CẦU                │
│ ┌────────────────────────────────┐ │
│ │ COR-RES-20261015-0003          │ │
│ │ 🟠 Đang tìm thợ                │ │
│ │ 14:30 · Cứu hộ                 │ │
│ │                       Xem →    │ │
│ └────────────────────────────────┘ │
│                                    │
│ 📅 BẢO DƯỠNG SẮP TỚI              │
│ (rỗng nếu chưa đặt lịch)          │
│                                    │
│ ─────────────────────────────────  │
│ 🏠 Trang chủ  🚲 Xe  🚨 Cứu hộ  │
│ 📍 Theo dõi  📅 Đặt lịch  👤 Hồ  │
└────────────────────────────────────┘
```

**Các thành phần**:

| Vùng | Mô tả |
|---|---|
| Header | Tên app + số thông báo chưa đọc + avatar (tap → hồ sơ) |
| Hero card | Lời chào theo tên người dùng |
| Hành động nhanh | 6 nút tắt: Cứu hộ, Đang chạy, Đặt lịch, Xe, Thông báo, Lịch sử |
| Theo dõi yêu cầu | Card yêu cầu đang active (nếu có), tap để mở chi tiết |
| Bảo dưỡng sắp tới | Nhắc nhở bảo dưỡng theo lịch |

### 2.2 Yêu cầu cứu hộ khẩn cấp

**Đường dẫn**: Tab `Cứu hộ` 🚨 (icon đỏ)

**Bước 1**: Chọn loại sự cố.

```
┌────────────────────────────────────┐
│ ←  Yêu cầu cứu hộ                 │
│                                    │
│ Chọn loại sự cố                    │
│ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │ ⚙️     │ │ ⭕     │ │ 🔋     │   │
│ │ Động cơ│ │ Lốp xe │ │ Ắc quy │   │
│ └────────┘ └────────┘ └────────┘   │
│ ┌────────┐ ┌────────┐              │
│ │ ⛽     │ │ ⚠️     │              │
│ │ Hết    │ │ Tai    │              │
│ │ xăng   │ │ nạn    │              │
│ └────────┘ └────────┘              │
│                                    │
│ Xe của bạn                         │
│ ┌────────────────────────────────┐ │
│ │ 🏍  Honda Wave RSX  59-X1 1234 │ │
│ │ 2020 · 15.000 km               │ │
│ └────────────────────────────────┘ │
│                                    │
│ Vị trí & địa chỉ                   │
│ ┌────────────────────────────────┐ │
│ │ 📍 [Lấy vị trí hiện tại]       │ │
│ │ 124 Nguyễn Văn Cừ, Q.5, TP.HCM │ │
│ │ 10.762, 106.682                │ │
│ └────────────────────────────────┘ │
│                                    │
│ Mô tả vấn đề (tùy chọn)           │
│ ┌────────────────────────────────┐ │
│ │ Xe không nổ được, đèn báo ắc   │ │
│ │ quy yếu...                     │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │       YÊU CẦU HỖ TRỢ           │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Bước 2**: Chọn **xe** (từ danh sách xe đã đăng ký) hoặc hệ thống tự chọn xe đầu tiên.

**Bước 3**: Nhấn **📍 Lấy vị trí hiện tại** để tự động điền tọa độ GPS. Bạn có thể sửa địa chỉ thành text cụ thể.

**Bước 4** (tùy chọn): Mô tả chi tiết vấn đề.

**Bước 5**: Nhấn **"Yêu cầu hỗ trợ"**.

> Hệ thống sẽ tạo mã yêu cầu dạng `COR-RES-YYYYMMDD-NNNN` và bắt đầu tìm thợ.

**Sau khi gửi** — chuyển sang phase `searching`:

```
┌────────────────────────────────────┐
│ 🔄 ĐANG TÌM THỢ                   │
│                                    │
│        ⏳ (spinner xoay)            │
│                                    │
│  Chúng tôi đang tìm thợ phù hợp    │
│  gần bạn. Trang này tự động cập    │
│  nhật mỗi vài giây.                │
│                                    │
│  COR-RES-20261015-0003             │
│  Cứu hộ · 14:30                    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │     HỦY YÊU CẦU              │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

Khi thợ nhận → chuyển sang phase `tracking`.

### 2.3 Theo dõi yêu cầu

**Đường dẫn**: Tab `Theo dõi` 📍

```
┌────────────────────────────────────┐
│ ←  Yêu cầu COR-RES-20261015-0003  │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🟠 Thợ đang được điều phối     │ │
│ │ Cập nhật lúc 14:32            │ │
│ └────────────────────────────────┘ │
│                                    │
│ THÔNG TIN XE                       │
│ ┌────────────────────────────────┐ │
│ │ 🏍  Honda Wave RSX             │ │
│ │ 59-X1 1234 · 2020             │ │
│ └────────────────────────────────┘ │
│                                    │
│ THỢ ĐÃ NHẬN VIỆC                   │
│ ┌────────────────────────────────┐ │
│ │ 🧭  ETA ~8 phút                │ │
│ │     Khoảng cách 1.2 km         │ │
│ │ ───────────────────────────    │ │
│ │ 📍 Vị trí thợ: 10.7620, 106.6 │
│ │    815 · 5s trước              │ │
│ │ ───────────────────────────    │ │
│ │ 📍 124 Nguyễn Văn Cừ, Q.5      │ │
│ └────────────────────────────────┘ │
│                                    │
│ CHẨN ĐOÁN CỦA THỢ                 │
│ ┌────────────────────────────────┐ │
│ │ 🩺  Mới nhất                   │ │
│ │ Ắc quy yếu, không khởi động   │ │
│ │ Nguyên nhân: Ắc quy đã cũ     │ │
│ │ Xử lý: Thay ắc quy mới        │ │
│ │ 14:38                          │ │
│ └────────────────────────────────┘ │
│                                    │
│ BÁO GIÁ v1                         │
│ ┌────────────────────────────────┐ │
│ │ Báo giá v1        [Chờ duyệt] │ │
│ │ Nhân công thay ắc quy  ×1      │ │
│ │                     150.000₫   │ │
│ │ Ắc quy GS 12V-7Ah       ×1     │ │
│ │                     350.000₫   │ │
│ │ ───────────────────────────    │ │
│ │ Tổng cộng          500.000₫   │ │
│ │                                │ │
│ │ ┌──────────┐ ┌──────────────┐  │ │
│ │ │  TỪ CHỐI │ │ DUYỆT & TT   │  │ │
│ │ └──────────┘ └──────────────┘  │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Tự cập nhật**: Trang tự động làm mới mỗi **5 giây** (trạng thái yêu cầu, ETA, vị trí thợ) và mỗi **30 giây** (chẩn đoán, checklist, ETA đường đi).

**Các thông tin hiển thị**:

| Mục | Mô tả | Cập nhật |
|---|---|---|
| Status pill | Trạng thái yêu cầu | 5s |
| Thông tin xe | Hãng, model, biển số | Khi load |
| ETA + khoảng cách | Thời gian thợ tới nơi | 30s |
| Vị trí thợ | lat/lng + bao nhiêu giây trước | 15s |
| Chẩn đoán | Tất cả các bản | 30s |
| Báo giá | Tất cả các bản (chỉ bản đang chờ duyệt mới có nút) | 5s |
| Checklist hoàn tất | Sau khi thợ submit | 30s |
| Địa chỉ | Địa chỉ rider cung cấp | Khi load |

**Các hành động**:

- **Từ chối báo giá**: Mở dialog xác nhận → nhập lý do (tùy chọn) → hệ thống chuyển sang trạng thái `từ chối` → thợ có thể tạo bản sửa mới.
- **Duyệt & thanh toán**: Chuyển sang phase `payment` (xem 2.5).
- **Hủy yêu cầu**: Chỉ hiện khi yêu cầu đang ở giai đoạn có thể hủy (chưa có thợ nhận hoặc cần leo thang hỗ trợ).
- **Đánh giá thợ**: Hiện khi yêu cầu đã hoàn tất.
- **Thanh toán ngay**: Hiện khi yêu cầu đang chờ thanh toán.

### 2.4 Duyệt / Từ chối báo giá

Khi thợ đã gửi báo giá, card "Báo giá vN" hiện ở phía dưới trang chi tiết với 2 nút:

| Nút | Hành động | Yêu cầu |
|---|---|---|
| **Từ chối** | Đóng dialog xác nhận, nhập lý do (tùy chọn) → chuyển sang trạng thái `từ chối` | Nhập lý do tùy chọn |
| **Duyệt & thanh toán** | Hệ thống ghi nhận báo giá được duyệt → yêu cầu sang trạng thái `chờ thanh toán` | OK → chuyển sang màn hình thanh toán |

Sau khi duyệt, bạn không thể chỉnh sửa. Nếu muốn thay đổi, hãy liên hệ thợ để tạo bản sửa đổi.

### 2.5 Thanh toán

**Đường dẫn**: Sau khi duyệt báo giá → tự chuyển sang `/rider/payments/[quoteId]`
Hoặc từ trang chi tiết yêu cầu → nhấn **"Thanh toán ngay"**.

```
┌────────────────────────────────────┐
│ ←  Thanh toán                      │
│                                    │
│ ┌────────────────────────────────┐ │
│ │      TỔNG CẦN THANH TOÁN      │ │
│ │         500.000 ₫              │ │
│ │   COR-RES-20261015-0003        │ │
│ └────────────────────────────────┘ │
│                                    │
│ Phương thức                        │
│ ┌────────────────────────────────┐ │
│ │ ▣  payOS / VietQR              │ │
│ │    Quét QR bằng app ngân hàng  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │         [   MÃ QR   ]          │ │
│ │                                │ │
│ │   (QR code VietQR)             │ │
│ │                                │ │
│ └────────────────────────────────┘ │
│                                    │
│ ⏳ Đang chờ thanh toán...          │
│ Tự cập nhật mỗi 5 giây            │ 
│                                    │
│ [Hủy thanh toán]                   │
└────────────────────────────────────┘
```

**Các bước**:

1. Mở app ngân hàng hoặc ví có hỗ trợ VietQR.
2. Quét mã QR trên màn hình.
3. Xác nhận thanh toán trên app ngân hàng.
4. Quay lại app CareOnRoad — trang tự động cập nhật trong vài giây.
5. Khi thanh toán thành công → trang chuyển sang phase `completed` (nếu thợ đã nộp checklist) hoặc `in_progress`.

> Lưu ý: Sau khi thanh toán thành công, bạn không thể hủy. Nếu có vấn đề, liên hệ hỗ trợ.

### 2.6 Đánh giá thợ

**Đường dẫn**: Sau khi yêu cầu `completed` → trang chi tiết hiện nút **"Đánh giá thợ"** → mở `/rider/review?requestId=...`

```
┌────────────────────────────────────┐
│ ←  Đánh giá thợ                    │
│                                    │
│ COR-RES-20261015-0003              │
│                                    │
│ Đánh giá của bạn                   │
│  ☆ ☆ ☆ ☆ ☆                         │
│                                    │
│ Nhận xét (tùy chọn)                │
│ ┌────────────────────────────────┐ │
│ │ Thợ nhiệt tình, sửa nhanh...   │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │       GỬI ĐÁNH GIÁ             │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

- Chọn 1-5 sao.
- Nhập nhận xét (tùy chọn, hiển thị công khai).
- Nhấn **"Gửi đánh giá"**.
- Đánh giá là bất biến — không thể sửa sau khi gửi.

### 2.7 Đặt lịch bảo dưỡng

**Đường dẫn**: Tab `Đặt lịch` 📅

**Bước 1**: Chọn loại bảo dưỡng và xe.

```
┌────────────────────────────────────┐
│ ←  Đặt lịch bảo dưỡng             │
│                                    │
│ Loại bảo dưỡng                     │
│ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │ Thay │ │ Vệ   │ │ Tổng│         │
│ │ nhớt │ │ sinh │ │ quát│         │
│ └──────┘ └──────┘ └──────┘         │
│                                    │
│ Xe                                 │
│ ┌────────────────────────────────┐ │
│ │ 🏍  Honda Wave RSX             │ │
│ │ 59-X1 1234 · 15.000 km         │ │
│ └────────────────────────────────┘ │
│                                    │
│ Thời gian                          │
│ ┌────────────────────────────────┐ │
│ │ 📅 16/10/2026                  │ │
│ │ 🕒 09:00 – 11:00               │ │
│ └────────────────────────────────┘ │
│                                    │
│ Địa điểm                           │
│ ┌────────────────────────────────┐ │
│ │ 📍 Tại garage (mặc định)       │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │       XÁC NHẬN ĐẶT LỊCH        │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Bước 2**: Nhấn **"Xác nhận đặt lịch"** → chuyển sang màn hình xác nhận với thông tin garage + thời gian.

**Bước 3**: Xác nhận lần cuối → yêu cầu bảo dưỡng được tạo và hệ thống sẽ phân công thợ.

Sau khi thợ được phân công, yêu cầu sẽ xuất hiện trong tab `Theo dõi`.

### 2.8 Quản lý xe

**Đường dẫn**: Tab `Xe của tôi` 🚲

**Danh sách xe**:

```
┌────────────────────────────────────┐
│ ←  Xe của tôi           [+ Thêm]  │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🏍  Honda Wave RSX             │ │
│ │ 59-X1 1234 · 2020 · 15.000 km  │ │
│ │                       [Sửa] [⋯]│ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ 🏍  Yamaha Sirius              │ │
│ │ 59-X2 5678 · 2018 · 28.000 km  │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Thêm xe mới** — nhấn **+ Thêm**:

```
┌────────────────────────────────────┐
│ ←  Thêm xe mới                     │
│                                    │
│ Hãng xe (nhập tự do)               │
│ ┌────────────────────────────────┐ │
│ │ Honda                          │ │
│ └────────────────────────────────┘ │
│ Dòng xe                            │
│ ┌────────────────────────────────┐ │
│ │ Wave RSX                       │ │
│ └────────────────────────────────┘ │
│ Năm sản xuất                       │
│ ┌────────────────────────────────┐ │
│ │ 2020                           │ │
│ └────────────────────────────────┘ │
│ Biển số                            │
│ ┌────────────────────────────────┐ │
│ │ 59-X1 1234                     │ │
│ └────────────────────────────────┘ │
│ Số km hiện tại                     │
│ ┌────────────────────────────────┐ │
│ │ 15000                          │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │       LƯU XE                   │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Sửa / Xoá xe**: Nhấn vào xe trong danh sách → mở form chi tiết với 2 nút **Sửa** và **Xoá** (lưu trữ).

### 2.9 Hồ sơ cá nhân

**Đường dẫn**: Tab `Hồ sơ` 👤

```
┌────────────────────────────────────┐
│ ←  Hồ sơ                          │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [Avatar]  Nguyễn Văn A         │ │
│ │            email@example.com    │ │
│ └────────────────────────────────┘ │
│                                    │
│ 📊 THỐNG KÊ                        │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │   12   │ │   5★   │ │  95%   │    │
│ │ Tổng   │ │ Đánh   │ │ Hoàn   │    │
│ │ yêu cầu│ │ giá TB │ │ tất    │    │
│ └────────┘ └────────┘ └────────┘    │
│                                    │
│ ⚙️  CÀI ĐẶT                        │
│  🌙  Chế độ tối                    │
│  🌐  Ngôn ngữ: Tiếng Việt          │
│  🔔  Thông báo                     │
│  📍  Vị trí                       │
│  🛡  Bảo mật                       │
│  📞  Liên hệ hỗ trợ                │
│  📜  Điều khoản sử dụng             │
│  🚪  Đăng xuất                     │
└────────────────────────────────────┘
```

**Sửa hồ sơ**: Nhấn icon ✏️ ở góc phải tên → mở sheet sửa (họ tên, SĐT, địa chỉ, avatar).

**Đăng xuất**: Nhấn "Đăng xuất" → xác nhận → xóa session + token + cache local.

### 2.10 Thông báo

**Đường dẫn**: Icon 🔔 trên header trang chủ → `/rider/notifications`

```
┌────────────────────────────────────┐
│ ←  Thông báo         [Đọc tất cả]  │
│                                    │
│ 🟠 Chưa đọc                        │
│ ┌────────────────────────────────┐ │
│ │ 🩺 Chẩn đoán đã sẵn sàng       │ │
│ │ Thợ Minh đã gửi chẩn đoán cho  │ │
│ │ yêu cầu COR-RES-20261015-0003  │ │
│ │ 5 phút trước          [Xem →]  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ✓ Đã đọc                           │
│ ┌────────────────────────────────┐ │
│ │ ✓ Thợ đã nhận yêu cầu          │ │
│ │ 1 giờ trước                    │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Các loại thông báo**:

| Icon | Loại | Tap → mở |
|---|---|---|
| 🩺 | Chẩn đoán / Báo giá | Chi tiết yêu cầu |
| 🚨 | Cứu hộ | Chi tiết yêu cầu |
| 💳 | Thanh toán | Tab Cứu hộ |
| ⭐ | Đánh giá | Form đánh giá |
| 📅 | Nhắc nhở bảo dưỡng | Tab Đặt lịch |
| 🔔 | Hệ thống | — |

**"Đọc tất cả"**: Nhấn nút ở góc phải trên → đánh dấu tất cả thông báo là đã đọc (không xóa).

---

## Phần 3 — Hướng dẫn cho MECHANIC (Thợ sửa xe)

### 3.1 Tổng quan

**Đường dẫn**: Tab `Tổng quan` 🏠

```
┌────────────────────────────────────┐
│ ←  Tổng quan            🔔(2)  ⚙  │
│                                    │
│ ┌────────────────────────────────┐ │
│ │  Chào thợ Minh!                │ │
│ │  Trạng thái: 🟢 Sẵn sàng        │ │
│ │  [BẬT/TẮT NHẬN VIỆC]          │ │
│ └────────────────────────────────┘ │
│                                    │
│ 📊 HÔM NAY                        │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │   3    │ │  4.8★  │ │  12    │    │
│ │ Yêu cầu│ │ Rating │ │ Công   │    │
│ │ mới    │ │ TB     │ │ việc   │    │
│ └────────┘ └────────┘ └────────┘    │
│                                    │
│ 🎯 CÔNG VIỆC ĐANG CHẠY            │
│ ┌────────────────────────────────┐ │
│ │ COR-RES-20261015-0003          │ │
│ │ 🟠 Đang đến                    │ │
│ │ 14:30 · 1.2 km · ETA 8 phút    │ │
│ │                       [Xem →]  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ─────────────────────────────────  │
│ 🏠 Tổng quan  📥 Yêu cầu  🧰 Việc│
│ 📈 Hiệu suất  📅 Lịch  👤 Hồ sơ  │
└────────────────────────────────────┘
```

**Bật/tắt nhận việc**: Khi **TẮT**, hệ thống không gửi yêu cầu mới cho bạn. Có thể bật lại bất kỳ lúc nào.

**Lưu ý quan trọng**: 
- Khi bật "Sẵn sàng" + có GPS → hệ thống tự ghi nhận vị trí để xếp hạng các yêu cầu gửi đến.
- Bạn có thể cập nhật vị trí thủ công tại màn hình `Yêu cầu nhận` (nút "Cập nhật vị trí").

### 3.2 Nhận / Từ chối yêu cầu

**Đường dẫn**: Tab `Yêu cầu nhận` 📥

**Tự cập nhật**: Ứng dụng tự động làm mới mỗi 15 giây. Khi có yêu cầu mới, điện thoại rung nhẹ và yêu cầu được thêm vào đầu danh sách.

```
┌────────────────────────────────────┐
│ ←  Yêu cầu nhận          🔄  📍  │
│                                    │
│ 📍 Vị trí của bạn                  │
│ ┌────────────────────────────────┐ │
│ │ 10.762, 106.682                │ │
│ │ 124 Nguyễn Văn Cừ, Q.5, TP.HCM │ │
│ │ [Cập nhật vị trí]              │ │
│ └────────────────────────────────┘ │
│                                    │
│ 3 yêu cầu mới                       │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🆕 YÊU CẦU MỚI                │ │
│ │ COR-RES-20261015-0003          │ │
│ │ Cứu hộ · Honda Wave            │ │
│ │ 📍 1.2 km · 8 phút             │ │
│ │ ───────────────────────────    │ │
│ │ Vấn đề: "Ắc quy yếu..."       │ │
│ │ ───────────────────────────    │ │
│ │ ┌─────────┐ ┌──────────────┐  │ │
│ │ │ TỪ CHỐI │ │   NHẬN VIỆC  │  │ │
│ │ └─────────┘ └──────────────┘  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ COR-RES-20261015-0002          │ │
│ │ Bảo dưỡng · Yamaha Sirius      │ │
│ │ 📍 3.5 km · 25 phút            │ │
│ │ [Từ chối] [Nhận]               │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Nhận việc**:
- Nhấn nút **"Nhận việc"** → hệ thống xử lý (nếu yêu cầu đã hết hạn hoặc thợ khác nhận trước, bạn sẽ thấy thông báo lỗi).
- Nếu thành công → app tự chuyển sang chi tiết công việc.
- Nếu thất bại → hiển thị thông báo lỗi, danh sách tự refresh.

**Từ chối**:
- Nhấn **"Từ chối"** → dialog xác nhận → nhập lý do (tùy chọn) → yêu cầu bị ẩn.

> Mẹo: Nếu thấy yêu cầu ở xa (>5 km), bạn có thể từ chối để tránh ảnh hưởng điểm đánh giá.

### 3.3 Chi tiết công việc

**Đường dẫn**: Tab `Công việc` 🧰 → nhấn vào 1 job

```
┌────────────────────────────────────┐
│ ←  Cứu hộ  🟠 Đang đến  14:30     │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🏍  Honda Wave RSX             │ │
│ │ 59-X1 1234 · 2020             │ │
│ │ Hôm nay · 14:30 · 60 phút      │ │
│ │                       500.000₫ │ │
│ └────────────────────────────────┘ │
│                                    │
│ YÊU CẦU CỦA KHÁCH                 │
│ ┌────────────────────────────────┐ │
│ │ ⚠️  Xe không nổ được, đèn báo  │ │
│ │ ắc quy yếu...                  │ │
│ │ 📍 124 Nguyễn Văn Cừ, Q.5      │ │
│ └────────────────────────────────┘ │
│                                    │
│ KHÁCH HÀNG                         │
│ ┌────────────────────────────────┐ │
│ │ K  COR-RES-20261015-0003       │ │
│ │    Yêu cầu Cứu hộ khẩn cấp    │ │
│ │ ───────────────────────────    │ │
│ │ 🛡 Số điện thoại và hồ sơ khách │ │
│ │ được bảo vệ. Bạn dùng mã yêu   │ │
│ │ cầu ở trên để trao đổi.         │ │
│ └────────────────────────────────┘ │
│                                    │
│ TIẾN TRÌNH CÔNG VIỆC               │
│ ┌────────────────────────────────┐ │
│ │ ✅ Đã nhận                     │ │
│ │ 🔵 Đang xử lý    ← Hiện tại   │ │
│ │ ⭕ Chờ phụ tùng                │ │
│ │ ⭕ Hoàn tất                     │ │
│ └────────────────────────────────┘ │
│                                    │
│ THỜI GIAN DI CHUYỂN                │
│ ┌────────────────────────────────┐ │
│ │ 🚗 ETA: ~8 phút                │ │
│ │ 📏 Khoảng cách: 1.2 km         │ │
│ └────────────────────────────────┘ │
│                                    │
│ CHIA SẺ VỊ TRÍ                     │
│ ┌────────────────────────────────┐ │
│ │ 📍 [BẬT CHIA SẺ VỊ TRÍ]        │ │
│ │ Rider sẽ thấy vị trí thời gian  │ │
│ │ thực của bạn.                   │ │
│ └────────────────────────────────┘ │
│                                    │
│ ẢNH CHẨN ĐOÁN (TRƯỚC KHI SỬA)     │
│ ┌────────────────────────────────┐ │
│ │ 📷 [+] Ảnh trước              │ │
│ └────────────────────────────────┘ │
│                                    │
│ CẬP NHẬT CÔNG VIỆC                 │
│ ┌────────────────────────────────┐ │
│ │ BÁO ETA / TRỄ (tùy chọn)       │ │
│ │ ┌─────────┐ ┌────────────────┐ │ │
│ │ │ Phút    │ │ Lý do trễ      │ │ │
│ │ └─────────┘ └────────────────┘ │ │
│ │ [Gửi ETA]                      │ │
│ │ ───────────────────────────    │ │
│ │ TRẠNG THÁI                     │ │
│ │ [Chờ xử lý][Đang sửa][...][..] │ │
│ │ GHI CHÚ SỬA CHỮA               │ │
│ │ ┌────────────────────────────┐ │ │
│ │ │ Mô tả đã làm gì...         │ │ │
│ │ └────────────────────────────┘ │ │
│ │ [LƯU THAY ĐỔI]                 │ │
│ └────────────────────────────────┘ │
│                                    │
│ CHẨN ĐOÁN                          │
│ ┌────────────────────────────────┐ │
│ │ Tóm tắt: ...                   │ │
│ │ Nguyên nhân: ...               │ │
│ │ Xử lý đề xuất: ...             │ │
│ │ [GỬI CHẨN ĐOÁN]                │ │
│ └────────────────────────────────┘ │
│                                    │
│ BÁO GIÁ                            │
│ ┌────────────────────────────────┐ │
│ │ TẠO BÁO GIÁ                    │ │
│ │ Loại: Nhân công / Phụ tùng /   │ │
│ │       Khác                     │ │
│ │ [+] Thêm dòng                  │ │
│ │ Mô tả: ... SL: ... Đơn giá:.. │ │
│ │ Giảm giá: ...                  │ │
│ │ Ghi chú: ...                   │ │
│ │ ───────────────────────────    │ │
│ │ Tổng cộng: 500.000₫            │ │
│ │ [GỬI BÁO GIÁ CHO KHÁCH]        │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Các thành phần chính**:

| Vùng | Mục đích |
|---|---|
| Header | Loại yêu cầu + trạng thái + thời gian |
| Thông tin xe | Hãng, model, biển số, năm |
| Yêu cầu của khách | Mô tả + địa chỉ |
| Khách hàng | Mã yêu cầu (SĐT được bảo vệ) |
| Tiến trình | Visual timeline 4 bước |
| ETA | Hiển thị ETA ước tính (Google Routes) |
| Chia sẻ vị trí | Bật/tắt real-time location |
| Ảnh trước | Upload ảnh chẩn đoán |
| Cập nhật trạng thái | Chuyển state + ghi chú |
| Chẩn đoán | Form tạo bản chẩn đoán |
| Báo giá | Form tạo bản báo giá |

### 3.4 Gửi chẩn đoán

**Bước 1**: Kéo xuống phần "Chẩn đoán" trong chi tiết công việc.

**Bước 2**: Điền các trường:

```
┌────────────────────────────────────┐
│  CHẨN ĐOÁN                          │
│                                    │
│  Tóm tắt vấn đề *                 │
│  ┌──────────────────────────────┐  │
│  │ Ắc quy yếu, không khởi động  │  │
│  └──────────────────────────────┘  │
│  Nguyên nhân                       │
│  ┌──────────────────────────────┐  │
│  │ Ắc quy đã sử dụng > 3 năm    │  │
│  └──────────────────────────────┘  │
│  Xử lý đề xuất                    │
│  ┌──────────────────────────────┐  │
│  │ Thay ắc quy mới 12V-7Ah      │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │    GỬI CHẨN ĐOÁN              │  │
│  └──────────────────────────────┘  │
│                                    │
│  ─── Lịch sử (2 bản) ───     │
│  ┌──────────────────────────────┐  │
│  │ v2 (mới nhất)                 │  │
│  │ 14:38                         │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ v1                            │  │
│  │ 14:30                         │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Bước 3**: Nhấn **"Gửi chẩn đoán"**.

> Chẩn đoán có thể sửa nhiều lần. Mỗi lần sửa tạo ra một bản mới. Khách hàng sẽ thấy tất cả các bản.

### 3.5 Gửi báo giá

**Bước 1**: Kéo xuống phần "Báo giá" trong chi tiết công việc.

**Bước 2**: Thêm từng dòng báo giá:

```
┌────────────────────────────────────┐
│  TẠO BÁO GIÁ                       │
│  [Bảo dưỡng · Vật tư]             │
│                                    │
│  DÒNG #1                    [🗑]   │
│  ┌──────────────────────────────┐  │
│  │ [Nhân công][Phụ tùng][Khác]  │  │
│  │ Mô tả: Thay ắc quy           │  │
│  │ SL: [  1  ] Đơn giá: [150000] │  │
│  │ = 150.000₫                    │  │
│  └──────────────────────────────┘  │
│                                    │
│  DÒNG #2                    [🗑]   │
│  ┌──────────────────────────────┐  │
│  │ [Nhân công][Phụ tùng][Khác]  │  │
│  │ Mô tả: Ắc quy GS 12V-7Ah     │  │
│  │ SL: [  1  ] Đơn giá: [350000] │  │
│  │ = 350.000₫                    │  │
│  └──────────────────────────────┘  │
│                                    │
│  [+ Thêm dòng]                     │
│                                    │
│  Giảm giá (VND, tùy chọn)         │
│  ┌──────────────────────────────┐  │
│  │ 0                             │  │
│  └──────────────────────────────┘  │
│  Ghi chú (tùy chọn)                │
│  ┌──────────────────────────────┐  │
│  │ Báo giá có hiệu lực đến 23:59 │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  Tạm tính         500.000₫    │  │
│  │  Giảm giá              0₫     │  │
│  │  Tổng cộng       500.000₫     │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │   GỬI BÁO GIÁ CHO KHÁCH       │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Bước 3**: Nhấn **"Gửi báo giá cho khách"**.

> Lưu ý: Báo giá tự động có `purpose` theo loại dịch vụ:
> - Cứu hộ → `rescue_final` (chỉ chấp nhận parts/labor sau khi sửa)
> - Bảo dưỡng → `maintenance_work` (vật tư + phát sinh)
> - Sửa chữa thường → `standard`

Sau khi gửi, form chuyển sang **read-only**:

```
┌────────────────────────────────────┐
│  📄 Báo giá       v1 · Chờ duyệt   │
│  ┌──────────────────────────────┐  │
│  │ Thay ắc quy (Nhân công ×1)   │  │
│  │                  150.000₫     │  │
│  │ Ắc quy GS 12V-7Ah (Phụ tụng ×1)│  │
│  │                  350.000₫     │  │
│  │ ───────────────────────────    │  │
│  │ Tạm tính          500.000₫   │  │
│  │ TỔNG               500.000₫   │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

Nếu khách từ chối, bạn có thể tạo bản mới (v2) để sửa.

### 3.6 Báo ETA / lý do trễ

Trong form "Cập nhật công việc" có ô riêng:

```
┌────────────────────────────────────┐
│  BÁO ETA / TRỄ (tùy chọn)          │
│  Rider sẽ thấy thông báo ETA này  │
│  mà không cần bạn gọi điện.        │
│                                    │
│  ┌─────────┐ ┌────────────────┐   │
│  │ Phút    │ │ Lý do trễ       │   │
│  │ tới nơi │ │ (tùy chọn)      │   │
│  └─────────┘ └────────────────┘   │
│  [GỬI ETA]                         │
└────────────────────────────────────┘
```

- Chỉ cần nhập **phút** (ví dụ `15`) hoặc **lý do trễ** (ví dụ `Kẹt xe`) hoặc cả hai.
- ETA được lưu vào `assignment_eta_records` và rider thấy trong card "Thợ đã nhận việc" trong vòng 30s.
- Lý do trễ hiển thị cho rider để họ biết tình hình.

### 3.7 Chia sẻ vị trí

**Mục đích**: Cho rider thấy vị trí thời gian thực của bạn khi đang trên đường tới.

**Bật thủ công** (trong chi tiết công việc):

```
┌────────────────────────────────────┐
│  CHIA SẺ VỊ TRÍ                     │
│  ┌──────────────────────────────┐  │
│  │  [TẮT] [BẬT]                  │  │
│  │  Trạng thái: 🟢 Đang chia sẻ  │  │
│  │  Cập nhật 5s trước            │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Tự động bật** (mặc định):
- Khi bạn nhận việc và trạng thái chuyển sang `accepted` hoặc `en_route` → hệ thống tự xin quyền truy cập vị trí nền và bật tự động theo dõi.
- Hệ thống tự gửi vị trí mỗi **10 giây** về máy chủ.
- Tự tắt khi assignment rời travel state hoặc bạn đăng xuất.

**Tắt vĩnh viễn auto-tracking**: Vào tab `Hồ sơ` → ⚙️ Settings → **"Tự động chia sẻ vị trí"** → TẮT.

> Lưu ý: Bạn cần cấp quyền **Location → Allow all the time** (Android) hoặc **While Using** (iOS) cho app. Nếu từ chối, sẽ thấy banner "Mở cài đặt vị trí" → tap để mở Settings OS.

### 3.8 Hoàn tất + checklist

**Khi nào**: Sau khi rider đã thanh toán xong và bạn đã hoàn thành tất cả công việc tại hiện trường.

**Bước 1**: Trong form "Cập nhật công việc", chọn trạng thái **"Hoàn tất"**.

**Bước 2**: Điền các trường bắt buộc khi hoàn tất:

```
┌────────────────────────────────────┐
│  HOÀN TẤT                          │
│  Chi phí cuối (VND)                │
│  ┌──────────────────────────────┐  │
│  │ 500000                        │  │
│  └──────────────────────────────┘  │
│                                    │
│  Phụ tùng đã thay                  │
│  ┌──────────────────────┐  ┌───┐  │
│  │ VD: Má phanh trước   │  │ + │  │
│  └──────────────────────┘  └───┘  │
│  • Má phanh trước           [×]    │
│                                    │
│  Ghi chú sửa chữa                  │
│  ┌──────────────────────────────┐  │
│  │ Đã thay ắc quy mới GS 12V-7Ah│  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ GỬI CHECKLIST & CHỜ THANH TOÁN│  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Bước 3**: Nhấn **"Gửi checklist & chờ thanh toán"**:
- Hệ thống tự ghi nhận 5 mục an toàn (mặc định đạt): chạy thử, thu dọn dụng cụ, khu vực an toàn, bàn giao, không rò rỉ.
- Hệ thống chuyển công việc sang trạng thái `chờ thanh toán`.
- Rider nhận thông báo thanh toán.

Sau khi khách thanh toán thành công → công việc tự chuyển sang trạng thái `hoàn tất`.

### 3.9 Hiệu suất

**Đường dẫn**: Tab `Hiệu suất` 📈

```
┌────────────────────────────────────┐
│ ←  Hiệu suất          [📅 Lọc]    │
│                                    │
│ ┌────────────────────────────────┐ │
│ │  TỔNG QUAN                      │ │
│ │  Đánh giá:  4.8 ★ (62 đánh giá) │ │
│ │  Hoàn tất: 95%                  │ │
│ │  Hủy:      2%                   │ │
│ └────────────────────────────────┘ │
│                                    │
│ TỶ LỆ BÁO GIÁ                      │
│ ┌────────────────────────────────┐ │
│ │  Đã gửi:    87                  │ │
│ │  Được duyệt: 78 (89.7%)         │ │
│ │  Bị từ chối: 6  (6.9%)          │ │
│ │  Còn pending: 3                  │ │
│ └────────────────────────────────┘ │
│                                    │
│ TỶ LỆ NHẬN VIỆC                    │
│ ┌────────────────────────────────┐ │
│ │  Offer nhận:  90/110 (81.8%)    │ │
│ │  Từ chối:     20/110 (18.2%)    │ │
│ └────────────────────────────────┘ │
│                                    │
│ THỜI GIAN TRUNG BÌNH               │
│ ┌────────────────────────────────┐ │
│ │  Phản hồi yêu cầu:   2.3 phút     │ │
│ │  Hoàn tất công việc: 45 phút   │ │
│ │  Gửi báo giá:      18 phút     │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Lọc theo thời gian**: Nhấn icon 📅 → chọn khoảng ngày (mặc định 30 ngày gần nhất).

> Lưu ý: Hiệu suất KHÔNG hiển thị thu nhập/hoa hồng/thanh toán (theo chính sách hệ thống).

### 3.10 Lịch làm việc

**Đường dẫn**: Tab `Lịch làm việc` 📅

```
┌────────────────────────────────────┐
│ ←  Lịch làm việc       [Hôm nay]  │
│                                    │
│  ◀  Tuần 14-20/10/2026  ▶         │
│                                    │
│  Thứ 2  14/10                       │
│  ┌────────────────────────────────┐ │
│  │ 09:00  COR-RES-... (Hoàn tất) │ │
│  │ 14:00  COR-MNT-... (Đang xử lý)│ │
│  └────────────────────────────────┘ │
│                                    │
│  Thứ 3  15/10                       │
│  ┌────────────────────────────────┐ │
│  │ 10:30  COR-RES-... (Đang chờ) │ │
│  └────────────────────────────────┘ │
│                                    │
│  Thứ 4  16/10                       │
│  (rỗng)                            │
└────────────────────────────────────┘
```

Lịch hiển thị tất cả công việc đã lên lịch + đã hoàn tất, giúp bạn quản lý thời gian.

### 3.11 Hồ sơ cá nhân

**Đường dẫn**: Tab `Hồ sơ` 👤

```
┌────────────────────────────────────┐
│ ←  Hồ sơ                          │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [Avatar]                       │ │
│ │ Thợ Minh                       │ │
│ │ ★ 4.8 (62) · Garage Q.5        │ │
│ │ [Sửa hồ sơ]                    │ │
│ └────────────────────────────────┘ │
│                                    │
│ 📊 THỐNG KÊ                        │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │  120   │ │  4.8★  │ │  95%   │    │
│ │ Tổng   │ │ Rating │ │ Hoàn   │    │
│ │ việc   │ │        │ │ tất    │    │
│ └────────┘ └────────┘ └────────┘    │
│                                    │
│ 🏪 GARAGE                          │
│  📍 Địa chỉ: 124 Nguyễn Văn Cừ   │
│  🔧 Chuyên môn: Honda, Yamaha      │
│  📏 Bán kính: 5 km                 │
│                                    │
│ 🎖 CHỨNG CHỈ                       │
│  • Thợ chính Honda Việt Nam        │
│  • Chứng chỉ điện xe máy 2024      │
│                                    │
│ ⚙️  CÀI ĐẶT                        │
│  🌙  Chế độ tối                    │
│  🌐  Ngôn ngữ: Tiếng Việt          │
│  📍  Tự động chia sẻ vị trí         │
│  🔔  Thông báo                     │
│  💰  Phương thức nhận tiền          │
│  📞  Liên hệ hỗ trợ                │
│  📜  Điều khoản sử dụng             │
│  🚪  Đăng xuất                     │
└────────────────────────────────────┘
```

**Sửa hồ sơ**: Nhấn "Sửa hồ sơ" → sửa tên, SĐT, địa chỉ, avatar, chuyên môn, bán kính.

**Bật/tắt "Sẵn sàng nhận việc"**: Trong tab `Tổng quan` (xem 3.1) hoặc toggle ở header.

---

## Phần 4 — Câu hỏi thường gặp

### Rider

**Q: Tôi gửi yêu cầu cứu hộ nhưng không tìm được thợ?**
A: Hệ thống tự động chuyển sang chế độ `manual_escalation` sau một khoảng thời gian. Bạn sẽ thấy banner "Cần hỗ trợ" — vui lòng liên hệ tổng đài.

**Q: Tôi duyệt báo giá nhầm, có hủy được không?**
A: Không. Báo giá đã duyệt là bất biến. Bạn cần liên hệ thợ để tạo bản sửa đổi.

**Q: Thanh toán xong nhưng thợ chưa đến?**
A: Vui lòng kiểm tra trạng thái yêu cầu. Nếu sau 15 phút vẫn chưa có thợ, liên hệ hỗ trợ để được hoàn tiền.

**Q: Tôi có thể thay đổi xe sau khi đã gửi yêu cầu?**
A: Không. Bạn cần hủy yêu cầu hiện tại và tạo yêu cầu mới với xe khác.

### Mechanic

**Q: Yêu cầu biến mất trước khi tôi kịp nhấn "Nhận"?**
A: Yêu cầu có thời hạn (thường 60 giây). Nếu hết hạn hoặc thợ khác nhận trước, yêu cầu sẽ biến mất. Ứng dụng tự làm mới và hiển thị yêu cầu mới.

**Q: Tôi nhấn "Nhận" nhưng báo lỗi?**
A: Có thể yêu cầu đã hết hạn hoặc thợ khác nhận trước. Đợi 5–10 giây để ứng dụng tự cập nhật.

**Q: Tôi gửi báo giá nhưng rider từ chối?**
A: Mở chi tiết công việc → form báo giá hiển thị nút "Sửa" → tạo bản mới với giá khác.

**Q: Tôi có thể từ chối công việc sau khi đã nhận?**
A: Có, nhưng sẽ ảnh hưởng đến rating. Vào chi tiết → "Hủy công việc" → nhập lý do.

**Q: Tại sao "Chia sẻ vị trí" không hoạt động?**
A: Kiểm tra:
1. Đã cấp quyền Location cho app chưa? (Settings → Apps → CareOnRoad → Permissions)
2. GPS đã bật chưa?
3. Có đang ở travel state (`accepted` / `en_route`) không?

---

## Phần 5 — Xử lý sự cố

### App không kết nối được máy chủ

**Triệu chứng**: Mọi màn hình trống / hiển thị "Không tải được..."

**Cách xử lý**:
1. Kiểm tra kết nối internet (WiFi/4G).
2. Nếu dùng thiết bị thật qua mạng nội bộ: đảm bảo điện thoại cùng mạng WiFi với máy đang chạy dịch vụ.
3. Pull-to-refresh để tải lại.
4. Nếu vẫn lỗi: đăng xuất → đăng nhập lại.

### Không nhận được thông báo

**Cách xử lý**:
1. Settings → Apps → CareOnRoad → Notifications → BẬT.
2. Trong app: Hồ sơ → Thông báo → BẬT.
3. Kiểm tra WiFi/4G có ổn định không.

### Không gửi được vị trí (mechanic)

**Cách xử lý**:
1. Settings → Apps → CareOnRoad → Permissions → Location → "Allow all the time".
2. Bật GPS trên thiết bị.
3. Pull-to-refresh trong tab "Yêu cầu nhận".

### Quên mật khẩu

Hiện tại chưa có flow "Quên mật khẩu" trong app. Vui lòng liên hệ hỗ trợ qua email.

---

## Phụ lục — Trạng thái yêu cầu & vai trò

### Trạng thái yêu cầu dịch vụ (góc nhìn khách hàng)

| Mã trạng thái | Nghĩa | Giao diện hiển thị |
|---|---|---|
| `submitted` | Đã gửi, đang chờ tìm thợ | Tìm thợ |
| `dispatching` | Đang tìm thợ | Tìm thợ |
| `offered` | Đã gửi đề nghị cho một thợ cụ thể | Tìm thợ |
| `manual_escalation` | Không tìm được thợ | Tìm thợ (có banner hỗ trợ) |
| `assigned` | Thợ đã nhận việc | Theo dõi |
| `mechanic_en_route` | Thợ đang trên đường đến | Theo dõi |
| `in_service` | Thợ đang sửa xe | Theo dõi |
| `awaiting_quote_approval` | Chờ khách duyệt báo giá | Báo giá |
| `awaiting_payment` | Chờ thanh toán | Thanh toán |
| `completed` | Hoàn tất | Hoàn tất |
| `canceled` | Đã hủy | Đã hủy |

### Trạng thái công việc (góc nhìn thợ)

| Mã trạng thái | Nghĩa | Giao diện hiển thị |
|---|---|---|
| `accepted` | Đã nhận việc | Chờ xử lý |
| `en_route` | Đang trên đường đến | Chờ xử lý |
| `on_site` | Đã tới nơi | Chờ phụ tùng |
| `diagnosis` | Đang chẩn đoán | Chờ phụ tùng |
| `quoted` | Đã gửi báo giá | Chờ xử lý |
| `in_progress` | Đang sửa | Đang sửa |
| `awaiting_payment` | Chờ thanh toán | Đang sửa |
| `completed` | Hoàn tất | Hoàn tất |
| `canceled` | Đã hủy | Hoàn tất (hiển thị gần đúng) |
| `recovery_canceled` | Hệ thống hủy để khôi phục | Hoàn tất (hiển thị gần đúng) |

---

> **Ghi chú cuối**: Tài liệu này mô tả các tính năng hiện có của ứng dụng. Một số tính năng có thể được cập nhật trong các phiên bản sau. Vui lòng báo cáo lỗi hoặc đề xuất qua kênh hỗ trợ chính thức.
