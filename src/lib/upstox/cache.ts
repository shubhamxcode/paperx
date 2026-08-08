import "server-only";
import { createHash } from "node:crypto";
import { getCache } from "@vercel/functions";

type MemoryEntry = { value: unknown; expiresAt: number };

const memory = new Map<string, MemoryEntry>();
const pending = new Map<string, Promise<unknown>>();

export function marketDataCacheKey(scope: string, identity: string) {
  const digest = createHash("sha256").update(identity).digest("base64url");
  return `${scope}:${digest}`;
}

/**
 * Regional read-through cache with an in-process fallback for local development.
 * Provider failures are never cached.
 */
export async function withMarketDataCache<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>
): Promise<T> {
  try {
    const cached = await getCache({ namespace: "paperx-market" }).get(key);
    if (cached !== null && cached !== undefined) return cached as T;
  } catch {}

  const local = memory.get(key);
  if (local && local.expiresAt > Date.now()) return local.value as T;
  if (local) memory.delete(key);

  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const request = load()
    .then(async (value) => {
      try {
        await getCache({ namespace: "paperx-market" }).set(key, value, {
          ttl: ttlSeconds,
          tags: ["upstox-market-data"],
          name: "upstox-market-data",
        });
      } catch {
        memory.set(key, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1_000,
        });
      }
      return value;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}
