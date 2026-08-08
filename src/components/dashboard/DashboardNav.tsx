"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, LogIn, RefreshCw, LoaderCircle, X } from "lucide-react";
import { ProfileMenu } from "./ProfileMenu";
import { StockLogo } from "@/components/StockLogo";

export type DashboardTab = "Explore" | "Holdings" | "Positions" | "Orders" | "Watchlist";

const TABS: DashboardTab[] = ["Explore", "Holdings", "Positions", "Orders", "Watchlist"];
const PRODUCT_LINKS = ["Stocks"];

interface DashboardNavProps {
    authenticated: boolean;
    userName?: string | null;
    userEmail?: string | null;
    userImage?: string | null;
    activeTab: DashboardTab;
    onTabChange: (tab: DashboardTab) => void;
    onInstrumentSelect: (instrument: InstrumentSearchResult) => Promise<void>;
}

export interface InstrumentSearchResult {
    instrumentKey: string;
    tradingSymbol: string;
    name: string | null;
    exchange: string;
    segment: string;
    logoUrl: string | null;
}

export function DashboardNav({
    authenticated,
    userName,
    userEmail,
    userImage,
    activeTab,
    onTabChange,
    onInstrumentSelect,
}: DashboardNavProps) {
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<InstrumentSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectingKey, setSelectingKey] = useState<string | null>(null);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen(true);
                inputRef.current?.focus();
            }
        };
        const handleOutsideClick = (event: MouseEvent) => {
            if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
        };
        window.addEventListener("keydown", handleShortcut);
        document.addEventListener("mousedown", handleOutsideClick);
        return () => {
            window.removeEventListener("keydown", handleShortcut);
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, []);

    useEffect(() => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            setResults([]);
            setSearching(false);
            setSearchError(null);
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setSearching(true);
            setSearchError(null);
            try {
                const response = await fetch(
                    `/api/instruments/search?q=${encodeURIComponent(trimmedQuery)}`,
                    { signal: controller.signal }
                );
                const body = await response.json().catch(() => ({})) as {
                    results?: InstrumentSearchResult[];
                    error?: string;
                };
                if (!response.ok) throw new Error(body.error || "Search failed");
                setResults(body.results ?? []);
                setActiveIndex(0);
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setResults([]);
                setSearchError(error instanceof Error ? error.message : "Search failed");
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [query]);

    const selectInstrument = async (instrument: InstrumentSearchResult) => {
        if (selectingKey) return;
        setSelectingKey(instrument.instrumentKey);
        try {
            await onInstrumentSelect(instrument);
            setQuery("");
            setResults([]);
            setOpen(false);
        } finally {
            setSelectingKey(null);
        }
    };

    const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
        } else if (event.key === "ArrowDown" && results.length > 0) {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % results.length);
        } else if (event.key === "ArrowUp" && results.length > 0) {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + results.length) % results.length);
        } else if (event.key === "Enter" && results[activeIndex]) {
            event.preventDefault();
            void selectInstrument(results[activeIndex]);
        }
    };

    return (
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07090b]/90 backdrop-blur-xl">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-cyan-400 focus:px-4 focus:py-2 focus:text-black">
                Skip to dashboard
            </a>
            <div className="mx-auto max-w-7xl px-6">
                {/* Row 1: brand + product links + search + icons */}
                <div className="flex items-center gap-6 py-3">
                    <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none" aria-label="Go to Explore">
                        <div className="relative h-9 w-12 overflow-hidden rounded-md border border-white/10 bg-white/5">
                            <Image src="/PaperXLOGO.png" alt="PaperX" fill sizes="48px" className="object-cover" priority />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">PaperX</span>
                    </Link>

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

                    {/* Public global instrument search */}
                    <div ref={searchRef} className="relative ml-auto w-full max-w-md">
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition-colors focus-within:border-[#00d8ff]/50">
                            {searching ? (
                                <LoaderCircle className="h-4 w-4 flex-shrink-0 animate-spin text-[#00d8ff]" />
                            ) : (
                                <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
                            )}
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setOpen(true);
                                }}
                                onFocus={() => setOpen(true)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Search stocks & indices..."
                                aria-label="Search stocks and indices"
                                role="combobox"
                                aria-autocomplete="list"
                                aria-expanded={open}
                                aria-controls="global-instrument-results"
                                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                            />
                            {query ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery("");
                                        inputRef.current?.focus();
                                    }}
                                    aria-label="Clear search"
                                    className="rounded p-0.5 text-gray-500 hover:text-white"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            ) : (
                                <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-gray-400 sm:inline">
                                    ⌘K
                                </kbd>
                            )}
                        </div>

                        {open && query.trim() && (
                            <div
                                id="global-instrument-results"
                                role="listbox"
                                className="absolute right-0 z-[70] mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0b0d10] py-1 shadow-2xl shadow-black/60"
                            >
                                {searchError && <p className="px-4 py-3 text-sm text-red-400">{searchError}</p>}
                                {!searching && !searchError && results.length === 0 && (
                                    <p className="px-4 py-3 text-sm text-gray-400">No matching stocks or indices</p>
                                )}
                                {results.map((instrument, index) => (
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={index === activeIndex}
                                        key={instrument.instrumentKey}
                                        disabled={selectingKey !== null}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onClick={() => void selectInstrument(instrument)}
                                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-60 ${
                                            index === activeIndex ? "bg-white/[0.07]" : "hover:bg-white/5"
                                        }`}
                                    >
                                        <span className="flex min-w-0 items-center gap-3">
                                            <StockLogo symbol={instrument.tradingSymbol} logoUrl={instrument.logoUrl} size={36} />
                                            <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-white">
                                                {instrument.tradingSymbol}
                                                <span className="ml-2 text-xs font-normal text-gray-500">{instrument.exchange}</span>
                                            </span>
                                            <span className="block truncate text-xs text-gray-500">
                                                {instrument.name || instrument.segment.replace("_", " ")}
                                            </span>
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs text-[#00d8ff]">
                                            {selectingKey === instrument.instrumentKey ? "Opening..." : "Open stock"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="hidden rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white sm:block">
                            <RefreshCw className="h-5 w-5" />
                        </button>
                        {authenticated ? (
                            <>
                                <button className="hidden rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white sm:block">
                                    <Bell className="h-5 w-5" />
                                </button>
                                <ProfileMenu name={userName} email={userEmail} image={userImage} />
                            </>
                        ) : (
                            <Link
                                href="/login?callbackUrl=%2Fdashboard"
                                className="flex min-h-9 items-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-[#06242b] transition-colors hover:bg-cyan-200"
                            >
                                <LogIn className="h-4 w-4" />
                                <span className="hidden sm:inline">Sign in</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Row 2: tabs + terminal/code */}
                <div className="flex items-center justify-between border-t border-white/5">
                    <nav className="flex items-center gap-5 overflow-x-auto sm:gap-6" aria-label="Portfolio sections">
                        {(authenticated ? TABS : TABS.slice(0, 1)).map((tab) => {
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

                </div>
            </div>
        </header>
    );
}
