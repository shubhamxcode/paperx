import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePortfolioAnalytics,
  calculatePortfolioMarketDataState,
} from "./analytics";

test("calculates current-value allocation and concentration", () => {
  const analytics = calculatePortfolioAnalytics(
    [
      {
        instrumentKey: "NSE_EQ|A",
        investedPaise: 20_000,
        currentPaise: 30_000,
        pnlPaise: 10_000,
      },
      {
        instrumentKey: "NSE_EQ|B",
        investedPaise: 20_000,
        currentPaise: 10_000,
        pnlPaise: -10_000,
      },
    ],
    10_000
  );

  assert.equal(analytics.allocationBasis, "CURRENT_VALUE");
  assert.equal(analytics.allocationByInstrument["NSE_EQ|A"], 75);
  assert.equal(analytics.cashPercent, 20);
  assert.equal(analytics.largestPosition?.instrumentKey, "NSE_EQ|A");
  assert.equal(analytics.topThreeConcentrationPercent, 100);
  assert.equal(analytics.winners, 1);
  assert.equal(analytics.losers, 1);
  assert.equal(analytics.priceCoverage.complete, true);
});

test("uses cost basis when any price is unavailable", () => {
  const analytics = calculatePortfolioAnalytics(
    [
      {
        instrumentKey: "NSE_EQ|A",
        investedPaise: 30_000,
        currentPaise: 45_000,
        pnlPaise: 15_000,
      },
      {
        instrumentKey: "NSE_EQ|B",
        investedPaise: 10_000,
        currentPaise: null,
        pnlPaise: null,
      },
    ],
    10_000
  );

  assert.equal(analytics.allocationBasis, "COST_BASIS");
  assert.equal(analytics.allocationByInstrument["NSE_EQ|A"], 75);
  assert.equal(analytics.priceCoverage.complete, false);
  assert.equal(analytics.priceCoverage.pricedHoldings, 1);
});

test("returns explicit zero-state analytics for an empty portfolio", () => {
  const analytics = calculatePortfolioAnalytics([], 100_000_000);

  assert.equal(analytics.cashPercent, 100);
  assert.equal(analytics.investedPercent, 0);
  assert.equal(analytics.largestPosition, null);
  assert.equal(analytics.priceCoverage.complete, true);
  assert.equal(analytics.priceCoverage.totalHoldings, 0);
});

test("labels empty, partial, and unavailable market-data states accurately", () => {
  assert.deepEqual(
    calculatePortfolioMarketDataState({
      totalHoldings: 0,
      pricedHoldings: 0,
      providerAvailable: true,
    }),
    {
      providerAvailable: true,
      available: true,
      freshness: "NOT_REQUIRED",
      complete: true,
      livePrices: false,
    }
  );
  assert.equal(
    calculatePortfolioMarketDataState({
      totalHoldings: 2,
      pricedHoldings: 1,
      providerAvailable: true,
    }).freshness,
    "PARTIAL"
  );
  assert.equal(
    calculatePortfolioMarketDataState({
      totalHoldings: 2,
      pricedHoldings: 0,
      providerAvailable: false,
    }).freshness,
    "UNAVAILABLE"
  );
});
