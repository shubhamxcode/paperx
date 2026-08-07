export type AiCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const MAX_AI_CANDLES = 500;

/**
 * Send every candle for PaperX's current ranges. The fallback keeps full-range
 * coverage if a future provider response exceeds the model context budget.
 */
export function prepareCandlesForAi(
  candles: AiCandle[],
  limit = MAX_AI_CANDLES
): { candles: AiCandle[]; complete: boolean } {
  if (candles.length <= limit) {
    return { candles, complete: true };
  }

  const step = (candles.length - 1) / (limit - 1);
  return {
    candles: Array.from(
      { length: limit },
      (_, index) => candles[Math.round(index * step)]
    ),
    complete: false,
  };
}
