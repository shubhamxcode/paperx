"use client";

import { useCallback, useEffect, useState } from "react";

export interface WatchInstrument {
    key: string;
    symbol: string;
    exchange: string;
}

const STORAGE_KEY = "paperx_watchlist";
const EVENT = "paperx_watchlist_changed";

function read(): WatchInstrument[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch {
        // ignore corrupt storage
    }
    return [];
}

/**
 * Shared, localStorage-backed watchlist. Any component using this hook stays in
 * sync via a custom window event, so adding a stock from the "Popular stocks"
 * cards instantly updates the Watchlist panel (and across tabs via "storage").
 */
export function useWatchlist() {
    const [list, setList] = useState<WatchInstrument[]>([]);

    useEffect(() => {
        setList(read());
        const handler = () => setList(read());
        window.addEventListener(EVENT, handler);
        window.addEventListener("storage", handler);
        return () => {
            window.removeEventListener(EVENT, handler);
            window.removeEventListener("storage", handler);
        };
    }, []);

    const persist = useCallback((next: WatchInstrument[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore
        }
        setList(next);
        window.dispatchEvent(new Event(EVENT));
    }, []);

    const add = useCallback(
        (item: WatchInstrument) => {
            const cur = read();
            if (cur.some((x) => x.key === item.key)) return;
            persist([...cur, item]);
        },
        [persist]
    );

    const remove = useCallback(
        (key: string) => {
            persist(read().filter((x) => x.key !== key));
        },
        [persist]
    );

    const has = useCallback((key: string) => list.some((x) => x.key === key), [list]);

    return { list, add, remove, has };
}
