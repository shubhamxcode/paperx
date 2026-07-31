"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Check, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useWatchlist } from "@/lib/useWatchlist";

const STOCKS = [
    { key: "NSE_EQ|INE002A01018", symbol: "RELIANCE", name: "Reliance Industries" },
    { key: "NSE_EQ|INE467B01029", symbol: "TCS", name: "Tata Consultancy Services" },
    { key: "NSE_EQ|INE040A01034", symbol: "HDFCBANK", name: "HDFC Bank" },
    { key: "NSE_EQ|INE009A01021", symbol: "INFY", name: "Infosys" },
    { key: "NSE_EQ|INE090A01021", symbol: "ICICIBANK", name: "ICICI Bank" },
    { key: "NSE_EQ|INE062A01020", symbol: "SBIN", name: "State Bank of India" },
    { key: "NSE_EQ|INE154A01025", symbol: "ITC", name: "ITC" },
    { key: "NSE_EQ|INE397D01024", symbol: "BHARTIARTL", name: "Bharti Airtel" },
    { key: "NSE_EQ|INE018A01030", symbol: "LT", name: "Larsen & Toubro" },
    { key: "NSE_EQ|INE585B01010", symbol: "MARUTI", name: "Maruti Suzuki" },
    { key: "NSE_EQ|INE423A01024", symbol: "ADANIENT", name: "Adani Enterprises" },
    { key: "NSE_EQ|INE280A01028", symbol: "TITAN", name: "Titan Company" },
];

interface Quote {
    lastPrice: number;
    netChange: number;
    volume: number;
}

type MoverFilter = "Gainers" | "Losers" | "Most active";

const formatPrice = (value: number) =>
    value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const percentChange = (quote?: Quote) => {
    if (!quote) return 0;
    const previousClose = quote.lastPrice - quote.netChange;
    return previousClose ? (quote.netChange / previousClose) * 100 : 0;
};

function StockLogo({ symbol }: { symbol: string }) {
    return (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.07] text-xs font-bold tracking-wide text-cyan-300">
            {symbol.slice(0, 2)}
        </div>
    );
}

