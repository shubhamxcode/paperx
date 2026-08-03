"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowDownLeft,
    ArrowUpRight,
    BriefcaseBusiness,
    CircleAlert,
    Clock3,
    ExternalLink,
    RefreshCw,
    Wifi,
    WalletCards,
} from "lucide-react";
import type { DashboardTab } from "./DashboardNav";
import { StockLogo } from "@/components/StockLogo";
import { sharedUpstoxMarketFeed } from "@/lib/upstox/market-feed";

interface Holding {
    instrumentKey: string;
    quantity: number;
    avgPricePaise: number;
    tradingSymbol: string;
    name: string | null;
    exchange: string;
    logoUrl: string | null;
    investedPaise: number;
    ltpPaise: number | null;
    currentPaise: number | null;
    pnlPaise: number | null;
    pnlPercent: number | null;
}

interface Portfolio {
    wallet: { balancePaise: number; startingBalancePaise: number };
    holdings: Holding[];
    totals: {
        investedPaise: number;
        currentPaise: number | null;
        pnlPaise: number | null;
        accountValuePaise: number | null;
        netPnlPaise: number | null;
    };
    livePrices: boolean;
}

interface Order {
    id: string;
    instrumentKey: string;
    side: "BUY" | "SELL";
    quantity: number;
    pricePaise: number;
    totalPaise: number;
    status: "FILLED" | "REJECTED";
    reason: string | null;
    createdAt: string;
    tradingSymbol: string;
    name: string | null;
    exchange: string;
    logoUrl: string | null;
}

const money = (paise: number | null) =>
    paise === null
        ? "—"
        : new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              minimumFractionDigits: 2,
          }).format(paise / 100);

