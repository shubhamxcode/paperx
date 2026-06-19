"use client";

import { useEffect, useRef, useState } from "react";

// Curated market-header indices (not the user's watchlist). Keys verified
// against the Upstox instrument master mirrored in the DB.
const INDICES: { key: string; label: string }[] = [
    { key: "NSE_INDEX|Nifty 50", label: "NIFTY" },
    { key: "BSE_INDEX|SENSEX", label: "SENSEX" },
    { key: "NSE_INDEX|Nifty Bank", label: "BANKNIFTY" },
    { key: "NSE_INDEX|Nifty Fin Service", label: "FINNIFTY" },
    { key: "NSE_INDEX|Nifty Midcap 50", label: "MIDCPNIFTY" },
    { key: "NSE_INDEX|Nifty Next 50", label: "NIFTYNXT50" },
];

interface IndexQuote {
    last_price: number;
    net_change: number;
}

export function MarketIndices() {
    const [quotes, setQuotes] = useState<Map<string, IndexQuote>>(new Map());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchIndices = async () => {
        try {
            const params = new URLSearchParams();
            INDICES.forEach((i) => params.append("instrument_key", i.key));
            const res = await fetch(`/api/upstox/market/quotes?${params.toString()}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                if (body?.reconnect) window.dispatchEvent(new Event("paperx_upstox_unauthorized"));
                return;
            }
            const result = await res.json();
            if (!result.data) return;

            const map = new Map<string, IndexQuote>();
            Object.values(result.data as Record<string, {
                instrument_token?: string;
                instrument_key?: string;
                last_price?: number;
                net_change?: number;
            }>).forEach((q) => {
                const key = q.instrument_token || q.instrument_key;
                const match = INDICES.find((i) => i.key === key);
                if (match) {
                    map.set(match.key, {
                        last_price: q.last_price || 0,
                        net_change: q.net_change || 0,
                    });
                }
            });
            setQuotes(map);
        } catch {
            // ignore transient failures; next poll retries
        }
    };

    useEffect(() => {
        fetchIndices();
        timerRef.current = setInterval(fetchIndices, 15000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return (
        <div
            className="flex items-center gap-8 overflow-x-auto rounded-2xl border border-white/10 bg-[#0a0a0a] px-6 py-3"
            style={{ fontFamily: "var(--font-space-mono), monospace" }}
        >
            {INDICES.map((idx) => {
                const q = quotes.get(idx.key);
                const price = q?.last_price ?? 0;
                const change = q?.net_change ?? 0;
                const prev = price - change;
                const pct = prev !== 0 ? ((change / prev) * 100).toFixed(2) : "0.00";
                const positive = change >= 0;
                return (
                    <div key={idx.key} className="flex flex-shrink-0 items-baseline gap-2 whitespace-nowrap">
                        <span className="text-xs uppercase tracking-wide text-gray-500">{idx.label}</span>
                        <span className="text-sm font-bold text-white">
                            {price > 0 ? price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                        </span>
                        {q && (
                            <span className={`text-xs ${positive ? "text-green-400" : "text-red-400"}`}>
                                {positive ? "+" : ""}
                                {change.toFixed(2)} ({pct}%)
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
