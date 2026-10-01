/**
 * UI catalog tĩnh — metadata cho form/selector, KHÔNG phải data user.
 *
 * Trước đây nằm trong `@/lib/mock-data`. Tách ra để có thể xoá mock data user
 * (mockVehicles, mockServices, mockEmergencyCalls, ...) mà giữ nguyên được
 * các enum/option dùng cho form UI.
 *
 * Lưu ý: BE không có bảng `service_types` riêng — `serviceTypes` chỉ là
 * placeholder cho UI chọn nhanh khi đặt lịch maintenance. Khi BE có catalog
 * chính thức sẽ chuyển sang load từ API.
 */

/**
 * Các loại sự cố cho flow cứu hộ khẩn cấp.
 * Icon name trỏ tới Lucide icon — map sang component ở chỗ dùng.
 */
export const issueCategories: readonly {
  id: string;
  label: string;
  icon: string;
}[] = [
  { id: 'engine', label: 'Engine Problem', icon: 'Cog' },
  { id: 'tire', label: 'Flat Tire', icon: 'CircleDot' },
  { id: 'battery', label: 'Battery Issue', icon: 'BatteryWarning' },
  { id: 'fuel', label: 'Out of Fuel', icon: 'Fuel' },
  { id: 'accident', label: 'Accident Assistance', icon: 'TriangleAlert' },
] as const;

/**
 * Các loại dịch vụ maintenance cho form đặt lịch.
 * Lưu ý: chỉ dùng để hiển thị + ước tính giá trong UI summary.
 * Giá thật do quote từ thợ quyết định sau khi khảo sát.
 */
export const serviceTypes: readonly {
  id: string;
  label: string;
  price: number;
  duration: string;
  icon?: string;
}[] = [
  { id: 'oil', label: 'Oil Change', price: 180000, duration: '30 min' },
  { id: 'brake', label: 'Brake Inspection', price: 150000, duration: '45 min' },
  { id: 'tire', label: 'Tire Inspection', price: 90000, duration: '20 min' },
  { id: 'general', label: 'General Maintenance', price: 350000, duration: '90 min' },
] as const;

/**
 * Khung giờ đặt lịch maintenance cố định trong ngày.
 * BE không có slot reservation — chỉ là gợi ý UI cho rider.
 */
export const timeSlots: readonly string[] = [
  '08:00',
  '09:30',
  '11:00',
  '13:30',
  '15:00',
  '16:30',
  '18:00',
] as const;

/**
 * Type helper cho icon map trong RescueScreen.
 */
export type IssueIconKey = (typeof issueCategories)[number]['icon'];
