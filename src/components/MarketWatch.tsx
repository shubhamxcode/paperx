"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Activity, Search, X, ArrowUp, ArrowDown } from "lucide-react";
import { useWatchlist, type WatchInstrument } from "@/lib/useWatchlist";
import { StockLogo } from "@/components/StockLogo";
import { sharedUpstoxMarketFeed } from "@/lib/upstox/market-feed";

interface MarketData {
    instrument_key: string;
    symbol: string;
    exchange: string;
    last_price: number;
    net_change: number;
    volume: number;
    last_traded_time?: string;
}

type Instrument = WatchInstrument;

interface SearchResult {
    instrumentKey: string;
    tradingSymbol: string;
    name: string | null;
    exchange: string;
    segment: string;
    logoUrl: string | null;
}

interface QuotePayload {
    instrument_token?: string;
    instrument_key?: string;
    last_price?: number;
    net_change?: number;
    volume?: number;
    last_traded_time?: string;
}

export function MarketWatch() {
    // Watchlist is fully user-driven (no hardcoded stocks) and shared via hook.
    const {
        list: instruments,
        loading: watchlistLoading,
        error: watchlistError,
        add,
        remove,
        reorder,
        refresh: refreshWatchlist,
    } = useWatchlist();
    const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pollingActive, setPollingActive] = useState(false);

    // Search box state
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Re-fetch REST quotes whenever the watchlist changes
    useEffect(() => {
        if (instruments.length > 0) {
            fetchQuotes(instruments);
        } else {
            setMarketData(new Map());
            setLoading(false);
        }
    }, [instruments]);

    // Subscribe through the shared browser polling manager.
    useEffect(() => {
        if (instruments.length === 0) {
            setPollingActive(false);
            return;
        }
        const cleanups = instruments.map((instrument) =>
            sharedUpstoxMarketFeed.subscribe(instrument.key, "ltpc", (update) => {
                setPollingActive(true);
                setMarketData((previous) => {
                    const next = new Map(previous);
                    const existing = next.get(instrument.key);
                    const lastPrice = update.lastPrice ?? existing?.last_price ?? 0;
                    const closePrice = update.closePrice;
                    next.set(instrument.key, {
                        instrument_key: instrument.key,
                        symbol: instrument.symbol,
                        exchange: instrument.exchange,
                        last_price: lastPrice,
                        net_change: closePrice != null ? lastPrice - closePrice : existing?.net_change ?? 0,
                        volume: update.volume ?? existing?.volume ?? 0,
                        last_traded_time: update.lastTradeTime != null ? String(update.lastTradeTime) : existing?.last_traded_time,
                    });
                    return next;
                });
            })
        );
        return () => cleanups.forEach((cleanup) => cleanup());
    }, [instruments]);

    // Debounced instrument search
    useEffect(() => {
        if (query.trim().length < 1) {
            setResults([]);
            return;
        }
        setSearching(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                setResults(data.results || []);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [query]);

    const fetchQuotes = async (list: Instrument[]) => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            list.forEach((i) => params.append("instrument_key", i.key));

            const response = await fetch(`/api/upstox/market/quotes?${params.toString()}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as {
                    error?: string;
                };
                throw new Error(errorData.error || "Failed to fetch quotes");
            }

            const result = await response.json();
            const dataMap = new Map<string, MarketData>();

            if (result.data) {
                const quotes = Object.values(result.data) as QuotePayload[];
                quotes.forEach((quote) => {
                    const instrument = list.find(
                        (i) => i.key === quote.instrument_token || i.key === quote.instrument_key
                    );
                    if (instrument) {
                        dataMap.set(instrument.key, {
                            instrument_key: instrument.key,
                            symbol: instrument.symbol,
                            exchange: instrument.exchange,
                            last_price: quote.last_price || 0,
                            net_change: quote.net_change || 0,
                            volume: quote.volume || 0,
                            last_traded_time: quote.last_traded_time,
                        });
                    }
                });
            }

            setMarketData(dataMap);
        } catch (err: unknown) {
            console.error("Error fetching quotes:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch market data");
        } finally {
            setLoading(false);
        }
    };


    const addInstrument = async (r: SearchResult) => {
        try {
            await add({ key: r.instrumentKey, symbol: r.tradingSymbol, exchange: r.exchange, logoUrl: r.logoUrl });
            setQuery("");
            setResults([]);
            setShowResults(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to add instrument");
        }
    };

    const removeInstrument = async (key: string) => {
        try {
            await remove(key);
            setMarketData((prev) => {
                const next = new Map(prev);
                next.delete(key);
                return next;
            });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to remove instrument");
        }
    };

    const moveInstrument = async (index: number, direction: -1 | 1) => {
        const destination = index + direction;
        if (destination < 0 || destination >= instruments.length) return;
        const next = [...instruments];
        [next[index], next[destination]] = [next[destination], next[index]];
        try {
            await reorder(next);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to reorder watchlist");
        }
    };

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Watchlist</h2>
                    <p className="text-xs text-gray-500">{instruments.length} {instruments.length === 1 ? "stock" : "stocks"}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${pollingActive
                            ? "bg-green-500/10 border border-green-500/30"
                            : "bg-gray-500/10 border border-gray-500/30"
                            }`}
                    >
                        <Activity className={`w-3 h-3 ${pollingActive ? "text-green-400" : "text-gray-400"}`} />
                        <span className={`text-xs ${pollingActive ? "text-green-400" : "text-gray-400"}`}>
                            {pollingActive ? "5s refresh" : "Unavailable"}
                        </span>
                    </div>
                    <button
                        onClick={() => fetchQuotes(instruments)}
                        className="px-3 py-1.5 text-sm text-[#00d8ff] hover:text-[#00c4e6] border border-[#00d8ff]/30 hover:border-[#00d8ff]/50 rounded-lg transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Search box */}
            <div className="relative mb-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus-within:border-[#00d8ff]/50">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => setShowResults(true)}
                        placeholder="Search stocks to add (e.g. RELIANCE, NIFTY)..."
                        className="bg-transparent text-white text-sm placeholder-gray-500 outline-none w-full"
                    />
                    {query && (
                        <button onClick={() => setQuery("")} className="text-gray-400 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {showResults && query.trim().length > 0 && (
                    <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-xl shadow-xl">
                        {searching && (
                            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
                        )}
                        {!searching && results.length === 0 && (
                            <div className="px-4 py-3 text-sm text-gray-400">No matches found</div>
                        )}
                        {results.map((r) => {
                            const already = instruments.some((i) => i.key === r.instrumentKey);
                            return (
                                <button
                                    key={r.instrumentKey}
                                    onClick={() => addInstrument(r)}
                                    disabled={already}
                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 text-left disabled:opacity-40"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <StockLogo symbol={r.tradingSymbol} logoUrl={r.logoUrl} size={36} />
                                        <div className="min-w-0">
                                        <p className="text-white text-sm font-medium truncate">
                                            {r.tradingSymbol}{" "}
                                            <span className="text-xs text-gray-500">{r.exchange}</span>
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">{r.name}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-[#00d8ff] flex-shrink-0 ml-2">
                                        {already ? "Added" : "+ Add"}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Status / list */}
            {(watchlistError || error) && (
                <div className="flex flex-col items-center justify-center py-10">
                    <div className="text-red-400 mb-3">⚠️ {watchlistError || error}</div>
                    <button
                        onClick={() => {
                            if (watchlistError) void refreshWatchlist();
                            else void fetchQuotes(instruments);
                        }}
                        className="px-4 py-2 bg-[#00d8ff] text-black rounded-lg hover:bg-[#00c4e6] transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {!watchlistError && !error && instruments.length > 0 && (
                <div className="mb-1 flex items-center px-4 text-[11px] uppercase tracking-wider text-gray-500">
                    <span className="flex-1">Company</span>
                    <span className="flex-1 text-right">Market price</span>
                    <span className="flex-1 text-right pr-7">Volume</span>
                </div>
            )}

            {!watchlistError && !error && (
                <div className="space-y-2">
                    {instruments.map((inst, index) => {
                        const data = marketData.get(inst.key);
                        const lastPrice = data?.last_price ?? 0;
                        const netChange = data?.net_change ?? 0;
                        const changePercent =
                            lastPrice > 0 && lastPrice - netChange !== 0
                                ? ((netChange / (lastPrice - netChange)) * 100).toFixed(2)
                                : "0.00";
                        const isPositive = netChange >= 0;

                        return (
                            <div
                                key={inst.key}
                                className="group flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                            >
                                <div className="flex flex-1 min-w-0 items-center gap-3">
                                    <StockLogo symbol={inst.symbol} logoUrl={inst.logoUrl} size={40} />
                                    <div className="min-w-0">
                                    <h3 className="font-semibold text-white truncate">{inst.symbol}</h3>
                                    <p className="text-xs text-gray-400">{inst.exchange}</p>
                                    </div>
                                </div>

                                <div className="flex-1 text-right">
                                    {data ? (
                                        <>
                                            <p className="text-lg font-bold text-white">
                                                ₹{lastPrice.toFixed(2)}
                                            </p>
                                            <div
                                                className={`flex items-center justify-end gap-1 text-sm ${isPositive ? "text-green-400" : "text-red-400"
                                                    }`}
                                            >
                                                {isPositive ? (
                                                    <TrendingUp className="w-3 h-3" />
                                                ) : (
                                                    <TrendingDown className="w-3 h-3" />
                                                )}
                                                <span>
                                                    {isPositive ? "+" : ""}
                                                    {netChange.toFixed(2)} ({changePercent}%)
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500">
                                            {loading ? "Loading..." : "—"}
                                        </p>
                                    )}
                                </div>

                                <div className="flex-1 flex items-center justify-end gap-3">
                                    <div className="text-right">
                                        <p className="text-xs text-gray-400">Volume</p>
                                        <p className="text-sm text-gray-300">
                                            {data ? `${(data.volume / 1000).toFixed(1)}K` : "—"}
                                        </p>
                                    </div>
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => void moveInstrument(index, -1)}
                                            disabled={index === 0}
                                            title="Move up"
                                            aria-label={`Move ${inst.symbol} up`}
                                            className="text-gray-500 hover:text-[#00d8ff] disabled:opacity-20"
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => void moveInstrument(index, 1)}
                                            disabled={index === instruments.length - 1}
                                            title="Move down"
                                            aria-label={`Move ${inst.symbol} down`}
                                            className="text-gray-500 hover:text-[#00d8ff] disabled:opacity-20"
                                        >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => void removeInstrument(inst.key)}
                                        title="Remove"
                                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {instruments.length === 0 && !loading && !watchlistLoading && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#00d8ff]/10">
                                <Search className="h-6 w-6 text-[#00d8ff]" />
                            </div>
                            <p className="font-medium text-white">Your watchlist is empty</p>
                            <p className="mt-1 text-sm text-gray-500">
                                Search any of 20,000+ stocks &amp; indices above to start tracking them.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
