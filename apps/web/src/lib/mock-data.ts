import type {
  BookingSlot,
  ContactChannel,
  EmergencyRequest,
  FaqItem,
  NewsArticle,
  ProcessStep,
  ServiceCategory,
  Testimonial,
} from "@/types";

/**
 * Static demo data. Replace calls with `apiClient.*` once the backend is wired.
 * All text is in Vietnamese to match the brand voice described in AGENTS.md.
 */

export const heroHighlights = [
  "Cứu hộ xe máy 24/7",
  "Phạm vi toàn quốc",
  "Thời gian phản hồi dưới 30 phút",
];

export const heroStats = [
  { label: "Kỹ thuật viên", value: "1.200+" },
  { label: "Tỉnh thành", value: "63" },
  { label: "Đánh giá trung bình", value: "4.8/5" },
  { label: "Yêu cầu đã xử lý", value: "85.000+" },
];

export const serviceCategories: ServiceCategory[] = [
  {
    id: "sv-01",
    slug: "cau-binh-ac-quy",
    title: "Cấu bình ắc quy",
    description: "Hỗ trợ kích bình, thay ắc quy tại chỗ nhanh chóng.",
    iconKey: "battery",
    basePriceVnd: 150_000,
  },
  {
    id: "sv-02",
    slug: "thay-ruot-cam",
    title: "Thay ruột / vá xe",
    description: "Vá vỏ, thay ruột xe máy các loại, kể cả xe ga, xe số.",
    iconKey: "tire",
    basePriceVnd: 80_000,
  },
  {
    id: "sv-03",
    slug: "cuu-ho-ac-quy",
    title: "Cứu hộ ắc quy",
    description: "Mang bình đến tận nơi, kiểm tra hệ thống điện miễn phí.",
    iconKey: "bolt",
    basePriceVnd: 200_000,
  },
  {
    id: "sv-04",
    slug: "kiem-tra-dong-co",
    title: "Kiểm tra động cơ",
    description: "Chẩn đoán nhanh các lỗi thường gặp bằng AI và checklist.",
    iconKey: "engine",
    basePriceVnd: 250_000,
  },
  {
    id: "sv-05",
    slug: "thay-nhot",
    title: "Thay nhớt / bảo dưỡng",
    description: "Thay nhớt, lọc gió, kiểm tra phanh, vệ sinh kim phun.",
    iconKey: "oil",
    basePriceVnd: 180_000,
  },
  {
    id: "sv-06",
    slug: "keo-xe-ve",
    title: "Kéo xe về garage",
    description: "Vận chuyển xe về garage gần nhất khi xe không thể di chuyển.",
    iconKey: "tow",
    basePriceVnd: 350_000,
  },
];

export const processSteps: ProcessStep[] = [
  {
    index: 1,
    title: "Gửi yêu cầu",
    description: "Chọn dịch vụ, nhập vị trí và mô tả nhanh tình trạng xe.",
  },
  {
    index: 2,
    title: "Chẩn đoán tự động",
    description: "AI hỗ trợ sàng lọc triệu chứng và đề xuất giải pháp phù hợp.",
  },
  {
    index: 3,
    title: "Điều phối kỹ thuật viên",
    description: "Hệ thống điều phối kỹ thuật viên gần bạn nhất trong vài phút.",
  },
  {
    index: 4,
    title: "Hoàn tất & đánh giá",
    description: "Thanh toán minh bạch, đánh giá chất lượng dịch vụ sau khi xong.",
  },
];

export const testimonials: Testimonial[] = [
  {
    id: "rv-01",
    authorName: "Nguyễn Minh Anh",
    rating: 5,
    body: "Xe hết xăng giữa đường lúc 11h đêm, chỉ 18 phút sau đã có kỹ thuật viên tới. Rất chuyên nghiệp.",
    date: "2026-09-12",
  },
  {
    id: "rv-02",
    authorName: "Trần Quốc Bảo",
    rating: 5,
    body: "App chẩn đoán đúng lỗi bộ đề, kỹ thuật viên thay tại chỗ, không phải kéo xe đi đâu cả.",
    date: "2026-09-04",
  },
  {
    id: "rv-03",
    authorName: "Lê Hồng Phúc",
    rating: 4,
    body: "Giá hơi cao hơn garage thường nhưng bù lại tiện và nhanh. Sẽ dùng tiếp.",
    date: "2026-08-29",
  },
];

