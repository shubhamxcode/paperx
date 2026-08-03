import "server-only";

import { serverEnv } from "@/lib/env/server";

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** Build the Brandfetch CDN URL for one equity ISIN. */
export function brandfetchLogoUrl(isin: string | null | undefined): string | null {
  const normalized = isin?.trim().toUpperCase();
  if (!normalized || !ISIN_PATTERN.test(normalized)) return null;

  const url = new URL(`/isin/${encodeURIComponent(normalized)}`, serverEnv.brandfetchLogoBaseUrl);
  url.searchParams.set("c", serverEnv.brandfetchClientId);
  return url.toString();
}
