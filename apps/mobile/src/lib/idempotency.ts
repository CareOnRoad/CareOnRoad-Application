/**
 * Helper sinh UUID v4 cho header `X-Idempotency-Key`.
 *
 * Backend yêu cầu length 8-200, format tự do (không enforce UUID strict).
 * Tuy nhiên dùng UUID v4 cho an toàn và tránh trùng giữa các client.
 *
 * RFC 4122 v4 layout:
 *   xxxxxxxx-xxxx-4xxx-Yxxx-xxxxxxxxxxxx
 *   trong đó Y = 8|9|a|b
 *
 * Math.random đủ dùng cho client demo; production có thể swap bằng
 * `react-native-get-random-values` + `crypto.randomUUID()`.
 *
 * ⚠️ Quan trọng: idempotency key phải được generate THEO USER INTENT,
 * không phải theo retry. Tức là mỗi lần user bấm "Yêu cầu cứu hộ"
 * phải là 1 key mới, dù request có thể retry vì mạng lag.
 */
export function newIdempotencyKey(): string {
  const hex = (bits: number) =>
    Math.floor(Math.random() * bits)
      .toString(16)
      .padStart(Math.ceil(Math.log2(bits) / 4), '0');

  // 32 hex chars data + 4 dashes = 36 chars total
  const data1 = hex(0xffffffff); // 8 chars
  const data2 = hex(0xffff); // 4 chars
  const data3 = `4${hex(0xfff)}`; // 4 chars (version 4)
  const y = (8 + Math.floor(Math.random() * 4)).toString(16); // 8|9|a|b
  const data4 = `${y}${hex(0xfff)}`; // 4 chars
  const data5 = `${hex(0xffffffff)}${hex(0xffff)}`; // 12 chars
  return `${data1}-${data2}-${data3}-${data4}-${data5}`;
}
