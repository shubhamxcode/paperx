import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAveragePricePaise,
  calculateSaleProceedsPaise,
  consumeFifoLots,
} from "./calculations";
import { getScheduledMarketStatus } from "./market-hours";

test("calculates a volume-weighted average when buying more shares", () => {
  // 100 shares at ₹100 plus 100 shares at ₹88 = 200 shares at ₹94.
  assert.equal(calculateAveragePricePaise(100, 10_000, 100, 8_800), 9_400);
});

test("partial sells credit the live price and recalculate remaining cost with FIFO", () => {
  const proceedsPaise = calculateSaleProceedsPaise(100, 11_000);
  const fifo = consumeFifoLots(
    [
      { id: 1, remainingQuantity: 100, pricePaise: 10_000 },
      { id: 2, remainingQuantity: 100, pricePaise: 8_800 },
    ],
    100
  );

  assert.equal(proceedsPaise, 1_100_000);
  assert.equal(fifo.remainingQuantity, 100);
  assert.equal(fifo.remainingAveragePricePaise, 8_800);
  assert.deepEqual(fifo.consumptions, [
    { id: 1, consumedQuantity: 100, remainingQuantity: 0 },
    { id: 2, consumedQuantity: 0, remainingQuantity: 100 },
  ]);
});

test("FIFO can partially consume the oldest purchase lot", () => {
  const fifo = consumeFifoLots(
    [
      { id: 1, remainingQuantity: 100, pricePaise: 5_000 },
      { id: 2, remainingQuantity: 50, pricePaise: 6_000 },
    ],
    50
  );

  assert.equal(fifo.remainingQuantity, 100);
  assert.equal(fifo.remainingAveragePricePaise, 5_500);
});

test("regular NSE/BSE schedule opens at 09:15 and closes at 15:30 IST", () => {
  assert.equal(
    getScheduledMarketStatus(new Date("2026-08-03T03:44:59.000Z")).open,
    false
  );
  assert.equal(
    getScheduledMarketStatus(new Date("2026-08-03T03:45:00.000Z")).open,
    true
  );
  assert.equal(
    getScheduledMarketStatus(new Date("2026-08-03T09:59:59.000Z")).open,
    true
  );
  assert.equal(
    getScheduledMarketStatus(new Date("2026-08-03T10:00:00.000Z")).open,
    false
  );
});

test("regular schedule is closed on weekends", () => {
  assert.equal(
    getScheduledMarketStatus(new Date("2026-08-08T04:30:00.000Z")).open,
    false
  );
});
