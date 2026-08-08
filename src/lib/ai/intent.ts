import type { TutorRequest } from "@/lib/ai/schemas";

export type TutorScope =
  | "CASUAL"
  | "GENERAL"
  | "STOCK"
  | "PORTFOLIO"
  | "COMBINED";

export function tutorContextSelection(scope: TutorScope) {
  return {
    stock: scope === "STOCK" || scope === "COMBINED",
    portfolio: scope === "PORTFOLIO" || scope === "COMBINED",
  } as const;
}
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
const STOCK_CONTEXT = /\b(?:this|current|open)\s+(?:stock|company|chart)|\b(?:stock|company|chart|candle|ohlc|today|price|volume|trend|support|resistance|high|low|buy|sell|order)\b/i;
const PORTFOLIO_CONTEXT = /\b(?:my|our)\s+(?:portfolio|holdings?|positions?|allocation|cash|balance|money|funds|capital|p&l|profit|loss(?:es)?|winners?|losers?)\b|\b(?:review|analyse|analyze|assess|rebalance|show|list)\s+(?:me\s+)?(?:my\s+)?(?:portfolio|holdings?|positions?)\b|\bwhere\s+am\s+i\s+concentrated\b|\b(?:my\s+)?(?:biggest|largest)\s+(?:position|holding|gain|winner|loss|loser)\b|\bhow\s+(?:diversified|concentrated)\s+(?:am\s+i|is\s+my\s+portfolio)\b|\bhow\s+much\s+(?:money|cash|balance|funds|capital)\s+(?:do\s+i\s+have|is\s+left|do\s+i\s+have\s+left)\b|\bwhat\s+(?:stocks?|shares?|companies)\s+do\s+i\s+own\b|\bwhich\s+(?:holding|position|stock)\s+should\s+i\s+(?:sell|reduce|exit)\b/i;
const PORTFOLIO_FIT = /\b(?:fit|affect|impact)\s+(?:in|into|on)?\s*(?:my\s+)?(?:portfolio|holdings?|allocation|exposure)\b|\b(?:add|buy|hold|reduce|sell)\s+(?:more|this|it)\b|\bmy\s+(?:holding|position)\s+in\s+(?:this|the)\s+(?:stock|company)\b|\bhow\s+does\s+(?:this|it)\s+(?:affect|impact|change)\s+my\s+(?:holdings?|portfolio|allocation|exposure)\b|\b(?:does|would)\s+(?:this|it)\s+(?:make|leave)\s+me\s+(?:too\s+)?concentrated\b/i;

export function classifyTutorScope(
  input: Pick<TutorRequest, "question"> &
    Partial<Pick<TutorRequest, "surface" | "instrumentKey">>
): TutorScope {
  if (CASUAL_ONLY.test(input.question.trim())) return "CASUAL";
  const surface = input.surface ?? "stock";
  const wantsPortfolio = PORTFOLIO_CONTEXT.test(input.question);
  const wantsCurrentStock =
    surface === "stock" &&
    (STOCK_CONTEXT.test(input.question) || PORTFOLIO_FIT.test(input.question));
  if (
    surface === "stock" &&
    (PORTFOLIO_FIT.test(input.question) ||
      (wantsPortfolio && wantsCurrentStock))
  ) {
    return "COMBINED";
  }
  if (wantsPortfolio) return "PORTFOLIO";
  if (surface === "stock" && STOCK_CONTEXT.test(input.question)) {
    return "STOCK";
  }
  return "GENERAL";
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
