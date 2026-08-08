import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyTutorScope,
  getTutorGuard,
  tutorContextSelection,
  visibleChartInterval,
} from "./intent";

test("routes greetings without loading market context", () => {
  assert.equal(classifyTutorScope({ question: "hey" }), "CASUAL");
  assert.equal(classifyTutorScope({ question: "How are you?" }), "CASUAL");
});

test("separates general learning from current-stock questions", () => {
  assert.equal(classifyTutorScope({ question: "What does diversification mean?" }), "GENERAL");
  assert.equal(classifyTutorScope({ question: "Explain today's candle and volume" }), "STOCK");
  assert.equal(classifyTutorScope({ question: "Teach me this chart" }), "STOCK");
});

test("loads portfolio data only for personal portfolio intent", () => {
  assert.equal(
    classifyTutorScope({
      surface: "portfolio",
      question: "What does diversification mean?",
    }),
    "GENERAL"
  );
  assert.equal(
    classifyTutorScope({
      surface: "portfolio",
      question: "Where am I concentrated?",
    }),
    "PORTFOLIO"
  );
  assert.equal(
    classifyTutorScope({
      surface: "portfolio",
      question: "Review my portfolio",
    }),
    "PORTFOLIO"
  );
  assert.equal(
    classifyTutorScope({
      surface: "portfolio",
      question: "How much money do I have?",
    }),
    "PORTFOLIO"
  );
  assert.equal(
    classifyTutorScope({
      surface: "portfolio",
      question: "What stocks do I own?",
    }),
    "PORTFOLIO"
  );
});

test("selects both contexts for stock-to-portfolio fit questions", () => {
  const scope = classifyTutorScope({
    surface: "stock",
    instrumentKey: "NSE_EQ|TEST",
    question: "How does this stock fit my portfolio?",
  });
  assert.equal(scope, "COMBINED");
  assert.deepEqual(tutorContextSelection(scope), {
    stock: true,
    portfolio: true,
  });
  assert.deepEqual(tutorContextSelection("PORTFOLIO"), {
    stock: false,
    portfolio: true,
  });
});

test("uses combined context for implicit current-stock portfolio questions", () => {
  for (const question of [
    "How does this affect my holdings?",
    "Would this make me too concentrated?",
    "Should I buy this?",
  ]) {
    assert.equal(
      classifyTutorScope({
        surface: "stock",
        instrumentKey: "NSE_EQ|TEST",
        question,
      }),
      "COMBINED"
    );
  }
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
