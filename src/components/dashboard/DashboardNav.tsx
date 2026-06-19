"use client";

import { ReactNode } from "react";
import { TrendingUp, Search, Bell, RefreshCw, CandlestickChart } from "lucide-react";

export type DashboardTab = "Explore" | "Holdings" | "Positions" | "Orders" | "Watchlist";

const TABS: DashboardTab[] = ["Explore", "Holdings", "Positions", "Orders", "Watchlist"];
const PRODUCT_LINKS = ["Stocks"];

interface DashboardNavProps {
    userName?: string | null;
    userImage?: string | null;
    activeTab: DashboardTab;
    onTabChange: (tab: DashboardTab) => void;
    onProfileClick: () => void;
    onSearchClick: () => void;
    upstoxSlot?: ReactNode;
}

export function DashboardNav({
    userName,
    userImage,
    activeTab,
    onTabChange,
    onProfileClick,
    onSearchClick,
    upstoxSlot,
}: DashboardNavProps) {
    const initials = (userName || "U")
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-6">
                {/* Row 1: brand + product links + search + icons */}
                <div className="flex items-center gap-6 py-3">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                            <TrendingUp className="h-5 w-5 text-[#00d8ff]" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">PaperX</span>
                    </div>

                    <nav className="hidden items-center gap-6 md:flex">
                        {PRODUCT_LINKS.map((link, i) => (
                            <button
                                key={link}
                                className={`text-sm font-medium transition-colors ${
                                    i === 0 ? "text-white" : "text-gray-400 hover:text-white"
                                }`}
                            >
                                {link}
                            </button>
                        ))}
                    </nav>

                    {/* Search bar (Groww-style) */}
                    <button
                        onClick={onSearchClick}
                        className="group ml-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-left transition-colors hover:border-[#00d8ff]/40"
                    >
                        <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="flex-1 text-sm text-gray-500">Search stocks &amp; indices...</span>
                        <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-gray-400 sm:inline">
                            ⌘K
                        </kbd>
                    </button>

                    <div className="flex items-center gap-2">
                        <button className="hidden rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white sm:block">
                            <RefreshCw className="h-5 w-5" />
                        </button>
                        <button className="hidden rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white sm:block">
                            <Bell className="h-5 w-5" />
                        </button>
                        <button
                            onClick={onProfileClick}
                            title={userName || "Profile"}
                            className="h-9 w-9 overflow-hidden rounded-full border border-white/15 bg-white/5 transition-transform hover:scale-105"
                        >
                            {userImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={userImage} alt={userName || "Profile"} className="h-full w-full object-cover" />
                            ) : (
                                <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                                    {initials}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Row 2: tabs + terminal/code */}
                <div className="flex items-center justify-between border-t border-white/5">
                    <nav className="flex items-center gap-6 overflow-x-auto">
                        {TABS.map((tab) => {
                            const active = tab === activeTab;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => onTabChange(tab)}
                                    className={`relative whitespace-nowrap py-3 text-sm transition-colors ${
                                        active ? "font-semibold text-white" : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    {tab}
                                    {active && (
                                        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#00d8ff]" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-2 py-2">
                        {upstoxSlot}
                        <button className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-white/20 md:flex">
                            <CandlestickChart className="h-4 w-4" />
                            Terminal
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
