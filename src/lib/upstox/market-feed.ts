"use client";

import { parse, type Type } from "protobufjs";

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

const PROTO = String.raw`
syntax = "proto3";
package com.upstox.marketdatafeederv3udapi.rpc.proto;
message LTPC { double ltp = 1; int64 ltt = 2; int64 ltq = 3; double cp = 4; }
message MarketLevel { repeated Quote bidAskQuote = 1; }
message MarketOHLC { repeated OHLC ohlc = 1; }
message Quote { int64 bidQ = 1; double bidP = 2; int64 askQ = 3; double askP = 4; }
message OptionGreeks { double delta = 1; double theta = 2; double gamma = 3; double vega = 4; double rho = 5; }
message OHLC { string interval = 1; double open = 2; double high = 3; double low = 4; double close = 5; int64 vol = 6; int64 ts = 7; }
enum Type { initial_feed = 0; live_feed = 1; market_info = 2; }
message MarketFullFeed { LTPC ltpc = 1; MarketLevel marketLevel = 2; OptionGreeks optionGreeks = 3; MarketOHLC marketOHLC = 4; double atp = 5; int64 vtt = 6; double oi = 7; double iv = 8; double tbq = 9; double tsq = 10; }
message IndexFullFeed { LTPC ltpc = 1; MarketOHLC marketOHLC = 2; }
message FullFeed { oneof FullFeedUnion { MarketFullFeed marketFF = 1; IndexFullFeed indexFF = 2; } }
message FirstLevelWithGreeks { LTPC ltpc = 1; Quote firstDepth = 2; OptionGreeks optionGreeks = 3; int64 vtt = 4; double oi = 5; double iv = 6; }
message Feed { oneof FeedUnion { LTPC ltpc = 1; FullFeed fullFeed = 2; FirstLevelWithGreeks firstLevelWithGreeks = 3; } RequestMode requestMode = 4; }
enum RequestMode { ltpc = 0; full_d5 = 1; option_greeks = 2; full_d30 = 3; }
enum MarketStatus { PRE_OPEN_START = 0; PRE_OPEN_END = 1; NORMAL_OPEN = 2; NORMAL_CLOSE = 3; CLOSING_START = 4; CLOSING_END = 5; }
message MarketInfo { map<string, MarketStatus> segmentStatus = 1; }
message FeedResponse { Type type = 1; map<string, Feed> feeds = 2; int64 currentTs = 3; MarketInfo marketInfo = 4; }
`;

const MARKET_STATUS = [
  "PRE_OPEN_START",
  "PRE_OPEN_END",
  "NORMAL_OPEN",
  "NORMAL_CLOSE",
  "CLOSING_START",
  "CLOSING_END",
];

function numberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ohlcValue(raw: unknown): LiveOhlc | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  return {
    interval: String(value.interval ?? ""),
    open: numberValue(value.open) ?? 0,
    high: numberValue(value.high) ?? 0,
    low: numberValue(value.low) ?? 0,
    close: numberValue(value.close) ?? 0,
    volume: numberValue(value.vol) ?? 0,
    timestamp: numberValue(value.ts) ?? 0,
  };
}

class SharedUpstoxMarketFeed {
  private socket: WebSocket | null = null;
  private feedResponse: Type = parse(PROTO).root.lookupType(
    "com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse"
  );
  private subscriptions = new Map<string, Subscription>();
  private connectedKeys = new Set<string>();
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private connecting = false;
  private marketStatusBySegment = new Map<string, string>();

  subscribe(instrumentKey: string, mode: MarketFeedMode, listener: Listener) {
    const current = this.subscriptions.get(instrumentKey);
    if (current) {
      current.listeners.add(listener);
      if (mode === "full" && current.mode !== "full") {
        current.mode = "full";
        this.send("change_mode", [instrumentKey], "full");
      }
    } else {
      this.subscriptions.set(instrumentKey, { listeners: new Set([listener]), mode });
      if (this.socket?.readyState === WebSocket.OPEN) this.send("sub", [instrumentKey], mode);
      else void this.connect();
    }

    return () => {
      const active = this.subscriptions.get(instrumentKey);
      if (!active) return;
      active.listeners.delete(listener);
      if (active.listeners.size === 0) {
        this.subscriptions.delete(instrumentKey);
        this.send("unsub", [instrumentKey]);
        this.connectedKeys.delete(instrumentKey);
      }
    };
  }

