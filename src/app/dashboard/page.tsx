"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useCallback, Suspense } from "react";
import { MarketWatch } from "@/components/MarketWatch";
import { MarketIndices } from "@/components/MarketIndices";
import {
    DashboardNav,
    type DashboardTab,
    type InstrumentSearchResult,
} from "@/components/dashboard/DashboardNav";
import { TopStocks } from "@/components/dashboard/TopStocks";
import { PortfolioTabs } from "@/components/dashboard/PortfolioTabs";
import { SoujiAssistant } from "@/components/souji/SoujiAssistant";
import { Toaster } from "react-hot-toast";

function DashboardContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<DashboardTab>("Explore");

    const openGlobalSearchResult = useCallback(async (instrument: InstrumentSearchResult) => {
        router.push(`/stocks/${encodeURIComponent(instrument.instrumentKey)}`);
    }, [router]);
    const requireAuth = useCallback(() => {
        router.push("/login?callbackUrl=%2Fdashboard");
    }, [router]);

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
                authenticated={status === "authenticated"}
                userName={session?.user?.name}
                userEmail={session?.user?.email}
                userImage={session?.user?.image}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onInstrumentSelect={openGlobalSearchResult}
            />

            {/* Main Content */}
            <main id="main-content" className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
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
                                    Search any supported NSE or BSE instrument. PaperX refreshes grouped prices approximately every five seconds.
                                </p>
                            </div>
                        </div>
                        </div>
                        )}
                </div>
            </main>
            {status === "authenticated" && (
                <SoujiAssistant
                    scope="portfolio"
                    authenticated
                    onRequireAuth={requireAuth}
                />
            )}
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
