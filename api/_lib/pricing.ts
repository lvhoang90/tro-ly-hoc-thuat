// Chi phí API Claude (USD) tính từ số token thực tế trong phản hồi. Giá theo USD cho 1 triệu token (nhập / xuất).
// Cập nhật khi Anthropic đổi giá, hoặc đặt ANTHROPIC_PRICE_IN / ANTHROPIC_PRICE_OUT để ghi đè cho mô hình đang dùng.
const PRICES: Record<string, [number, number]> = {
  "claude-fable-5-1": [10, 50], "claude-fable-5": [10, 50],
  "claude-opus-5-5": [4, 20], "claude-opus-5": [5, 25], "claude-opus-4-8": [5, 25], "claude-opus-4-7": [5, 25], "claude-opus-4-6": [5, 25],
  "claude-sonnet-5-5": [2, 10], "claude-sonnet-5": [2, 10], "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5": [1, 5],
};

export function priceOf(model: string): [number, number] {
  const envIn = Number(process.env.ANTHROPIC_PRICE_IN), envOut = Number(process.env.ANTHROPIC_PRICE_OUT);
  if (envIn > 0 && envOut > 0) return [envIn, envOut];
  return PRICES[model] ?? PRICES[model.replace(/-\d{8}$/, "")] ?? [5, 25]; // mô hình lạ: ước lượng theo mức Opus
}

export const costUsd = (model: string, inTokens: number, outTokens: number) => {
  const [pi, po] = priceOf(model);
  return (inTokens * pi + outTokens * po) / 1_000_000;
};

/** Chi phí khi dùng bộ nhớ đệm lời nhắc: ghi đệm tính 1,25 lần giá nhập, đọc đệm 0,1 lần. */
export function costUsdCached(model: string, u: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  const [pi, po] = priceOf(model);
  const plain = u.input_tokens ?? 0, write = u.cache_creation_input_tokens ?? 0, read = u.cache_read_input_tokens ?? 0;
  return (plain * pi + write * pi * 1.25 + read * pi * 0.1 + (u.output_tokens ?? 0) * po) / 1_000_000;
}
