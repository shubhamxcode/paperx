import assert from "node:assert/strict";
import test from "node:test";
import type { AiCandle } from "./candle-context";
import { buildTechnicalContext } from "./technical-context";

const risingCandles: AiCandle[] = Array.from({ length: 60 }, (_, index) => ({
  time: 1_700_000_000 + index * 300,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
  volume: 1_000 + index * 10,
}));

test("builds deterministic bullish technical context", () => {
  const context = buildTechnicalContext(risingCandles);

  assert.equal(context.structure, "bullish");
  assert.equal(context.rsi14, 100);
  assert.ok(context.sma20 !== null);
  assert.ok(context.sma50 !== null);
  assert.ok(context.atr14 !== null);
  assert.deepEqual(context.recent20CandleRange, { low: 139, high: 161 });
});

test("reports insufficient data without inventing indicators", () => {
  const context = buildTechnicalContext(risingCandles.slice(0, 5));

  assert.equal(context.structure, "insufficient-data");
  assert.equal(context.sma20, null);
  assert.equal(context.sma50, null);
  assert.equal(context.rsi14, null);
  assert.equal(context.atr14, null);
});
