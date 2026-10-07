// Editorial source checks are not a mechanic's approval or a diagnosis.
export const knowledgeVersion = "2026-10-03.2";
export const knowledgeReviewedAt = "2026-10-03";

export const knowledgeSources = {
  "yamaha-battery": {
    title: "Xe máy hết ắc quy phải làm sao? Nguyên nhân & cách xử lý",
    url: "https://yamaha-motor.com.vn/tin-tuc/xe-may-het-ac-quy-phai-lam-sao/",
    published_at: "2026-03-11"
  },
  "yamaha-shutdown": {
    title: "Nguyên nhân xe máy đang chạy bị tắt máy và cách khắc phục",
    url: "https://yamaha-motor.com.vn/tin-tuc/xe-may-dang-chay-bi-tat-may/",
    published_at: "2026-03-10"
  },
  "yamaha-air-filter": {
    title: "Hướng dẫn cách vệ sinh lọc gió xe máy và lưu ý khi thực hiện",
    url: "https://yamaha-motor.com.vn/tin-tuc/huong-dan-cach-ve-sinh-loc-gio-xe-may-va-luu-y-khi-thuc-hien/",
    published_at: "2026-05-25"
  },
  "yamaha-brake-check": {
    title: "Kiểm tra độ mòn má phanh",
    url: "https://yamaha-motor.com.vn/dich-vu/kiem-tra-mon-ma-phanh/",
    published_at: null
  },
  "yamaha-tires": {
    title: "Lốp xe và những điều cần biết",
    url: "https://yamaha-motor.com.vn/dich-vu/lop-xe-va-nhung-dieu-can-biet/",
    published_at: null
  },
  "yamaha-fuel-consumption": {
    title: "Nguyên nhân và cách khắc phục xe máy hao xăng nhanh chóng",
    url: "https://yamaha-motor.com.vn/tin-tuc/cach-khac-phuc-xe-may-hao-xang/",
    published_at: "2026-03-10"
  },
  "yamaha-low-speed-jerk": {
    title: "Xe máy đi chậm bị giật do đâu? Nguyên nhân và cách khắc phục",
    url: "https://yamaha-motor.com.vn/tin-tuc/xe-may-di-cham-bi-giat/",
    published_at: "2026-03-10"
  },
  "yamaha-oil-check": {
    title: "Hướng dẫn cách kiểm tra nhớt xe máy chi tiết và đơn giản",
    url: "https://yamaha-motor.com.vn/tin-tuc/huong-dan-cach-kiem-tra-nhot-xe-may-chi-tiet-va-don-gian/",
    published_at: "2026-05-25"
  },
  "yamaha-flood": {
    title: "Cách xử lý xe máy bị ngập nước – Lưu ý đi đường mùa mưa",
    url: "https://yamaha-motor.com.vn/tin-tuc/cach-xu-ly-xe-may-bi-ngap-nuoc-luu-y-di-duong-mua-mua/",
    published_at: "2026-06-18"
  },
  "honda-vn-technical-faq": {
    title: "Honda Việt Nam: câu hỏi thường gặp về sử dụng xe máy",
    url: "https://www.honda.com.vn/index.php/cau-hoi-thuong-gap?category=xe-may",
    published_at: null
  },
  "suzuki-ph-raider-fi-manual": {
    title: "Suzuki Philippines: Raider R150 FI / FU150MF Owner's Manual",
    url: "https://mc.suzuki.com.ph/wp-content/uploads/2023/10/FU150MF-XE617MF-OWNERS-MANUAL-FINAL-Raider-R150-Fi.pdf",
    // The upload directory is not evidence of a publication or model year.
    published_at: null
  },
  "sym-vn-maintenance": {
    title: "SYM Việt Nam: lý do phải bảo dưỡng xe máy định kỳ",
    url: "https://www.sym.com.vn/tin-tuc/ly-do-phai-bao-duong-xe-may-dinh-ky-76.html",
    published_at: "2023-08-23"
  },
  "piaggio-vn-maintenance": {
    title: "Piaggio Việt Nam: bảo dưỡng định kỳ và tài liệu hướng dẫn",
    url: "https://www.piaggio.com/vn_VI/aftersales/scheduled-maintenance/",
    published_at: null
  }
} as const;

export type KnowledgeSourceId = keyof typeof knowledgeSources;
