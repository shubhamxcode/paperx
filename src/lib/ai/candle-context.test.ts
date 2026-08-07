import assert from "node:assert/strict";
import test from "node:test";
import { prepareCandlesForAi, type AiCandle } from "./candle-context";

const candle = (time: number): AiCandle => ({
  time,
  open: time,
  high: time + 2,
  low: time - 1,
  close: time + 1,
  volume: time * 100,
});

test("sends every OHLCV candle when the selected range fits the AI budget", () => {
  const candles = [candle(1), candle(2), candle(3)];
  const result = prepareCandlesForAi(candles, 3);

  assert.equal(result.complete, true);
  assert.deepEqual(result.candles, candles);
});

test("preserves full-range coverage if a future response exceeds the budget", () => {
  const result = prepareCandlesForAi(
    [candle(1), candle(2), candle(3), candle(4), candle(5)],
    3
  );

  assert.equal(result.complete, false);
  assert.deepEqual(result.candles.map((item) => item.time), [1, 3, 5]);
});
