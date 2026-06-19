"use client";

import { useEffect, useState } from "react";
import { Plus, Check, TrendingUp, TrendingDown } from "lucide-react";
import { useWatchlist } from "@/lib/useWatchlist";

// Curated, liquid large-cap NSE stocks. Keys verified against the instrument
// master in the DB. These are recommendations to populate the Explore tab;
// every NSE/BSE stock remains searchable.
const POPULAR: { key: string; symbol: string; name: string }[] = [
    { key: "NSE_EQ|INE002A01018", symbol: "RELIANCE", name: "Reliance Industries" },
    { key: "NSE_EQ|INE467B01029", symbol: "TCS", name: "Tata Consultancy Serv." },
    { key: "NSE_EQ|INE040A01034", symbol: "HDFCBANK", name: "HDFC Bank" },
    { key: "NSE_EQ|INE009A01021", symbol: "INFY", name: "Infosys" },
    { key: "NSE_EQ|INE090A01021", symbol: "ICICIBANK", name: "ICICI Bank" },
    { key: "NSE_EQ|INE062A01020", symbol: "SBIN", name: "State Bank of India" },
    { key: "NSE_EQ|INE154A01025", symbol: "ITC", name: "ITC Ltd" },
    { key: "NSE_EQ|INE397D01024", symbol: "BHARTIARTL", name: "Bharti Airtel" },
    { key: "NSE_EQ|INE018A01030", symbol: "LT", name: "Larsen & Toubro" },
    { key: "NSE_EQ|INE585B01010", symbol: "MARUTI", name: "Maruti Suzuki" },
    { key: "NSE_EQ|INE423A01024", symbol: "ADANIENT", name: "Adani Enterprises" },
    { key: "NSE_EQ|INE280A01028", symbol: "TITAN", name: "Titan Company" },
];

interface Quote {
    last_price: number;
    net_change: number;
}

export function TopStocks() {
    const { add, has } = useWatchlist();
    const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());

    useEffect(() => {
        const fetchQuotes = async () => {
            try {
                const params = new URLSearchParams();
                POPULAR.forEach((s) => params.append("instrument_key", s.key));
                const res = await fetch(`/api/upstox/market/quotes?${params.toString()}`);
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    if (body?.reconnect) window.dispatchEvent(new Event("paperx_upstox_unauthorized"));
                    return;
                }
                const result = await res.json();
                if (!result.data) return;
                const map = new Map<string, Quote>();
                Object.values(result.data as Record<string, {
                    instrument_token?: string;
                    instrument_key?: string;
                    last_price?: number;
                    net_change?: number;
                }>).forEach((q) => {
                    const key = q.instrument_token || q.instrument_key;
                    const match = POPULAR.find((s) => s.key === key);
                    if (match) map.set(match.key, { last_price: q.last_price || 0, net_change: q.net_change || 0 });
                });
                setQuotes(map);
            } catch {
                // ignore; ticker/cards just show placeholders
            }
        };
        fetchQuotes();
        const t = setInterval(fetchQuotes, 20000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Popular stocks</h2>
                <span className="text-xs text-gray-500">Tap + to add to watchlist</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {POPULAR.map((s) => {
                    const q = quotes.get(s.key);
                    const price = q?.last_price ?? 0;
                    const change = q?.net_change ?? 0;
                    const prev = price - change;
                    const pct = prev !== 0 ? ((change / prev) * 100).toFixed(2) : "0.00";
                    const positive = change >= 0;
                    const added = has(s.key);

                    return (
                        <div
                            key={s.key}
                            className="group flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition-colors hover:border-white/20"
                        >
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#00d8ff]/10 text-sm font-bold text-[#00d8ff]">
                                {s.symbol.slice(0, 2)}
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">{s.symbol}</p>
                                <p className="truncate text-xs text-gray-500">{s.name}</p>
                            </div>

                            <div className="text-right">
                                <p className="text-sm font-bold text-white">
                                    {price > 0 ? `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                                </p>
                                {q && (
                                    <div className={`flex items-center justify-end gap-0.5 text-xs ${positive ? "text-green-400" : "text-red-400"}`}>
                                        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        <span>{pct}%</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => add({ key: s.key, symbol: s.symbol, exchange: "NSE" })}
                                disabled={added}
                                title={added ? "In watchlist" : "Add to watchlist"}
                                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                    added
                                        ? "border-green-500/30 text-green-400"
                                        : "border-white/10 text-gray-400 hover:border-[#00d8ff]/40 hover:text-[#00d8ff]"
                                }`}
                            >
                                {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