  private async connect() {
    if (this.connecting || this.socket?.readyState === WebSocket.OPEN || this.subscriptions.size === 0) return;
    this.connecting = true;
    try {
      const response = await fetch("/api/upstox/websocket/auth", { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as {
        data?: { authorizedRedirectUri?: string };
        error?: string;
      };
      if (!response.ok || !body.data?.authorizedRedirectUri) {
        if (response.status === 401) window.dispatchEvent(new Event("paperx_upstox_unauthorized"));
        throw new Error(body.error || "Could not authorize the live market feed");
      }

      const socket = new WebSocket(body.data.authorizedRedirectUri);
      socket.binaryType = "arraybuffer";
      this.socket = socket;
      socket.onopen = () => {
        this.connecting = false;
        this.reconnectAttempt = 0;
        this.connectedKeys.clear();
        for (const [key, subscription] of this.subscriptions) {
          this.send("sub", [key], subscription.mode);
        }
      };
      socket.onmessage = (event) => void this.handleMessage(event.data);
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        this.connecting = false;
        this.socket = null;
        this.connectedKeys.clear();
        this.scheduleReconnect();
      };
    } catch (error) {
      this.connecting = false;
      console.error("PaperX live market connection failed:", error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.subscriptions.size === 0 || this.reconnectTimer !== null) return;
    const delay = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt++);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private send(method: "sub" | "unsub" | "change_mode", keys: string[], mode?: MarketFeedMode) {
    if (!keys.length || this.socket?.readyState !== WebSocket.OPEN) return;
    const data: { instrumentKeys: string[]; mode?: MarketFeedMode } = { instrumentKeys: keys };
    if (mode) data.mode = mode;
    this.socket.send(new TextEncoder().encode(JSON.stringify({
      guid: crypto.randomUUID(),
      method,
      data,
    })));
    if (method === "sub") keys.forEach((key) => this.connectedKeys.add(key));
    if (method === "unsub") keys.forEach((key) => this.connectedKeys.delete(key));
  }

  private async handleMessage(data: unknown) {
    let buffer: Uint8Array;
    if (data instanceof ArrayBuffer) buffer = new Uint8Array(data);
    else if (data instanceof Blob) buffer = new Uint8Array(await data.arrayBuffer());
    else return;

    const decoded = this.feedResponse.toObject(this.feedResponse.decode(buffer), {
      longs: String,
      enums: Number,
      defaults: false,
    }) as Record<string, unknown>;

    const marketInfo = decoded.marketInfo as { segmentStatus?: Record<string, number> } | undefined;
    if (marketInfo?.segmentStatus) {
      Object.entries(marketInfo.segmentStatus).forEach(([segment, status]) => {
        this.marketStatusBySegment.set(segment, MARKET_STATUS[status] ?? "UNKNOWN");
      });
    }

    const feeds = decoded.feeds as Record<string, Record<string, unknown>> | undefined;
    if (!feeds) return;
    for (const [instrumentKey, rawFeed] of Object.entries(feeds)) {
      const fullFeed = rawFeed.fullFeed as Record<string, unknown> | undefined;
      const marketFeed = (fullFeed?.marketFF ?? fullFeed?.indexFF) as Record<string, unknown> | undefined;
      const ltpc = (rawFeed.ltpc ?? marketFeed?.ltpc) as Record<string, unknown> | undefined;
      const marketOhlc = marketFeed?.marketOHLC as { ohlc?: unknown[] } | undefined;
      const candles = (marketOhlc?.ohlc ?? []).map(ohlcValue).filter(Boolean) as LiveOhlc[];
      const segment = instrumentKey.split("|")[0];
      const update: LiveMarketUpdate = {
        instrumentKey,
        lastPrice: numberValue(ltpc?.ltp),
        closePrice: numberValue(ltpc?.cp),
        lastTradeTime: numberValue(ltpc?.ltt),
        volume: numberValue(marketFeed?.vtt),
        dayOhlc: candles.find((candle) => candle.interval === "1d") ?? null,
        minuteOhlc: candles.find((candle) => candle.interval === "I1") ?? null,
        marketStatus: this.marketStatusBySegment.get(segment) ?? null,
        receivedAt: Date.now(),
      };
      this.subscriptions.get(instrumentKey)?.listeners.forEach((listener) => listener(update));
    }
  }
}

export const sharedUpstoxMarketFeed = new SharedUpstoxMarketFeed();