function LoadingRows() {
    return (
        <div className="space-y-3" aria-label="Loading data">
            {[0, 1, 2].map((row) => (
                <div key={row} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
        </div>
    );
}

function EmptyState({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400">
                {icon}
            </div>
            <h2 className="text-base font-semibold normal-case tracking-normal text-white">{title}</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
        </div>
    );
}

export function PortfolioTabs({ tab }: { tab: Exclude<DashboardTab, "Explore" | "Watchlist"> }) {
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const endpoint = tab === "Orders" ? "/api/orders?limit=50" : "/api/portfolio";
            const response = await fetch(endpoint);
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || `Unable to load ${tab.toLowerCase()}`);
            if (tab === "Orders") setOrders(body.orders ?? []);
            else setPortfolio(body);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        void load();
    }, [load]);

    const holdingKeys = portfolio?.holdings
        .map((holding) => holding.instrumentKey)
        .sort()
        .join(",") ?? "";

    // Keep every holding valued from the one shared browser-session Upstox
    // socket. REST supplies the initial snapshot; LTPC ticks update it live.
    useEffect(() => {
        if (tab !== "Holdings" || !holdingKeys) return;
        const instrumentKeys = holdingKeys.split(",");
        const cleanups = instrumentKeys.map((instrumentKey) =>
            sharedUpstoxMarketFeed.subscribe(instrumentKey, "ltpc", (update) => {
                if (update.lastPrice == null || !Number.isFinite(update.lastPrice)) return;
                const ltpPaise = Math.round(update.lastPrice * 100);
                setPortfolio((current) => {
                    if (!current) return current;
                    const holdingIndex = current.holdings.findIndex(
                        (holding) => holding.instrumentKey === instrumentKey
                    );
                    if (holdingIndex < 0 || current.holdings[holdingIndex].ltpPaise === ltpPaise) {
                        return current;
                    }

                    const holdings = current.holdings.map((holding, index) => {
                        if (index !== holdingIndex) return holding;
                        const currentPaise = ltpPaise * holding.quantity;
                        const pnlPaise = currentPaise - holding.investedPaise;
                        return {
                            ...holding,
                            ltpPaise,
                            currentPaise,
                            pnlPaise,
                            pnlPercent: holding.investedPaise > 0
                                ? (pnlPaise / holding.investedPaise) * 100
                                : null,
                        };
                    });

                    const livePrices = holdings.every((holding) => holding.currentPaise !== null);
                    const currentPaise = livePrices
                        ? holdings.reduce((sum, holding) => sum + (holding.currentPaise ?? 0), 0)
                        : null;
                    const pnlPaise = currentPaise === null
                        ? null
                        : currentPaise - current.totals.investedPaise;
                    const accountValuePaise = currentPaise === null
                        ? null
                        : current.wallet.balancePaise + currentPaise;

                    return {
                        ...current,
                        holdings,
                        livePrices,
                        totals: {
                            ...current.totals,
                            currentPaise,
                            pnlPaise,
                            accountValuePaise,
                            netPnlPaise: accountValuePaise === null
                                ? null
                                : accountValuePaise - current.wallet.startingBalancePaise,
                        },
                    };
                });
            })
        );
        return () => cleanups.forEach((cleanup) => cleanup());
    }, [holdingKeys, tab]);

    if (loading) {
        return (
            <section className="rounded-2xl border border-white/10 bg-[#0b0d10] p-5 sm:p-6">
                <LoadingRows />
            </section>
        );
    }

    if (error) {
        return (
            <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.04]">
                <EmptyState
                    icon={<CircleAlert className="h-5 w-5 text-red-400" />}
                    title={`Could not load ${tab.toLowerCase()}`}
                    description={error}
                />
                <div className="flex justify-center pb-8">
                    <button onClick={() => void load()} className="paperx-button-secondary">
                        <RefreshCw className="h-4 w-4" /> Retry
                    </button>
                </div>
            </section>
        );
    }

    if (tab === "Positions") {
        return (
            <section className="rounded-2xl border border-white/10 bg-[#0b0d10]">
                <EmptyState
                    icon={<Clock3 className="h-5 w-5" />}
                    title="No open intraday positions"
                    description="PaperX currently settles simulated trades into delivery holdings. Intraday position tracking will appear here when that order type is added."
                />
            </section>
        );
    }

    if (tab === "Orders") {
        return (
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-base font-semibold normal-case tracking-normal text-white">Order history</h2>
                        <p className="mt-1 text-xs text-slate-500">Your latest simulated market orders</p>
                    </div>
                    <button onClick={() => void load()} className="paperx-icon-button" aria-label="Refresh orders">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
                {orders.length === 0 ? (
                    <EmptyState
                        icon={<Clock3 className="h-5 w-5" />}
                        title="No orders yet"
                        description="Place a paper trade from a stock page and every filled or rejected order will be recorded here."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Stock</th>
                                    <th className="px-4 py-3 font-medium">Type</th>
                                    <th className="px-4 py-3 text-right font-medium">Qty.</th>
                                    <th className="px-4 py-3 text-right font-medium">Price</th>
                                    <th className="px-4 py-3 text-right font-medium">Total</th>
                                    <th className="px-6 py-3 text-right font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.07]">
                                {orders.map((order) => (
                                    <tr key={order.id} className="group transition-colors hover:bg-white/[0.025]">
                                        <td className="px-6 py-4">
                                            <Link href={`/stocks/${encodeURIComponent(order.instrumentKey)}`} className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70" aria-label={`Open ${order.name || order.tradingSymbol} chart`}>
                                                <StockLogo symbol={order.tradingSymbol} logoUrl={order.logoUrl} size={36} />
                                                <div className="min-w-0"><p className="flex items-center gap-1.5 font-semibold text-white">{order.tradingSymbol}<ExternalLink className="h-3 w-3 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" /></p>
                                                <p className="mt-0.5 truncate text-xs text-slate-500">{order.name || order.exchange} · {new Date(order.createdAt).toLocaleString("en-IN")}</p></div>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={order.side === "BUY" ? "text-emerald-400" : "text-red-400"}>
                                                {order.side === "BUY" ? <ArrowDownLeft className="mr-1 inline h-4 w-4" /> : <ArrowUpRight className="mr-1 inline h-4 w-4" />}
                                                {order.side}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-300">{order.quantity}</td>
                                        <td className="px-4 py-4 text-right text-slate-300">{money(order.pricePaise)}</td>
                                        <td className="px-4 py-4 text-right font-medium text-white">{money(order.totalPaise)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`rounded-full px-2.5 py-1 text-xs ${order.status === "FILLED" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        );
    }

    const holdings = portfolio?.holdings ?? [];
    const totalPnl = portfolio?.totals.pnlPaise ?? null;

    return (
        <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {[
                    ["Available cash", money(portfolio?.wallet.balancePaise ?? null)],
                    ["Invested", money(portfolio?.totals.investedPaise ?? null)],
                    ["Current value", money(portfolio?.totals.currentPaise ?? null)],
                    ["Portfolio P&L", money(totalPnl)],
                    ["Account value", money(portfolio?.totals.accountValuePaise ?? null)],
                    ["Net P&L", money(portfolio?.totals.netPnlPaise ?? null)],
                ].map(([label, value], index) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-[#0b0d10] p-4">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className={`mt-2 text-lg font-semibold ${index === 3 && totalPnl !== null ? (totalPnl >= 0 ? "text-emerald-400" : "text-red-400") : index === 5 && portfolio?.totals.netPnlPaise != null ? (portfolio.totals.netPnlPaise >= 0 ? "text-emerald-400" : "text-red-400") : "text-white"}`}>
                            {value}
                        </p>
                    </div>
                ))}
            </section>
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-base font-semibold normal-case tracking-normal text-white">Holdings</h2>
                        <p className={`mt-1 flex items-center gap-1.5 text-xs ${portfolio?.livePrices ? "text-emerald-400" : "text-slate-500"}`}>
                            {portfolio?.livePrices && <Wifi className="h-3 w-3" aria-hidden="true" />}
                            {portfolio?.livePrices ? "Live Upstox prices · updates automatically" : "Live prices unavailable; showing cost basis"}
                        </p>
                    </div>
                    <button onClick={() => void load()} className="paperx-icon-button" aria-label="Refresh holdings">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
                {holdings.length === 0 ? (
                    <EmptyState
                        icon={<BriefcaseBusiness className="h-5 w-5" />}
                        title="Your portfolio is ready"
                        description="You have not bought any paper stocks yet. Explore the market and place a simulated buy order to create your first holding."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Company</th>
                                    <th className="px-4 py-3 text-right font-medium">Qty.</th>
                                    <th className="px-4 py-3 text-right font-medium">Avg. price</th>
                                    <th className="px-4 py-3 text-right font-medium">Market price</th>
                                    <th className="px-4 py-3 text-right font-medium">Current value</th>
                                    <th className="px-6 py-3 text-right font-medium">Returns</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.07]">
                                {holdings.map((holding) => (
                                    <tr key={holding.instrumentKey} className="group transition-colors hover:bg-white/[0.025]">
                                        <td className="px-6 py-4">
                                            <Link href={`/stocks/${encodeURIComponent(holding.instrumentKey)}`} className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70" aria-label={`Open ${holding.name || holding.tradingSymbol} chart`}>
                                                <StockLogo symbol={holding.tradingSymbol} logoUrl={holding.logoUrl} size={36} />
                                                <div className="min-w-0"><p className="flex items-center gap-1.5 font-semibold text-white">{holding.tradingSymbol}<ExternalLink className="h-3 w-3 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" /></p>
                                                <p className="mt-0.5 truncate text-xs text-slate-500">{holding.name || holding.exchange}</p></div>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-300">{holding.quantity}</td>
                                        <td className="px-4 py-4 text-right text-slate-300">{money(holding.avgPricePaise)}</td>
                                        <td className="px-4 py-4 text-right text-slate-300">{money(holding.ltpPaise)}</td>
                                        <td className="px-4 py-4 text-right font-medium text-white">{money(holding.currentPaise)}</td>
                                        <td className={`px-6 py-4 text-right font-medium ${holding.pnlPaise === null ? "text-slate-500" : holding.pnlPaise >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                            {money(holding.pnlPaise)}
                                            {holding.pnlPercent !== null && <span className="ml-1 text-xs">({holding.pnlPercent.toFixed(2)}%)</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <WalletCards className="h-4 w-4" />
                Paper money only. Your Upstox funds and holdings are never used.
            </div>
        </div>
    );
}
