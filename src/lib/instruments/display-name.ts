/**
 * Verified display-name overrides for instruments whose exchange master name
 * is an issuer code rather than a customer-facing security name.
 * Keep this list small; Upstox `short_name` remains the primary display source.
 */
const VERIFIED_DISPLAY_NAMES: Record<string, string> = {
  INF277KA1976: "Tata Gold Exchange Traded Fund",
  INF277KA1984: "Tata Silver Exchange Traded Fund",
};

export function instrumentDisplayName(input: {
  isin?: string | null;
  shortName?: string | null;
  name?: string | null;
  tradingSymbol: string;
}) {
  const isin = input.isin?.trim().toUpperCase();
  return (isin && VERIFIED_DISPLAY_NAMES[isin])
    || input.shortName?.trim()
    || input.name?.trim()
    || input.tradingSymbol;
}
