"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { UpstoxConnect } from "@/components/UpstoxConnect";
import { MarketWatch } from "@/components/MarketWatch";
import { MarketIndices } from "@/components/MarketIndices";
import {
    DashboardNav,
    type DashboardTab,
    type InstrumentSearchResult,
} from "@/components/dashboard/DashboardNav";
import { TopStocks } from "@/components/dashboard/TopStocks";
import { PortfolioTabs } from "@/components/dashboard/PortfolioTabs";
import toast, { Toaster } from "react-hot-toast";

function DashboardContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showMarketWatch, setShowMarketWatch] = useState(false);
    const [upstoxExpired, setUpstoxExpired] = useState(false);
    const [activeTab, setActiveTab] = useState<DashboardTab>("Explore");

    const openGlobalSearchResult = useCallback(async (instrument: InstrumentSearchResult) => {
        router.push(`/stocks/${encodeURIComponent(instrument.instrumentKey)}`);
    }, [router]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    // Check Upstox connection status from backend (also called when a data
    // request returns 401, so the UI flips to "reconnect" mid-session).
    const checkStatus = useCallback(async () => {
        try {
            const response = await fetch("/api/upstox/status");
            const data = await response.json();
            setUpstoxExpired(!!data.expired);
            setShowMarketWatch(!!data.connected);
        } catch (error) {
            console.error("Error checking Upstox status:", error);
        }
    }, []);

    // Re-check status whenever a data request reports the token is unauthorized.
    useEffect(() => {
        const handler = () => checkStatus();
        window.addEventListener("paperx_upstox_unauthorized", handler);
        return () => window.removeEventListener("paperx_upstox_unauthorized", handler);
    }, [checkStatus]);

    useEffect(() => {
        const initialStatusCheck = window.setTimeout(() => void checkStatus(), 0);

        // Check for Upstox connection status from URL params
        const upstoxConnected = searchParams.get("upstox_connected");
        const upstoxError = searchParams.get("upstox_error");

        if (upstoxConnected === "true") {
            toast.success("Upstox connected successfully!");
            window.setTimeout(() => setShowMarketWatch(true), 0);
            // Clean URL
            window.history.replaceState({}, "", "/dashboard");
        }

        if (upstoxError) {
            toast.error(`Upstox connection failed: ${upstoxError}`);
            // Clean URL
            window.history.replaceState({}, "", "/dashboard");
        }
        return () => window.clearTimeout(initialStatusCheck);
    }, [checkStatus, searchParams]);

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-[#00d8ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="paperx-dashboard min-h-screen bg-[#07090b] text-slate-100">
            <Toaster position="top-right" />

            {/* Header */}
            <DashboardNav
                userName={session?.user?.name}
                userEmail={session?.user?.email}
                userImage={session?.user?.image}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onInstrumentSelect={openGlobalSearchResult}
                upstoxSlot={<UpstoxConnect />}
            />

            {/* Main Content */}
            <main id="main-content" className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
                {/* Connection Instructions */}
                {!showMarketWatch && (
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-8">
                        <div className="text-center max-w-2xl mx-auto">
                            <div className="w-16 h-16 bg-[#00d8ff]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <TrendingUp className="w-8 h-8 text-[#00d8ff]" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">
                                {upstoxExpired ? "Reconnect Your Upstox Account" : "Connect Your Upstox Account"}
                            </h2>
                            <p className="text-gray-400 mb-6">
                                {upstoxExpired
                                    ? "Your Upstox session has expired. Upstox requires a fresh login every day (sessions reset at 3:30 AM IST), so reconnect to resume live market data."
                                    : "To start paper trading with real-time market data, connect your Upstox account. This will allow you to access live market prices during trading hours (9:15 AM - 3:30 PM)."}
                            </p>
                            <div className="flex flex-col gap-3 text-left bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[#00d8ff]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-[#00d8ff] text-sm font-bold">1</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Click &ldquo;Connect Upstox&rdquo; above</p>
                                        <p className="text-sm text-gray-400">You&apos;ll be redirected to the Upstox login page</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[#00d8ff]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-[#00d8ff] text-sm font-bold">2</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Login with your Upstox credentials</p>
                                        <p className="text-sm text-gray-400">Your credentials are secure and handled by Upstox</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[#00d8ff]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-[#00d8ff] text-sm font-bold">3</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Start viewing real-time market data</p>
                                        <p className="text-sm text-gray-400">Access live prices and start paper trading</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-[#00d8ff]/5 border border-[#00d8ff]/20 rounded-lg">
                                <p className="text-sm text-[#00d8ff]">
                                    💡 <strong>Note:</strong> This is a paper trading platform. No real money is involved.
                                    We only use Upstox for real-time market data.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Market Watch - Show when connected */}
                {showMarketWatch && (
                    <div className="space-y-6">
                        {/* Index ticker */}
                        <MarketIndices />

                        {(activeTab === "Holdings" || activeTab === "Positions" || activeTab === "Orders") && (
                            <PortfolioTabs tab={activeTab} />
                        )}

                        {activeTab === "Explore" && <TopStocks />}

                        {activeTab === "Watchlist" && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <MarketWatch />
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-white/10 bg-[#0b0d10] p-6">
                                <h3 className="mb-2 text-base font-semibold normal-case tracking-normal text-white">How watchlists work</h3>
                                <p className="text-sm text-slate-400">
                                    Search any supported NSE or BSE instrument, then PaperX subscribes to its live Upstox price feed.
                                </p>
                            </div>
                        </div>
                        </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function Dashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-[#00d8ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
