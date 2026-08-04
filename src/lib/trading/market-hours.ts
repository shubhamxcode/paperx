export const MARKET_OPEN_SECONDS = 9 * 3600 + 15 * 60;
export const MARKET_CLOSE_SECONDS = 15 * 3600 + 30 * 60;

export const MARKET_CLOSED_MESSAGE =
  "Market is closed. You cannot buy or sell before market opens or after market close (09:15 AM–03:30 PM IST).";

export type ScheduledMarketStatus = {
  open: boolean;
  label: "Market closes in" | "Next scheduled open in";
  seconds: number;
};

/** Regular NSE/BSE cash-market schedule. Upstox status remains authoritative for holidays. */
export function getScheduledMarketStatus(now = new Date()): ScheduledMarketStatus {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";
  const weekday = read("weekday");
  const secondsNow =
    Number(read("hour")) * 3600 +
    Number(read("minute")) * 60 +
    Number(read("second"));
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);

  if (
    weekdayIndex >= 1 &&
    weekdayIndex <= 5 &&
    secondsNow >= MARKET_OPEN_SECONDS &&
    secondsNow < MARKET_CLOSE_SECONDS
  ) {
    return {
      open: true,
      label: "Market closes in",
      seconds: MARKET_CLOSE_SECONDS - secondsNow,
    };
  }

  let daysUntilOpen = 0;
  let targetDay = weekdayIndex;
  if (!(weekdayIndex >= 1 && weekdayIndex <= 5 && secondsNow < MARKET_OPEN_SECONDS)) {
    do {
      daysUntilOpen += 1;
      targetDay = (targetDay + 1) % 7;
    } while (targetDay === 0 || targetDay === 6);
  }

  return {
    open: false,
    label: "Next scheduled open in",
    seconds: daysUntilOpen * 86_400 + MARKET_OPEN_SECONDS - secondsNow,
  };
}
