"use client";

import { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Activity, Search, X } from "lucide-react";

interface MarketData {
    instrument_key: string;
    symbol: string;
    exchange: string;
    last_price: number;
    net_change: number;
    volume: number;
    last_traded_time?: string;
}

interface Instrument {
    key: string;
    symbol: string;
    exchange: string;
}

interface SearchResult {
    instrumentKey: string;
    tradingSymbol: string;
    name: string | null;
    exchange: string;
    segment: string;
}

// Starting watchlist (used until the user customises it). Stored per-browser.
const DEFAULT_INSTRUMENTS: Instrument[] = [
    { key: "NSE_EQ|INE002A01018", symbol: "RELIANCE", exchange: "NSE" },
    { key: "NSE_EQ|INE467B01029", symbol: "TCS", exchange: "NSE" },
    { key: "NSE_EQ|INE040A01034", symbol: "HDFCBANK", exchange: "NSE" },
    { key: "NSE_EQ|INE009A01021", symbol: "INFY", exchange: "NSE" },
    { key: "NSE_EQ|INE030A01027", symbol: "ICICIBANK", exchange: "NSE" },
];

const STORAGE_KEY = "paperx_watchlist";

export function MarketWatch() {
    const [instruments, setInstruments] = useState<Instrument[]>(DEFAULT_INSTRUMENTS);
    const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [wsConnected, setWsConnected] = useState(false);

    // Search box state
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const instrumentsRef = useRef<Instrument[]>(instruments);
    const subscribedRef = useRef<Set<string>>(new Set());
    instrumentsRef.current = instruments;

    // Load saved watchlist once on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) setInstruments(parsed);
            }
        } catch {
            // ignore corrupt storage
        }
    }, []);

    // Persist watchlist whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(instruments));
        } catch {
            // ignore
        }
    }, [instruments]);

    // Re-fetch REST quotes whenever the watchlist changes
    useEffect(() => {
        if (instruments.length > 0) {
            fetchQuotes(instruments);
        } else {
            setMarketData(new Map());
            setLoading(false);
        }
    }, [instruments]);

    // Open the WebSocket once
    useEffect(() => {
        setupWebSocket();
        return () => {
            wsRef.current?.close();
        };
    }, []);

    // Keep WebSocket subscriptions in sync with the watchlist
    useEffect(() => {
        syncSubscriptions();
    }, [instruments, wsConnected]);

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
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch quotes");
            }

            const result = await response.json();
            const dataMap = new Map<string, MarketData>();

            if (result.data) {
                const quotes = Object.values(result.data) as any[];
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
        } catch (err: any) {
            console.error("Error fetching quotes:", err);
            setError(err.message || "Failed to fetch market data");
        } finally {
            setLoading(false);
        }
    };

    const setupWebSocket = async () => {
        try {
            const response = await fetch("/api/upstox/websocket/auth");
            const data = await response.json();

            if (!data.data?.authorizedRedirectUri) {
                console.error("No WebSocket URL received");
                return;
            }

            const ws = new WebSocket(data.data.authorizedRedirectUri);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WebSocket connected");
                subscribedRef.current.clear(); // fresh connection, nothing subscribed yet
                setWsConnected(true); // triggers syncSubscriptions effect
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === "feed" && message.feeds) {
                        setMarketData((prev) => {
                            const newMap = new Map(prev);
                            Object.entries(message.feeds).forEach(([key, feed]: [string, any]) => {
                                const existing = newMap.get(key);
                                const instrument = instrumentsRef.current.find((i) => i.key === key);
                                if (instrument && feed.ff?.marketFF?.ltpc) {
                                    const ltpc = feed.ff.marketFF.ltpc;
                                    newMap.set(key, {
                                        instrument_key: key,
                                        symbol: instrument.symbol,
                                        exchange: instrument.exchange,
                                        last_price: ltpc.ltp || existing?.last_price || 0,
                                        net_change: existing?.net_change || 0,
                                        volume: ltpc.ltq || existing?.volume || 0,
                                        last_traded_time: ltpc.ltt,
                                    });
                                }
                            });
                            return newMap;
                        });
                    }
                } catch (err) {
                    console.error("Error parsing WebSocket message:", err);
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setWsConnected(false);
            };

            ws.onclose = () => {
                console.log("WebSocket disconnected");
                setWsConnected(false);
            };
        } catch (err) {
            console.error("Error setting up WebSocket:", err);
        }
    };

    // Diff the watchlist against current subscriptions and sub/unsub the delta
    const syncSubscriptions = () => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const desired = new Set(instrumentsRef.current.map((i) => i.key));
        const subbed = subscribedRef.current;
        const toSub = [...desired].filter((k) => !subbed.has(k));
        const toUnsub = [...subbed].filter((k) => !desired.has(k));

        if (toSub.length > 0) {
            ws.send(
                JSON.stringify({
                    guid: `sub-${Date.now()}`,
                    method: "sub",
                    data: { mode: "ltpc", instrumentKeys: toSub },
                })
            );
            toSub.forEach((k) => subbed.add(k));
        }
        if (toUnsub.length > 0) {
            ws.send(
                JSON.stringify({
                    guid: `unsub-${Date.now()}`,
                    method: "unsub",
                    data: { mode: "ltpc", instrumentKeys: toUnsub },
                })
            );
            toUnsub.forEach((k) => subbed.delete(k));
        }
    };

    const addInstrument = (r: SearchResult) => {
        setInstruments((prev) =>
            prev.some((i) => i.key === r.instrumentKey)
                ? prev
                : [...prev, { key: r.instrumentKey, symbol: r.tradingSymbol, exchange: r.exchange }]
        );
        setQuery("");
        setResults([]);
        setShowResults(false);
    };

    const removeInstrument = (key: string) => {
        setInstruments((prev) => prev.filter((i) => i.key !== key));
        setMarketData((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
        });
    };

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Market Watch</h2>
                <div className="flex items-center gap-2">
                    <div
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${wsConnected
                            ? "bg-green-500/10 border border-green-500/30"
                            : "bg-gray-500/10 border border-gray-500/30"
                            }`}
                    >
                        <Activity className={`w-3 h-3 ${wsConnected ? "text-green-400" : "text-gray-400"}`} />
                        <span className={`text-xs ${wsConnected ? "text-green-400" : "text-gray-400"}`}>
                            {wsConnected ? "Live" : "Offline"}
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
                                    <div className="min-w-0">
                                        <p className="text-white text-sm font-medium truncate">
                                            {r.tradingSymbol}{" "}
                                            <span className="text-xs text-gray-500">{r.exchange}</span>
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">{r.name}</p>
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
            {error && (
                <div className="flex flex-col items-center justify-center py-10">
                    <div className="text-red-400 mb-3">⚠️ {error}</div>
                    <button
                        onClick={() => fetchQuotes(instruments)}
                        className="px-4 py-2 bg-[#00d8ff] text-black rounded-lg hover:bg-[#00c4e6] transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {!error && (
                <div className="space-y-2">
                    {instruments.map((inst) => {
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
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white truncate">{inst.symbol}</h3>
                                    <p className="text-xs text-gray-400">{inst.exchange}</p>
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
                                    <button
                                        onClick={() => removeInstrument(inst.key)}
                                        title="Remove"
                                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {instruments.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            Your watchlist is empty. Search above to add stocks.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
