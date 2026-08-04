import type { TutorRequest } from "@/lib/ai/schemas";

export type TutorScope = "CASUAL" | "GENERAL" | "STOCK";
export type TutorGuard = {
  code: "INTERVAL_MISMATCH";
  message: string;
  requestedInterval: string;
  visibleInterval: string;
} | {
  code: "RANGE_MISMATCH";
  message: string;
  requestedRange: TutorRequest["range"];
  visibleRange: TutorRequest["range"];
} | null;

const CASUAL_ONLY = /^(?:hi|hey|hello|hii+|hey there|good (?:morning|afternoon|evening)|how are you|what's up|thank(?:s| you)|bye)[!?.\s]*$/i;
const STOCK_CONTEXT = /\b(?:this|current|open)\s+(?:stock|company|chart)|\b(?:stock|company|chart|candle|ohlc|today|price|volume|trend|support|resistance|high|low|buy|sell|holding|order|portfolio|p&l|profit|loss)\b/i;

export function classifyTutorScope(input: Pick<TutorRequest, "mode" | "question">): TutorScope {
  if (input.mode !== "CHAT") return "STOCK";
  if (CASUAL_ONLY.test(input.question.trim())) return "CASUAL";
  return STOCK_CONTEXT.test(input.question) ? "STOCK" : "GENERAL";
}

const RANGE_INTERVAL: Record<TutorRequest["range"], string> = {
  "1D": "",
  "1W": "30m",
  "1M": "1h",
  "3M": "1 day",
  "1Y": "1 day",
  "5Y": "1 week",
};

export function visibleChartInterval(input: Pick<TutorRequest, "range" | "interval">) {
  return input.range === "1D" ? input.interval : RANGE_INTERVAL[input.range];
}

function requestedChartInterval(question: string) {
  if (!/\b(?:candle|candlestick|chart|timeframe|interval)s?\b/i.test(question)) return null;
  if (/\b(?:half[ -]?hour|30\s*(?:m|min|mins|minute|minutes))\b/i.test(question)) return "30m";
  if (/\b(?:one[ -]?hour|hourly|1\s*(?:h|hr|hrs|hour|hours))\b/i.test(question)) return "1h";
  const minute = question.match(/\b(1|5|15)\s*(?:m|min|mins|minute|minutes)\b/i)?.[1];
  if (minute) return `${minute}m`;
  if (/\b(?:daily|1\s*(?:d|day))\b/i.test(question)) return "1 day";
  if (/\b(?:weekly|1\s*(?:w|week))\b/i.test(question)) return "1 week";
  return null;
}

function requestedChartRange(question: string): TutorRequest["range"] | null {
  if (!/\b(?:candle|candlestick|chart|timeframe|range)s?\b/i.test(question)) return null;
  if (/\b(?:five|5)[ -]?year\b/i.test(question)) return "5Y";
  if (/\b(?:one|1)[ -]?year\b/i.test(question)) return "1Y";
  if (/\b(?:three|3)[ -]?month\b/i.test(question)) return "3M";
  if (/\b(?:one|1)[ -]?month\b/i.test(question)) return "1M";
  if (/\b(?:one|1)[ -]?week\b/i.test(question)) return "1W";
  if (/\b(?:today(?:'s)?|intraday|one[ -]?day|1[ -]?day)\b/i.test(question)) return "1D";
  return null;
}

export function getTutorGuard(input: Pick<TutorRequest, "question" | "range" | "interval">): TutorGuard {
  const requestedRange = requestedChartRange(input.question);
  if (requestedRange && requestedRange !== input.range) {
    return {
      code: "RANGE_MISMATCH",
      requestedRange,
      visibleRange: input.range,
      message: `You're currently viewing the ${input.range} chart, but you asked about the ${requestedRange} chart. Please select ${requestedRange} in the range control above the tutor, then ask me again. I'll analyze the newly loaded chart instead of guessing from the wrong range.`,
    };
  }
  const requestedInterval = requestedChartInterval(input.question);
  const visibleInterval = visibleChartInterval(input);
  if (!requestedInterval || requestedInterval === visibleInterval) return null;

  const switchInstruction = requestedInterval === "1 day" || requestedInterval === "1 week"
    ? `switch the chart range to one that uses ${requestedInterval} candles`
    : input.range !== "1D"
      ? `switch the chart range to 1D, then choose ${requestedInterval} in the Interval control`
    : `switch the Interval control above the tutor from ${visibleInterval} to ${requestedInterval}`;
  return {
    code: "INTERVAL_MISMATCH",
    requestedInterval,
    visibleInterval,
    message: `You're currently viewing ${visibleInterval} candles, but you asked about the ${requestedInterval} chart. Please ${switchInstruction}, then ask me again. Once that data is visible, I'll explain the actual candles instead of guessing from a different timeframe.`,
  };
}
