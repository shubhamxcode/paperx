"use client";

import { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface MarketData {
    instrument_key: string;
    symbol: string;
    last_price: number;
    net_change: number;
    volume: number;
    last_traded_time?: string;
}

// Popular Indian stocks for testing
const DEFAULT_INSTRUMENTS = [
    { key: "NSE_EQ|INE002A01018", symbol: "RELIANCE" },
    { key: "NSE_EQ|INE467B01029", symbol: "TCS" },
    { key: "NSE_EQ|INE040A01034", symbol: "HDFCBANK" },
    { key: "NSE_EQ|INE009A01021", symbol: "INFY" },
    { key: "NSE_EQ|INE030A01027", symbol: "ICICIBANK" },
];

export function MarketWatch() {
    const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Fetch initial quotes
        fetchQuotes();

        // Setup WebSocket for real-time updates
        setupWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const fetchQuotes = async () => {
        try {
            setLoading(true);
            setError(null);

            const instrumentKeys = DEFAULT_INSTRUMENTS.map((i) => i.key);
            const params = new URLSearchParams();
            instrumentKeys.forEach((key) => params.append("instrument_key", key));

            const response = await fetch(`/api/upstox/market/quotes?${params.toString()}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch quotes");
            }

            const result = await response.json();

            // Transform data
            const dataMap = new Map<string, MarketData>();

            // Check if result.data exists and has values
            if (result.data) {
                const quotes = Object.values(result.data) as any[];

                quotes.forEach((quote) => {
                    // Try to find instrument by instrument_token (which matches our key)
                    // or fall back to checking if our key is the response key
                    const instrument = DEFAULT_INSTRUMENTS.find(
                        (i) => i.key === quote.instrument_token || i.key === quote.instrument_key
                    );

                    if (instrument) {
                        dataMap.set(instrument.key, {
                            instrument_key: instrument.key,
                            symbol: instrument.symbol,
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
            // Get WebSocket auth URL
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
                setWsConnected(true);

                // Subscribe to instruments
                const subscribeMessage = {
                    guid: "someguid",
                    method: "sub",
                    data: {
                        mode: "ltpc",
                        instrumentKeys: DEFAULT_INSTRUMENTS.map((i) => i.key),
                    },
                };

                ws.send(JSON.stringify(subscribeMessage));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    // Update market data from WebSocket feed
                    if (message.type === "feed" && message.feeds) {
                        setMarketData((prev) => {
                            const newMap = new Map(prev);

                            Object.entries(message.feeds).forEach(([key, feed]: [string, any]) => {
                                const existing = newMap.get(key);
                                const instrument = DEFAULT_INSTRUMENTS.find((i) => i.key === key);

                                if (instrument && feed.ff?.marketFF?.ltpc) {
                                    const ltpc = feed.ff.marketFF.ltpc;
                                    newMap.set(key, {
                                        instrument_key: key,
                                        symbol: instrument.symbol,
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

    if (loading) {
        return (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-[#00d8ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-400">Loading market data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-red-400 mb-4">⚠️ Error</div>
                    <p className="text-gray-400 text-center mb-4">{error}</p>
                    <button
                        onClick={fetchQuotes}
                        className="px-4 py-2 bg-[#00d8ff] text-black rounded-lg hover:bg-[#00c4e6] transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Market Watch</h2>
                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${wsConnected
                        ? "bg-green-500/10 border border-green-500/30"
                        : "bg-gray-500/10 border border-gray-500/30"
                        }`}>
                        <Activity className={`w-3 h-3 ${wsConnected ? "text-green-400" : "text-gray-400"}`} />
                        <span className={`text-xs ${wsConnected ? "text-green-400" : "text-gray-400"}`}>
                            {wsConnected ? "Live" : "Offline"}
                        </span>
                    </div>
                    <button
                        onClick={fetchQuotes}
                        className="px-3 py-1.5 text-sm text-[#00d8ff] hover:text-[#00c4e6] border border-[#00d8ff]/30 hover:border-[#00d8ff]/50 rounded-lg transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {Array.from(marketData.values()).map((data) => {
                    const changePercent = data.last_price > 0
                        ? ((data.net_change / (data.last_price - data.net_change)) * 100).toFixed(2)
                        : "0.00";
                    const isPositive = data.net_change >= 0;

                    return (
                        <div
                            key={data.instrument_key}
                            className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                        >
                            <div className="flex-1">
                                <h3 className="font-semibold text-white">{data.symbol}</h3>
                                <p className="text-xs text-gray-400">NSE</p>
                            </div>

                            <div className="flex-1 text-right">
                                <p className="text-lg font-bold text-white">
                                    ₹{data.last_price.toFixed(2)}
                                </p>
                                <div className={`flex items-center justify-end gap-1 text-sm ${isPositive ? "text-green-400" : "text-red-400"
                                    }`}>
                                    {isPositive ? (
                                        <TrendingUp className="w-3 h-3" />
                                    ) : (
                                        <TrendingDown className="w-3 h-3" />
                                    )}
                                    <span>
                                        {isPositive ? "+" : ""}{data.net_change.toFixed(2)} ({changePercent}%)
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 text-right">
                                <p className="text-xs text-gray-400">Volume</p>
                                <p className="text-sm text-gray-300">
                                    {(data.volume / 1000).toFixed(1)}K
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {marketData.size === 0 && (
                <div className="text-center py-12 text-gray-400">
                    No market data available
                </div>
            )}
        </div>
    );
}
