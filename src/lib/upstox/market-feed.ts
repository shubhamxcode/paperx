"use client";

export type MarketFeedMode = "ltpc" | "full";

export type LiveMarketUpdate = {
  instrumentKey: string;
  lastPrice: number | null;
  closePrice: number | null;
  lastTradeTime: number | null;
  volume: number | null;
  dayOhlc: LiveOhlc | null;
  minuteOhlc: LiveOhlc | null;
  marketStatus: string | null;
  receivedAt: number;
};

export type LiveOhlc = {
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
};

type Listener = (update: LiveMarketUpdate) => void;
type Subscription = { listeners: Set<Listener>; mode: MarketFeedMode };

type Quote = {
  instrument_key?: string;
  instrument_token?: string;
  last_price?: number;
  net_change?: number;
  volume?: number;
  last_traded_time?: string;
};

const POLL_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_KEYS_PER_REQUEST = 50;

function tradeTimeMs(value: string | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric < 10_000_000_000) return numeric * 1_000;
    return numeric;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

class SharedUpstoxMarketFeed {
  private subscriptions = new Map<string, Subscription>();
  private timer: number | null = null;
  private polling = false;
  private failureCount = 0;

  subscribe(instrumentKey: string, mode: MarketFeedMode, listener: Listener) {
    const current = this.subscriptions.get(instrumentKey);
    if (current) {
      current.listeners.add(listener);
      if (mode === "full") current.mode = "full";
    } else {
      this.subscriptions.set(instrumentKey, {
        listeners: new Set([listener]),
        mode,
      });
    }

    this.schedule(0);

    return () => {
      const active = this.subscriptions.get(instrumentKey);
      if (!active) return;
      active.listeners.delete(listener);
      if (active.listeners.size === 0) this.subscriptions.delete(instrumentKey);
      if (this.subscriptions.size === 0 && this.timer !== null) {
        window.clearTimeout(this.timer);
        this.timer = null;
      }
    };
  }

  private schedule(delay: number) {
    if (this.timer !== null || this.subscriptions.size === 0) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, delay);
  }

  private async poll() {
    if (this.polling || this.subscriptions.size === 0) return;
    if (document.visibilityState !== "visible") {
      this.schedule(POLL_INTERVAL_MS);
      return;
    }

    this.polling = true;
    try {
      const keys = [...this.subscriptions.keys()];
      for (let index = 0; index < keys.length; index += MAX_KEYS_PER_REQUEST) {
        await this.pollBatch(keys.slice(index, index + MAX_KEYS_PER_REQUEST));
      }
      this.failureCount = 0;
    } catch (error) {
      this.failureCount += 1;
      console.error("PaperX market polling failed:", error);
    } finally {
      this.polling = false;
      const delay = this.failureCount
        ? Math.min(MAX_BACKOFF_MS, POLL_INTERVAL_MS * 2 ** (this.failureCount - 1))
        : POLL_INTERVAL_MS;
      this.schedule(delay);
    }
  }

  private async pollBatch(keys: string[]) {
    const params = new URLSearchParams();
    keys.forEach((key) => params.append("instrument_key", key));
    const response = await fetch(`/api/upstox/market/quotes?${params.toString()}`, {
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({})) as {
      data?: Record<string, Quote>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(body.error || "Market prices are temporarily unavailable");
    }

    const now = Date.now();
    for (const quote of Object.values(body.data ?? {})) {
      const instrumentKey = quote.instrument_key ?? quote.instrument_token;
      if (!instrumentKey) continue;
      const lastPrice =
        typeof quote.last_price === "number" && Number.isFinite(quote.last_price)
          ? quote.last_price
          : null;
      const lastTradeTime = tradeTimeMs(quote.last_traded_time);
      const mode = this.subscriptions.get(instrumentKey)?.mode;
      const minuteOhlc =
        mode === "full" && lastPrice !== null && lastTradeTime !== null
          ? {
              interval: "I1",
              open: lastPrice,
              high: lastPrice,
              low: lastPrice,
              close: lastPrice,
              volume: 0,
              timestamp: lastTradeTime,
            }
          : null;
      const update: LiveMarketUpdate = {
        instrumentKey,
        lastPrice,
        closePrice:
          lastPrice !== null && typeof quote.net_change === "number"
            ? lastPrice - quote.net_change
            : null,
        lastTradeTime,
        volume:
          typeof quote.volume === "number" && Number.isFinite(quote.volume)
            ? quote.volume
            : null,
        dayOhlc: null,
        minuteOhlc,
        marketStatus: null,
        receivedAt: now,
      };
      this.subscriptions
        .get(instrumentKey)
        ?.listeners.forEach((listener) => listener(update));
    }
  }
}

export const sharedUpstoxMarketFeed = new SharedUpstoxMarketFeed();
