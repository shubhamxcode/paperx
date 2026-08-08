"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bookmark,
  BookmarkCheck,
  CandlestickChart,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { DashboardNav, type DashboardTab, type InstrumentSearchResult } from "@/components/dashboard/DashboardNav";
import { StockLogo } from "@/components/StockLogo";
import { useWatchlist } from "@/lib/useWatchlist";
import { sharedUpstoxMarketFeed, type LiveMarketUpdate } from "@/lib/upstox/market-feed";
import { getScheduledMarketStatus } from "@/lib/trading/market-hours";
import { SoujiAssistant } from "@/components/souji/SoujiAssistant";
import { StockChart, type Candle, type LearningOverlay, type StockChartHandle } from "./StockChart";

type Range = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";
type IntradayInterval = "1m" | "5m" | "15m" | "30m" | "1h";
type IncomeHistory = { value: number; period: string; change?: string };
type IncomeData = {
  type: string;
  time_period: string;
  units_in: string;
  income_statement: Array<{
    category: "revenue" | "operating_profit" | "net_profit";
    history: IncomeHistory[];
  }>;
};
type StockData = {
  instrument: {
    instrumentKey: string;
    tradingSymbol: string;
    name: string | null;
    exchange: string;
    segment: string;
    instrumentType: string | null;
    isin: string | null;
    logoUrl: string | null;
  };
  tradeable: boolean;
  wallet: { balancePaise: number };
  holding: { quantity: number; avgPricePaise: number | null };
  inWatchlist: boolean;
  quote: {
    last_price?: number;
    net_change?: number;
    volume?: number;
    lower_circuit_limit?: number;
    upper_circuit_limit?: number;
    last_traded_time?: string;
  } | null;
  companyProfile: {
    company_profile: string;
    sector: string;
    sector_market_cap_inr?: { formatted: string };
  } | null;
  ratios: Array<{ name: string; company_value: string; sector_value: string }>;
  income: { quarterly: IncomeData | null; yearly: IncomeData | null };
  availability: {
    quote: boolean;
    fundamentals: boolean;
    marketDataUnavailable?: boolean;
  };
};

