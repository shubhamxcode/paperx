import assert from "node:assert/strict";
import test from "node:test";
import { classifyTutorScope, getTutorGuard, visibleChartInterval } from "./intent";

test("routes greetings without loading market context", () => {
  assert.equal(classifyTutorScope({ question: "hey", live: false, deepAnalysis: false }), "CASUAL");
  assert.equal(classifyTutorScope({ question: "How are you?", live: false, deepAnalysis: false }), "CASUAL");
});

test("separates general learning from current-stock questions", () => {
  assert.equal(classifyTutorScope({ question: "What does diversification mean?", live: false, deepAnalysis: false }), "GENERAL");
  assert.equal(classifyTutorScope({ question: "Explain today's candle and volume", live: false, deepAnalysis: false }), "STOCK");
  assert.equal(classifyTutorScope({ question: "Teach me this", live: true, deepAnalysis: false }), "STOCK");
});

test("stops analysis when the requested candle interval is not visible", () => {
  const guard = getTutorGuard({ question: "Explain the 30 min candle chart", range: "1D", interval: "5m" });
  assert.equal(guard?.code, "INTERVAL_MISMATCH");
  assert.equal(guard?.requestedInterval, "30m");
  assert.match(guard?.message ?? "", /currently viewing 5m candles/);
  assert.match(guard?.message ?? "", /switch the Interval control/);
});

test("allows analysis when the requested interval matches", () => {
  assert.equal(getTutorGuard({ question: "Explain the 30-minute candles", range: "1D", interval: "30m" }), null);
  assert.equal(getTutorGuard({ question: "What happens after 30 minutes of trading?", range: "1D", interval: "5m" }), null);
});

test("understands natural interval names and range-derived resolutions", () => {
  const halfHourGuard = getTutorGuard({ question: "Teach me the half-hour chart", range: "1D", interval: "5m" });
  const hourlyGuard = getTutorGuard({ question: "Explain the hourly candle", range: "1D", interval: "15m" });
  assert.equal(halfHourGuard?.code, "INTERVAL_MISMATCH");
  assert.equal(hourlyGuard?.code, "INTERVAL_MISMATCH");
  if (halfHourGuard?.code === "INTERVAL_MISMATCH") assert.equal(halfHourGuard.requestedInterval, "30m");
  if (hourlyGuard?.code === "INTERVAL_MISMATCH") assert.equal(hourlyGuard.requestedInterval, "1h");
  assert.equal(visibleChartInterval({ range: "1W", interval: "5m" }), "30m");
  assert.equal(getTutorGuard({ question: "Explain this 30m chart", range: "1W", interval: "5m" }), null);
});

test("stops analysis when the requested chart range is not visible", () => {
  const guard = getTutorGuard({ question: "Explain the five-year chart", range: "1D", interval: "5m" });
  assert.equal(guard?.code, "RANGE_MISMATCH");
  assert.match(guard?.message ?? "", /select 5Y/);
  assert.equal(getTutorGuard({ question: "Explain this five-year chart", range: "5Y", interval: "5m" }), null);
});