export function TopStocks() {
    const { add, has } = useWatchlist();
    const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
    const [filter, setFilter] = useState<MoverFilter>("Gainers");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuotes = async () => {
            try {
                const params = new URLSearchParams();
                STOCKS.forEach((stock) => params.append("instrument_key", stock.key));
                const response = await fetch(`/api/upstox/market/quotes?${params.toString()}`);
                if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    if (body?.reconnect) window.dispatchEvent(new Event("paperx_upstox_unauthorized"));
                    return;
                }
                const result = await response.json();
                const next = new Map<string, Quote>();
                Object.values(result.data ?? {}).forEach((raw) => {
                    const quote = raw as {
                        instrument_token?: string;
                        instrument_key?: string;
                        last_price?: number;
                        net_change?: number;
                        volume?: number;
                    };
                    const key = quote.instrument_token || quote.instrument_key;
                    if (key && STOCKS.some((stock) => stock.key === key)) {
                        next.set(key, {
                            lastPrice: quote.last_price ?? 0,
                            netChange: quote.net_change ?? 0,
                            volume: quote.volume ?? 0,
                        });
                    }
                });
                setQuotes(next);
            } finally {
                setLoading(false);
            }
        };

        void fetchQuotes();
        const timer = window.setInterval(fetchQuotes, 20_000);
        return () => window.clearInterval(timer);
    }, []);

    const ranked = useMemo(() => {
        const rows = STOCKS.map((stock) => ({ ...stock, quote: quotes.get(stock.key) }));
        if (filter === "Most active") {
            return rows.sort((a, b) => (b.quote?.volume ?? 0) - (a.quote?.volume ?? 0)).slice(0, 6);
        }
        return rows
            .sort((a, b) =>
                filter === "Gainers"
                    ? percentChange(b.quote) - percentChange(a.quote)
                    : percentChange(a.quote) - percentChange(b.quote)
            )
            .slice(0, 6);
    }, [filter, quotes]);

    const mostTraded = useMemo(
        () =>
            STOCKS.map((stock) => ({ ...stock, quote: quotes.get(stock.key) }))
                .sort((a, b) => (b.quote?.volume ?? 0) - (a.quote?.volume ?? 0))
                .slice(0, 4),
        [quotes]
    );

    return (
        <div className="space-y-8">
            <section aria-labelledby="most-traded-heading">
                <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-cyan-400">Market pulse</p>
                        <h1 id="most-traded-heading" className="text-xl font-semibold normal-case tracking-tight text-white sm:text-2xl">
                            Most traded stocks
                        </h1>
                    </div>
                    <p className="hidden text-xs text-slate-500 sm:block">Ranked by today&apos;s Upstox volume</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {mostTraded.map((stock) => {
                        const change = percentChange(stock.quote);
                        const positive = change >= 0;
                        return (
                            <article key={stock.key} className="group rounded-2xl border border-white/10 bg-[#0b0d10] p-4 transition-colors hover:border-white/20">
                                <div className="flex items-start justify-between gap-3">
                                    <StockLogo symbol={stock.symbol} />
                                    <button
                                        onClick={() => void add({ key: stock.key, symbol: stock.symbol, exchange: "NSE" }).catch(() => undefined)}
                                        disabled={has(stock.key)}
                                        className="paperx-icon-button"
                                        aria-label={has(stock.key) ? `${stock.symbol} is in watchlist` : `Add ${stock.symbol} to watchlist`}
                                    >
                                        {has(stock.key) ? <Check className="h-4 w-4 text-emerald-400" /> : <Plus className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="mt-5 truncate text-sm font-semibold text-white">{stock.name}</p>
                                <p className="mt-3 text-lg font-semibold text-white">
                                    {stock.quote?.lastPrice ? `₹${formatPrice(stock.quote.lastPrice)}` : loading ? "Loading…" : "—"}
                                </p>
                                {stock.quote && (
                                    <p className={`mt-1 flex items-center gap-1 text-sm ${positive ? "text-emerald-400" : "text-red-400"}`}>
                                        {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                        {positive ? "+" : ""}{change.toFixed(2)}%
                                    </p>
                                )}
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10]" aria-labelledby="movers-heading">
                <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <h2 id="movers-heading" className="text-lg font-semibold normal-case tracking-tight text-white">Top movers today</h2>
                        <p className="mt-1 text-xs text-slate-500">Live movement from a curated set of liquid NSE stocks</p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter top movers">
                        {(["Gainers", "Losers", "Most active"] as MoverFilter[]).map((item) => (
                            <button
                                key={item}
                                onClick={() => setFilter(item)}
                                aria-pressed={filter === item}
                                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                                    filter === item
                                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                                        : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                                }`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/[0.07] px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500 sm:grid-cols-[1fr_170px_130px] sm:px-6">
                    <span>Company</span>
                    <span className="text-right">Market price</span>
                    <span className="hidden text-right sm:block">{filter === "Most active" ? "Volume" : "Change"}</span>
                </div>
                <div className="divide-y divide-white/[0.07]">
                    {ranked.map((stock) => {
                        const change = percentChange(stock.quote);
                        const positive = change >= 0;
                        return (
                            <div key={stock.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.025] sm:grid-cols-[1fr_170px_130px] sm:px-6">
                                <div className="flex min-w-0 items-center gap-3">
                                    <StockLogo symbol={stock.symbol} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-white">{stock.symbol}</p>
                                        <p className="truncate text-xs text-slate-500">{stock.name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-white">{stock.quote?.lastPrice ? `₹${formatPrice(stock.quote.lastPrice)}` : "—"}</p>
                                    <p className={`mt-1 text-xs sm:hidden ${positive ? "text-emerald-400" : "text-red-400"}`}>
                                        {positive ? "+" : ""}{change.toFixed(2)}%
                                    </p>
                                </div>
                                <div className={`hidden text-right text-sm sm:block ${positive ? "text-emerald-400" : "text-red-400"}`}>
                                    {filter === "Most active"
                                        ? new Intl.NumberFormat("en-IN", { notation: "compact" }).format(stock.quote?.volume ?? 0)
                                        : `${positive ? "+" : ""}${change.toFixed(2)}%`}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3 text-xs text-slate-500 sm:px-6">
                    <Activity className="h-3.5 w-3.5 text-cyan-400" />
                    Prices refresh every 20 seconds; your watchlist uses the live Upstox feed.
                </div>
            </section>
        </div>
    );
}
