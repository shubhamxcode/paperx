export type PortfolioAnalyticsHolding = {
  instrumentKey: string;
  investedPaise: number;
  currentPaise: number | null;
  pnlPaise: number | null;
};

const percent = (part: number, whole: number) =>
  whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0;

export function calculatePortfolioAnalytics(
  holdings: PortfolioAnalyticsHolding[],
  cashPaise: number
) {
  const pricedHoldings = holdings.filter(
    (holding) => holding.currentPaise !== null
  ).length;
  const completePrices = pricedHoldings === holdings.length;
  const allocationBasis = completePrices ? "CURRENT_VALUE" : "COST_BASIS";
  const holdingValues = holdings.map((holding) => ({
    instrumentKey: holding.instrumentKey,
    valuePaise:
      allocationBasis === "CURRENT_VALUE"
        ? holding.currentPaise ?? 0
        : holding.investedPaise,
  }));
  const holdingsValuePaise = holdingValues.reduce(
    (sum, holding) => sum + holding.valuePaise,
    0
  );
  const accountBasisPaise = cashPaise + holdingsValuePaise;
  const allocationByInstrument = Object.fromEntries(
    holdingValues.map((holding) => [
      holding.instrumentKey,
      percent(holding.valuePaise, holdingsValuePaise),
    ])
  );
  const ranked = [...holdingValues].sort(
    (left, right) => right.valuePaise - left.valuePaise
  );
  const largest = ranked[0] ?? null;
  const topThreeValuePaise = ranked
    .slice(0, 3)
    .reduce((sum, holding) => sum + holding.valuePaise, 0);
  const priced = holdings.filter((holding) => holding.pnlPaise !== null);

  return {
    allocationBasis,
    allocationByInstrument,
    cashPercent: percent(cashPaise, accountBasisPaise),
    investedPercent: percent(holdingsValuePaise, accountBasisPaise),
    largestPosition: largest
      ? {
          instrumentKey: largest.instrumentKey,
          percent: percent(largest.valuePaise, holdingsValuePaise),
        }
      : null,
    topThreeConcentrationPercent: percent(
      topThreeValuePaise,
      holdingsValuePaise
    ),
    winners: priced.filter((holding) => (holding.pnlPaise ?? 0) > 0).length,
    losers: priced.filter((holding) => (holding.pnlPaise ?? 0) < 0).length,
    unchanged: priced.filter((holding) => holding.pnlPaise === 0).length,
    priceCoverage: {
      pricedHoldings,
      totalHoldings: holdings.length,
      complete: completePrices,
    },
  } as const;
}
