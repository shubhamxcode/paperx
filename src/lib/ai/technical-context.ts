import type { AiCandle } from "@/lib/ai/candle-context";

const round = (value: number | null, digits = 2) =>
  value === null ? null : Number(value.toFixed(digits));

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function sma(candles: AiCandle[], period: number) {
  if (candles.length < period) return null;
  return average(candles.slice(-period).map((candle) => candle.close));
}

function rsi(candles: AiCandle[], period = 14) {
  if (candles.length <= period) return null;
  const closes = candles.slice(-(period + 1)).map((candle) => candle.close);
  let gains = 0;
  let losses = 0;
  for (let index = 1; index < closes.length; index++) {
    const change = closes[index] - closes[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const relativeStrength = gains / period / (losses / period);
  return 100 - 100 / (1 + relativeStrength);
}

function atr(candles: AiCandle[], period = 14) {
  if (candles.length <= period) return null;
  const recent = candles.slice(-(period + 1));
  const trueRanges = recent.slice(1).map((candle, index) => {
    const previousClose = recent[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
  return average(trueRanges);
}

export function buildTechnicalContext(candles: AiCandle[]) {
  const first = candles[0] ?? null;
  const last = candles.at(-1) ?? null;
  const recent = candles.slice(-20);
  const sma20 = sma(candles, 20);
  const sma50 = sma(candles, 50);
  const averageVolume20 = average(recent.map((candle) => candle.volume));
  const latestVolumeRatio =
    last && averageVolume20 && averageVolume20 > 0
      ? last.volume / averageVolume20
      : null;

  let structure: "bullish" | "bearish" | "mixed" | "insufficient-data" =
    "insufficient-data";
  if (last && sma20 !== null) {
    if (sma50 !== null && last.close > sma20 && sma20 > sma50) {
      structure = "bullish";
    } else if (sma50 !== null && last.close < sma20 && sma20 < sma50) {
      structure = "bearish";
    } else {
      structure = "mixed";
    }
  }

  return {
    methodology:
      "Deterministic calculations from the selected chart OHLCV; these describe history and do not predict future returns.",
    structure,
    selectedRangeChangePercent:
      first && last && first.open > 0
        ? round(((last.close - first.open) / first.open) * 100)
        : null,
    sma20: round(sma20),
    sma50: round(sma50),
    rsi14: round(rsi(candles)),
    atr14: round(atr(candles)),
    averageVolume20: round(averageVolume20, 0),
    latestVolumeRatio: round(latestVolumeRatio),
    recent20CandleRange: recent.length
      ? {
          low: round(Math.min(...recent.map((candle) => candle.low))),
          high: round(Math.max(...recent.map((candle) => candle.high))),
        }
      : null,
  };
}
