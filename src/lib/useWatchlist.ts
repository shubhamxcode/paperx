"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface WatchInstrument {
  key: string;
  symbol: string;
  exchange: string;
}

type WatchlistResponse = {
  watchlist?: { items?: WatchInstrument[] };
  error?: string;
};

type WatchlistItemResponse = {
  item?: WatchInstrument;
  error?: string;
};

async function responseJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>;
}

/**
 * Authenticated, database-backed default watchlist.
 * React state is only a UI cache; PostgreSQL remains the source of truth.
 */
export function useWatchlist() {
  const [list, setList] = useState<WatchInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/watchlists", {
        signal,
        cache: "no-store",
      });
      const body = await responseJson<WatchlistResponse>(response);
      if (!response.ok) throw new Error(body.error || "Failed to load watchlist");
      setList(body.watchlist?.items ?? []);
      setError(null);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Failed to load watchlist");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const add = useCallback(async (item: WatchInstrument) => {
    if (list.some((entry) => entry.key === item.key)) return;
    setList((current) => [...current, item]);

    try {
      const response = await fetch("/api/watchlists/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentKey: item.key }),
      });
      const body = await responseJson<WatchlistItemResponse>(response);
      if (!response.ok || !body.item) {
        throw new Error(body.error || "Failed to add instrument");
      }
      const savedItem = body.item;
      setList((current) =>
        current.map((entry) => (entry.key === item.key ? savedItem : entry))
      );
      setError(null);
    } catch (cause) {
      setList((current) => current.filter((entry) => entry.key !== item.key));
      const message = cause instanceof Error ? cause.message : "Failed to add instrument";
      setError(message);
      throw cause;
    }
  }, [list]);

  const remove = useCallback(async (key: string) => {
    const removedIndex = list.findIndex((entry) => entry.key === key);
    const removed = list[removedIndex];
    if (!removed) return;
    setList((current) => current.filter((entry) => entry.key !== key));

    try {
      const response = await fetch(
        `/api/watchlists/items?instrumentKey=${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      const body = await responseJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error || "Failed to remove instrument");
      setError(null);
    } catch (cause) {
      const rollback = removed;
      setList((current) => {
        if (!rollback || current.some((entry) => entry.key === rollback.key)) return current;
        const next = [...current];
        next.splice(Math.max(0, removedIndex), 0, rollback);
        return next;
      });
      const message = cause instanceof Error ? cause.message : "Failed to remove instrument";
      setError(message);
      throw cause;
    }
  }, [list]);

  const reorder = useCallback(async (nextList: WatchInstrument[]) => {
    if (
      nextList.length !== list.length ||
      nextList.some((item) => !list.some((current) => current.key === item.key))
    ) {
      throw new Error("Reorder must contain the current watchlist items");
    }

    const previous = list;
    setList(nextList);
    try {
      const response = await fetch("/api/watchlists/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentKeys: nextList.map((item) => item.key) }),
      });
      const body = await responseJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error || "Failed to reorder watchlist");
      setError(null);
    } catch (cause) {
      setList(previous);
      const message = cause instanceof Error ? cause.message : "Failed to reorder watchlist";
      setError(message);
      throw cause;
    }
  }, [list]);

  const keys = useMemo(() => new Set(list.map((item) => item.key)), [list]);
  const has = useCallback((key: string) => keys.has(key), [keys]);

  return { list, loading, error, add, remove, reorder, has, refresh };
}