const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y", "5Y"];
const INTRADAY_INTERVALS: IntradayInterval[] = ["1m", "5m", "15m", "30m", "1h"];
const INTERVAL_SECONDS: Record<IntradayInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
};
const money = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const paise = (value: number | null | undefined) => value == null ? "—" : money(value / 100);
const number = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("en-IN");

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
    : `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function MarketSessionTimer() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const status = getScheduledMarketStatus(now);
  return (
    <div
      className={`flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs ${status.open ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300" : "border-white/10 bg-white/[0.03] text-slate-400"}`}
      title="Regular NSE session: Monday–Friday, 09:15–15:30 IST. Exchange holidays may differ."
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status.open ? "bg-emerald-400" : "bg-slate-500"}`} aria-hidden="true" />
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{status.label}</span>
      <time className="font-medium tabular-nums text-white">{formatDuration(Math.max(0, status.seconds))}</time>
      <span className="hidden text-slate-500 sm:inline">IST</span>
    </div>
  );
}

function MarketPosition({ low, high, value }: { low: number | null; high: number | null; value: number | null }) {
  const percent = low != null && high != null && value != null && high > low
    ? Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100))
    : null;
  return (
    <div className="relative mt-3 h-1 rounded-full bg-white/10">
      {percent != null && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-cyan-300" style={{ left: `${percent}%` }} />}
    </div>
  );
}

function FinancialPerformance({ quarterly, yearly }: { quarterly: IncomeData | null; yearly: IncomeData | null }) {
  const [period, setPeriod] = useState<"quarterly" | "yearly">("quarterly");
  const data = period === "quarterly" ? quarterly : yearly;
  const revenue = data?.income_statement.find((item) => item.category === "revenue")?.history ?? [];
  const profit = data?.income_statement.find((item) => item.category === "net_profit")?.history ?? [];
  const rows = revenue.slice(0, 5).reverse().map((item) => ({
    period: item.period,
    revenue: item.value,
    revenueChange: item.change,
    profit: profit.find((entry) => entry.period === item.period)?.value ?? 0,
    profitChange: profit.find((entry) => entry.period === item.period)?.change,
  }));
  const max = Math.max(1, ...rows.flatMap((item) => [Math.abs(item.revenue), Math.abs(item.profit)]));

  return (
    <section className="border-t border-white/10 py-8" aria-labelledby="financial-performance-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="financial-performance-heading" className="text-lg font-semibold text-white">Financial performance</h2>
          <p className="mt-1 text-sm text-slate-400">Consolidated revenue and net profit reported by Upstox Fundamentals</p>
        </div>
        <div className="flex rounded-lg border border-white/10 p-1">
          {(["quarterly", "yearly"] as const).map((item) => (
            <button key={item} onClick={() => setPeriod(item)} className={`rounded-md px-3 py-1.5 text-sm capitalize ${period === item ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-slate-500">Financial history is not available for this instrument.</div>
      ) : (
        <div className="mt-6 rounded-xl border border-white/10 bg-[#0b0d10] p-5">
          <div className="mb-5 flex flex-wrap gap-5 text-xs text-slate-400">
            <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-slate-400" />Revenue (Cr)</span>
            <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />Net profit (Cr)</span>
          </div>
          <div className="flex h-64 items-end gap-3 overflow-x-auto border-b border-white/10 pb-7 sm:gap-5">
            {rows.map((item) => (
              <div key={item.period} className="flex min-w-24 flex-1 flex-col items-center justify-end">
                <div className="mb-2 text-center text-xs text-slate-300">{number(item.revenue)}<span className="ml-1 text-emerald-400">{item.revenueChange}</span></div>
                <div className="flex h-44 items-end gap-2">
                  <div title={`Revenue ₹${number(item.revenue)} Cr`} className="w-7 rounded-t bg-slate-400/80 sm:w-9" style={{ height: `${Math.max(4, Math.abs(item.revenue) / max * 100)}%` }} />
                  <div title={`Net profit ₹${number(item.profit)} Cr`} className={`w-7 rounded-t sm:w-9 ${item.profit >= 0 ? "bg-emerald-400/80" : "bg-red-400/80"}`} style={{ height: `${Math.max(4, Math.abs(item.profit) / max * 100)}%` }} />
                </div>
                <span className="mt-2 text-xs text-slate-500">{item.period}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function OrderTicket({ data, livePrice, onComplete }: { data: StockData; livePrice: number | null; onComplete: () => Promise<void> }) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [marketNow, setMarketNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setMarketNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const marketStatus = getScheduledMarketStatus(marketNow);
  const qty = Number(quantity);
  const total = Number.isInteger(qty) && qty > 0 && livePrice ? qty * livePrice : 0;

  const submit = async () => {
    if (!Number.isInteger(qty) || qty <= 0) return toast.error("Enter a valid whole-number quantity");
    if (!data.tradeable) return toast.error("This instrument is view-only");
    if (!getScheduledMarketStatus().open) {
      return toast.error("Market is closed. You cannot buy or sell after market close or before market open.");
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/trade/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentKey: data.instrument.instrumentKey, side, quantity: qty }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Order failed");
      }
      if (body.order?.status === "REJECTED") throw new Error(body.order.reason || "Order rejected");
      toast.success(`${side} order filled at ${paise(body.order?.pricePaise)}`);
      setQuantity("");
      await onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="lg:sticky lg:top-[122px] lg:self-start">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0d10]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-semibold text-white">{data.instrument.name || data.instrument.tradingSymbol}</h2>
          <p className="mt-1 text-xs text-slate-500">{data.instrument.exchange} {money(livePrice)} · Paper trade</p>
        </div>
        <div className="grid grid-cols-2 border-b border-white/10">
          {(["BUY", "SELL"] as const).map((item) => (
            <button key={item} onClick={() => setSide(item)} className={`border-b-2 px-5 py-3 text-sm font-semibold ${side === item ? item === "BUY" ? "border-emerald-400 text-emerald-400" : "border-red-400 text-red-400" : "border-transparent text-slate-500"}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="space-y-5 p-5">
          <div className="flex gap-2">
            <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-300">Delivery</span>
            <span className="cursor-not-allowed rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-600" title="Intraday positions are not implemented yet">Intraday</span>
          </div>
          <label className="block">
            <span className="mb-2 flex justify-between text-sm text-slate-300"><span>Quantity</span><span className="text-xs text-slate-500">Owned: {data.holding.quantity}</span></span>
            <input inputMode="numeric" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ""))} className="h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-right text-white focus:border-cyan-400/50" placeholder="0" />
          </label>
          <div className="flex items-center justify-between border-y border-white/10 py-4 text-sm">
            <span className="text-slate-400">Market price</span><span className="font-medium text-white">{money(livePrice)}</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-500"><span>Virtual balance</span><span>{paise(data.wallet.balancePaise)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Approx. order value</span><span>{money(total)}</span></div>
          </div>
          {!marketStatus.open && (
            <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] p-3 text-xs leading-relaxed text-amber-200">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>Market is closed. You cannot buy or sell after market close or before market open.</p>
            </div>
          )}
          <button disabled={submitting || !data.tradeable || !livePrice || !marketStatus.open} onClick={() => void submit()} className={`flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${side === "BUY" ? "bg-emerald-500 hover:bg-emerald-400" : "bg-red-500 hover:bg-red-400"}`}>
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : `${side === "BUY" ? "Buy" : "Sell"} with virtual funds`}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-slate-600">Execution uses a fresh server-side Upstox price. No real order is sent.</p>
        </div>
      </div>
    </aside>
  );
}

export function StockDetailClient({ instrumentKey }: { instrumentKey: string }) {
  const chartRef = useRef<StockChartHandle>(null);
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<DashboardTab>("Explore");
  const [data, setData] = useState<StockData | null>(null);
  const [range, setRange] = useState<Range>("1D");
  const [intradayInterval, setIntradayInterval] = useState<IntradayInterval>("5m");
  const [chartType, setChartType] = useState<"candles" | "line">("candles");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [yearCandles, setYearCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveMarketUpdate | null>(null);
  const [learningOverlays, setLearningOverlays] = useState<LearningOverlay[]>([]);
  const { add, remove, has } = useWatchlist();

  const fetchDetail = useCallback(async (): Promise<StockData> => {
    const response = await fetch(`/api/stocks/${encodeURIComponent(instrumentKey)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Could not load this stock");
    }
    return body as StockData;
  }, [instrumentKey]);

  const refreshDetail = useCallback(async () => {
    setData(await fetchDetail());
  }, [fetchDetail]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    fetchDetail().then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load stock")).finally(() => setLoading(false));
  }, [fetchDetail]);

  useEffect(() => {
    const controller = new AbortController();
    const intervalQuery = range === "1D" ? `&interval=${intradayInterval}` : "";
    fetch(`/api/upstox/market/candles?instrumentKey=${encodeURIComponent(instrumentKey)}&range=${range}${intervalQuery}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Could not load chart");
        setCandles(body.candles ?? []);
        if (range === "1Y") setYearCandles(body.candles ?? []);
      })
      .catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) toast.error(cause instanceof Error ? cause.message : "Could not load chart"); })
      .finally(() => { if (!controller.signal.aborted) setChartLoading(false); });
    return () => controller.abort();
  }, [instrumentKey, range, intradayInterval]);

  useEffect(() => {
    if (yearCandles.length > 0 || range === "1Y") return;
    const controller = new AbortController();
    fetch(`/api/upstox/market/candles?instrumentKey=${encodeURIComponent(instrumentKey)}&range=1Y`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { candles: [] })
      .then((body) => setYearCandles(body.candles ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [instrumentKey, range, yearCandles.length]);

  useEffect(() => {
    return sharedUpstoxMarketFeed.subscribe(instrumentKey, "full", (update) => {
      setLive(update);
      if (!update.minuteOhlc || range !== "1D") return;
      const minute = update.minuteOhlc;
      const intervalSeconds = INTERVAL_SECONDS[intradayInterval];
      // NSE opens at 09:15 IST (03:45 UTC). Anchoring larger candles to the
      // session open keeps 30m/1h live buckets aligned with Upstox candles.
      const marketOpenOffsetSeconds = 3 * 3600 + 45 * 60;
      const timestampSeconds = Math.floor(minute.timestamp / 1000);
      const bucket = Math.floor((timestampSeconds - marketOpenOffsetSeconds) / intervalSeconds) * intervalSeconds + marketOpenOffsetSeconds;
      setCandles((current) => {
        const next = [...current];
        const index = next.findIndex((candle) => candle.time === bucket);
        if (index >= 0) {
          const existing = next[index];
          next[index] = { ...existing, high: Math.max(existing.high, minute.high), low: Math.min(existing.low, minute.low), close: minute.close, volume: Math.max(existing.volume, minute.volume) };
        } else {
          next.push({ time: bucket, open: minute.open, high: minute.high, low: minute.low, close: minute.close, volume: minute.volume });
        }
        return next.sort((a, b) => a.time - b.time);
      });
    });
  }, [instrumentKey, range, intradayInterval]);

  const livePrice = live?.lastPrice ?? data?.quote?.last_price ?? null;
  const previousClose = live?.closePrice ?? (data?.quote?.last_price != null && data.quote.net_change != null ? data.quote.last_price - data.quote.net_change : null);
  const change = livePrice != null && previousClose != null ? livePrice - previousClose : data?.quote?.net_change ?? null;
  const changePercent = change != null && previousClose ? change / previousClose * 100 : null;
  const dayHigh = live?.dayOhlc?.high ?? (range === "1D" && candles.length ? Math.max(...candles.map((c) => c.high)) : null);
  const dayLow = live?.dayOhlc?.low ?? (range === "1D" && candles.length ? Math.min(...candles.map((c) => c.low)) : null);
  const open = live?.dayOhlc?.open ?? (range === "1D" ? candles[0]?.open ?? null : null);
  const yearHigh = yearCandles.length ? Math.max(...yearCandles.map((c) => c.high)) : null;
  const yearLow = yearCandles.length ? Math.min(...yearCandles.map((c) => c.low)) : null;
  const positive = (change ?? 0) >= 0;

  const selectInstrument = async (instrument: InstrumentSearchResult) => {
    router.push(`/stocks/${encodeURIComponent(instrument.instrumentKey)}`);
  };
  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    router.push(`/dashboard?tab=${tab.toLowerCase()}`);
  };

  const toggleWatchlist = async () => {
    if (!data) return;
    try {
      if (has(data.instrument.instrumentKey)) await remove(data.instrument.instrumentKey);
      else await add({ key: data.instrument.instrumentKey, symbol: data.instrument.tradingSymbol, exchange: data.instrument.exchange, logoUrl: data.instrument.logoUrl });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update watchlist");
    }
  };

  if (status === "loading" || loading) return <div className="paperx-dashboard min-h-screen bg-[#07090b] text-white"><div className="mx-auto max-w-7xl animate-pulse space-y-5 px-6 py-10"><div className="h-16 rounded-xl bg-white/5"/><div className="h-[520px] rounded-xl bg-white/5"/></div></div>;
  if (error || !data) return <div className="paperx-dashboard flex min-h-screen items-center justify-center bg-[#07090b] p-6 text-white"><div className="max-w-md text-center"><CircleAlert className="mx-auto h-8 w-8 text-red-400"/><h1 className="mt-4 text-xl font-semibold">Could not open this stock</h1><p className="mt-2 text-sm text-slate-400">{error}</p><button onClick={() => router.push("/dashboard")} className="paperx-button-secondary mt-5">Back to Explore</button></div></div>;

  const ratios = new Map(data.ratios.map((ratio) => [ratio.name, ratio]));
  const inWatchlist = has(data.instrument.instrumentKey);

  return (
    <div className="paperx-dashboard min-h-screen bg-[#07090b] text-slate-100">
      <Toaster position="top-right" />
      <DashboardNav userName={session?.user?.name} userEmail={session?.user?.email} userImage={session?.user?.image} activeTab={activeTab} onTabChange={selectTab} onInstrumentSelect={selectInstrument} />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {data.availability.marketDataUnavailable && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">
            <CircleAlert className="h-4 w-4 shrink-0" />
            Live market data is temporarily unavailable. Trading is disabled until PaperX can verify a fresh price.
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <section className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-6">
              <div className="flex min-w-0 items-center gap-4">
                <StockLogo symbol={data.instrument.tradingSymbol} logoUrl={data.instrument.logoUrl} size={56} />
                <div className="min-w-0"><p className="text-sm text-slate-500">{data.instrument.tradingSymbol} · {data.instrument.exchange}</p><h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-white">{data.instrument.name || data.instrument.tradingSymbol}</h1><div className="mt-2 flex flex-wrap items-baseline gap-2"><span className="text-2xl font-semibold text-white">{money(livePrice)}</span><span className={`text-sm ${positive ? "text-emerald-400" : "text-red-400"}`}>{change == null ? "—" : `${positive ? "+" : ""}${change.toFixed(2)} (${positive ? "+" : ""}${(changePercent ?? 0).toFixed(2)}%)`}</span></div></div>
              </div>
              <div className="flex items-center gap-2"><span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${live ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-slate-500"}`}>{live ? <Wifi className="h-3.5 w-3.5"/> : <WifiOff className="h-3.5 w-3.5"/>}{live ? "5s price refresh" : "Price snapshot"}</span><button onClick={() => void toggleWatchlist()} className="paperx-icon-button" aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}>{inWatchlist ? <BookmarkCheck className="h-4 w-4 text-cyan-300"/> : <Bookmark className="h-4 w-4"/>}</button></div>
            </section>

            <section className="py-6" aria-labelledby="price-chart-heading">
              <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="price-chart-heading" className="text-lg font-semibold text-white">Price chart</h2><p className="mt-1 text-xs text-slate-500">Real Upstox OHLCV data · {range}{range === "1D" ? ` · ${intradayInterval} candles` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><MarketSessionTimer/><button onClick={() => setChartType("line")} aria-label="Line chart" className={`paperx-icon-button ${chartType === "line" ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : ""}`}><ChartNoAxesCombined className="h-4 w-4"/></button><button onClick={() => setChartType("candles")} aria-label="Candlestick chart" className={`paperx-icon-button ${chartType === "candles" ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : ""}`}><CandlestickChart className="h-4 w-4"/></button></div></div>
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0b0d10]">{chartLoading ? <div className="flex h-[430px] items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>Loading Upstox candles…</div> : candles.length ? <StockChart ref={chartRef} candles={candles} type={chartType} overlays={learningOverlays}/> : <div className="flex h-[430px] items-center justify-center text-sm text-slate-500">No chart data is available for this range.</div>}</div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 overflow-x-auto" aria-label="Chart range">{RANGES.map((item) => <button key={item} onClick={() => { setChartLoading(true); setRange(item); }} className={`min-w-12 rounded-lg px-3 py-2 text-xs transition-colors ${range === item ? "bg-cyan-400/10 text-cyan-300" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}>{item}</button>)}</div>
                {range === "1D" && <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1" aria-label="Candle interval"><span className="px-2 text-[11px] text-slate-500">Interval</span>{INTRADAY_INTERVALS.map((item) => <button key={item} onClick={() => { setChartLoading(true); setIntradayInterval(item); }} aria-pressed={intradayInterval === item} className={`min-w-9 rounded-md px-2 py-1.5 text-xs transition-colors ${intradayInterval === item ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>{item}</button>)}</div>}
              </div>
            </section>

            <section className="border-t border-white/10 py-8" aria-labelledby="overview-heading">
              <div className="flex items-center justify-between"><div><h2 id="overview-heading" className="text-lg font-semibold text-white">Overview</h2><p className="mt-1 text-sm text-slate-400">Market performance and company fundamentals</p></div><button onClick={() => void refreshDetail()} className="paperx-icon-button" aria-label="Refresh overview"><RefreshCw className="h-4 w-4"/></button></div>
              <div className="mt-6">
                <h3 className="text-base font-semibold text-white">Performance</h3>
                <div className="mt-5 grid gap-7 sm:grid-cols-2"><div><div className="flex justify-between text-sm"><span><span className="block text-xs text-slate-500">Today&apos;s low</span>{money(dayLow)}</span><span className="text-right"><span className="block text-xs text-slate-500">Today&apos;s high</span>{money(dayHigh)}</span></div><MarketPosition low={dayLow} high={dayHigh} value={livePrice}/></div><div><div className="flex justify-between text-sm"><span><span className="block text-xs text-slate-500">52-week low</span>{money(yearLow)}</span><span className="text-right"><span className="block text-xs text-slate-500">52-week high</span>{money(yearHigh)}</span></div><MarketPosition low={yearLow} high={yearHigh} value={livePrice}/></div></div>
                <dl className="mt-8 grid gap-x-6 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-3 lg:grid-cols-5">{[["Open price", money(open)], ["Previous close", money(previousClose)], ["Live volume", number(live?.volume ?? data.quote?.volume)], ["Lower circuit", money(data.quote?.lower_circuit_limit)], ["Upper circuit", money(data.quote?.upper_circuit_limit)]].map(([label,value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-white">{value}</dd></div>)}</dl>
              </div>
              <div className="mt-9 border-t border-white/10 pt-7"><h3 className="text-base font-semibold text-white">Fundamentals</h3><p className="mt-1 text-xs text-slate-500">Current company value with Upstox sector benchmark</p><div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">{["P/E","P/B","ROA","ROE","ROCE","EV/EBITDA"].map((name) => { const ratio=ratios.get(name); return <div key={name} className="flex items-center justify-between border-b border-white/[0.07] py-2.5 text-sm"><span className="text-slate-400">{name}</span><span className="text-right font-medium text-white">{ratio?.company_value ?? "—"}<small className="ml-2 font-normal text-slate-600">Sector {ratio?.sector_value ?? "—"}</small></span></div>; })}</div></div>
            </section>
            <SoujiAssistant
              instrumentKey={instrumentKey}
              symbol={data.instrument.tradingSymbol}
              range={range}
              interval={intradayInterval}
              captureChartFrame={() => chartRef.current?.captureSoujiFrame() ?? null}
              onOverlays={setLearningOverlays}
            />

            <FinancialPerformance quarterly={data.income.quarterly} yearly={data.income.yearly}/>

            <section className="border-t border-white/10 py-8" aria-labelledby="about-heading"><h2 id="about-heading" className="text-lg font-semibold text-white">About {data.instrument.name || data.instrument.tradingSymbol}</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">{data.companyProfile?.company_profile || "A verified company description is not available from Upstox for this instrument."}</p><dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 text-sm"><div><dt className="text-xs text-slate-500">Sector</dt><dd className="mt-1 text-white">{data.companyProfile?.sector || "—"}</dd></div><div><dt className="text-xs text-slate-500">ISIN</dt><dd className="mt-1 text-white">{data.instrument.isin || "—"}</dd></div><div><dt className="text-xs text-slate-500">Segment</dt><dd className="mt-1 text-white">{data.instrument.segment}</dd></div></dl></section>
          </div>
          <OrderTicket data={data} livePrice={livePrice} onComplete={refreshDetail}/>
        </div>
      </main>
    </div>
  );
}
