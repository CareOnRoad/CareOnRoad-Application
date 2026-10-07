import { formatVND } from '@/lib/format';

interface Diagnosis {
  cause: string;
  advice: string;
  priceLabel: string;
}

const rules: { keywords: string[]; result: Diagnosis }[] = [
  {
    keywords: ['không khởi động', 'không nổ', 'khởi động', 'chết máy', 'đề', 'đánh lửa'],
    result: {
      cause: 'Có thể ắc quy yếu / hết, hoặc rơ-le đề bị lỗi.',
      advice: 'Thử đạp nổ. Nếu đèn bảng đồng hồ mờ, gần như chắc chắn do ắc quy.',
      priceLabel: `${formatVND(120000)} – ${formatVND(450000)}`,
    },
  },
  {
    keywords: ['xẹp lốp', 'thủng lốp', 'lốp', 'vỏ', 'đinh', 'bánh'],
    result: {
      cause: 'Lốp bị đâm đinh hoặc xẹp do dị vật trên đường.',
      advice: 'Không nên chạy tiếp. Thợ mang theo bộ vá và ruột dự phòng.',
      priceLabel: `${formatVND(60000)} – ${formatVND(250000)}`,
    },
  },
  {
    keywords: ['hết xăng', 'xăng', 'nhiên liệu', 'cạn'],
    result: {
      cause: 'Hết xăng — nguyên nhân phổ biến nhất khi gọi cứu hộ.',
      advice: 'Thợ có thể mang đến 1–2 lít xăng để bạn chạy tới trạm gần nhất.',
      priceLabel: `${formatVND(40000)} – ${formatVND(90000)}`,
    },
  },
  {
    keywords: ['khói', 'nóng', 'quá nhiệt', 'động cơ', 'tiếng kêu', 'gõ', 'chết giữa đường'],
    result: {
      cause: 'Có thể động cơ bị quá nhiệt hoặc thiếu dầu nhớt.',
      advice: 'Tắt máy ngay để tránh hư hỏng nặng thêm.',
      priceLabel: `${formatVND(200000)} – ${formatVND(900000)}`,
    },
  },
  {
    keywords: ['phanh', 'thắng', 'kêu', 'rít'],
    result: {
      cause: 'Má phanh mòn hoặc hệ thống phanh thuỷ lực có vấn đề.',
      advice: 'Chạy chậm, tận dụng phanh động cơ cho tới khi thợ tới.',
      priceLabel: `${formatVND(150000)} – ${formatVND(400000)}`,
    },
  },
  {
    keywords: ['sên', 'xích', 'lỏng', 'trượt', 'truyền động'],
    result: {
      cause: 'Sên bị lỏng, mòn hoặc văng khỏi bộ đề.',
      advice: 'Tránh tăng ga mạnh. Đây là sự cố sửa nhanh ngay tại chỗ.',
      priceLabel: `${formatVND(80000)} – ${formatVND(300000)}`,
    },
  },
];

export function diagnose(text: string): string {
  const lower = text.toLowerCase();
  const match = rules.find((r) => r.keywords.some((k) => lower.includes(k)));
  const d =
    match?.result ?? {
      cause: 'Dựa trên mô tả của bạn, có thể liên quan tới hệ điện hoặc hệ nhiên liệu.',
      advice: 'Gửi kèm ảnh hoặc mô tả thêm vài chi tiết để mình xác định chính xác hơn.',
      priceLabel: `${formatVND(100000)} – ${formatVND(500000)}`,
    };
  return `${d.cause}\n\n${d.advice}\n\nChi phí sửa chữa ước tính: ${d.priceLabel}. Thợ gần bạn sẽ xác nhận lại khi tới nơi.`;
}

export const aiSuggestions = [
  'Xe của tôi không khởi động được',
  'Tôi bị xẹp lốp',
  'Động cơ phát ra tiếng kêu lạ',
  'Tôi bị hết xăng',
];