export const newsArticles: NewsArticle[] = [
  {
    id: "news-01",
    slug: "5-dau-hieu-can-thay-nhot",
    title: "5 dấu hiệu cho thấy bạn cần thay nhớt ngay",
    excerpt:
      "Nhớt bẩn, máy nóng bất thường, tiếng kêu lạ — những tín hiệu không nên bỏ qua trước mùa mưa.",
    coverColor: "#d2e5db",
    publishedAt: "2026-09-20",
    category: "Bảo dưỡng",
  },
  {
    id: "news-02",
    slug: "meo-xu-ly-ac-quy-yeu",
    title: "Mẹo xử lý ắc quy yếu mùa mưa",
    excerpt:
      "Vài bước đơn giản giúp bạn tự kiểm tra và phục hồi ắc quy trước khi gọi cứu hộ.",
    coverColor: "#e9edf9",
    publishedAt: "2026-09-15",
    category: "Mẹo hay",
  },
  {
    id: "news-03",
    slug: "cach-chon-ruot-xe-phu-hop",
    title: "Cách chọn ruột xe đúng kích cỡ cho từng dòng xe",
    excerpt:
      "Hướng dẫn đọc thông số, chọn ruột chính hãng và tránh mua phải hàng trôi nổi trên thị trường.",
    coverColor: "#f0e2dd",
    publishedAt: "2026-09-10",
    category: "Cẩm nang",
  },
];

export const faqItems: FaqItem[] = [
  {
    id: "faq-01",
    question: "CareOnRoad hoạt động ở những khu vực nào?",
    answer:
      "Hiện tại CareOnRoad phủ sóng tại 63 tỉnh thành với hơn 1.200 kỹ thuật viên. Bạn có thể xem danh sách khu vực trong mục Cài đặt.",
  },
  {
    id: "faq-02",
    question: "Chi phí cứu hộ được tính như thế nào?",
    answer:
      "Chi phí được tính theo từng hạng mục dịch vụ và hiển thị minh bạch trước khi bạn xác nhận. Phí di chuyển ngoài phạm vi mặc định sẽ được thông báo trước.",
  },
  {
    id: "faq-03",
    question: "Tôi có thể theo dõi vị trí kỹ thuật viên không?",
    answer:
      "Có. Sau khi yêu cầu được tiếp nhận, bạn sẽ thấy vị trí và trạng thái di chuyển của kỹ thuật viên theo thời gian thực.",
  },
  {
    id: "faq-04",
    question: "Bảo hành dịch vụ trong bao lâu?",
    answer:
      "Mỗi hạng mục có thời hạn bảo hành riêng, thông thường từ 7 đến 30 ngày tùy dịch vụ. Thông tin bảo hành hiển thị ngay trong hóa đơn.",
  },
];

export const contactChannels: ContactChannel[] = [
  {
    id: "ch-phone",
    label: "Hotline cứu hộ",
    value: "1900 6868",
    hint: "24/7, miễn phí cuộc gọi",
    iconKey: "phone",
  },
  {
    id: "ch-mail",
    label: "Email hỗ trợ",
    value: "support@careonroad.vn",
    hint: "Phản hồi trong vòng 4 giờ làm việc",
    iconKey: "mail",
  },
  {
    id: "ch-chat",
    label: "Chat trực tuyến",
    value: "Trong ứng dụng CareOnRoad",
    hint: "Trợ lý AI + nhân viên hỗ trợ",
    iconKey: "chat",
  },
  {
    id: "ch-location",
    label: "Văn phòng",
    value: "Tầng 6, Toà nhà XYZ, Quận 1, TP.HCM",
    hint: "Giờ hành chính 8:30 – 18:00",
    iconKey: "location",
  },
];

export function generateBookingSlots(): BookingSlot[] {
  const today = new Date();
  const slots: BookingSlot[] = [];
  const hours = ["08:00", "10:00", "13:00", "15:00", "17:00", "19:00"];
  for (let day = 0; day < 7; day += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const iso = date.toISOString().slice(0, 10);
    hours.forEach((time, idx) => {
      slots.push({
        id: `${iso}-${idx}`,
        date: iso,
        time,
        available: (day + idx) % 4 !== 0,
      });
    });
  }
  return slots;
}

export const emergencyRequests: EmergencyRequest[] = [
  {
    requestCode: "COR-RV-20260920-0042",
    motorcycle: "Honda Vision 2021",
    location: "Quận Bình Thạnh, TP.HCM",
    status: "en_route",
    createdAt: "2026-09-26T03:48:00Z",
  },
  {
    requestCode: "COR-RV-20260918-0017",
    motorcycle: "Yamaha Sirius 2019",
    location: "Quận Gò Vấp, TP.HCM",
    status: "completed",
    createdAt: "2026-09-18T08:15:00Z",
  },
];
