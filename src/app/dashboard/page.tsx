"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { UpstoxConnect } from "@/components/UpstoxConnect";
import { MarketWatch } from "@/components/MarketWatch";
import toast, { Toaster } from "react-hot-toast";

function DashboardContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showMarketWatch, setShowMarketWatch] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    useEffect(() => {
        // Check for Upstox connection status from backend
        const checkStatus = async () => {
            try {
                const response = await fetch("/api/upstox/status");
                const data = await response.json();
                if (data.connected) {
                    setShowMarketWatch(true);
                }
            } catch (error) {
                console.error("Error checking Upstox status:", error);
            }
        };

        checkStatus();

        // Check for Upstox connection status from URL params
        const upstoxConnected = searchParams.get("upstox_connected");
        const upstoxError = searchParams.get("upstox_error");

        if (upstoxConnected === "true") {
            toast.success("Upstox connected successfully!");
            setShowMarketWatch(true);
            // Clean URL
            window.history.replaceState({}, "", "/dashboard");
        }

        if (upstoxError) {
            toast.error(`Upstox connection failed: ${upstoxError}`);
            // Clean URL
            window.history.replaceState({}, "", "/dashboard");
        }
    }, [searchParams]);

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
        <div className="min-h-screen bg-black">
            <Toaster position="top-right" />

            {/* Header */}
            <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                                <TrendingUp className="h-6 w-6 text-[#00d8ff]" />
                            </div>
                            <span className="text-2xl font-bold text-white tracking-tight">PaperX</span>
                        </Link>

                        <div className="flex items-center gap-4">
                            <div className="text-right mr-4">
                                <p className="text-sm text-gray-400">Welcome back,</p>
                                <p className="font-semibold text-white">{session?.user?.name}</p>
                            </div>
                            <UpstoxConnect />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Trading Dashboard</h1>
                    <p className="text-gray-400">
                        Paper trading with real-time market data from Upstox
                    </p>
                </div>

                {/* Connection Instructions */}
                {!showMarketWatch && (
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-8">
                        <div className="text-center max-w-2xl mx-auto">
                            <div className="w-16 h-16 bg-[#00d8ff]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <TrendingUp className="w-8 h-8 text-[#00d8ff]" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">
                                Connect Your Upstox Account
                            </h2>
                            <p className="text-gray-400 mb-6">
                                To start paper trading with real-time market data, connect your Upstox account.
                                This will allow you to access live market prices during trading hours (9:15 AM - 3:30 PM).
                            </p>
                            <div className="flex flex-col gap-3 text-left bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[#00d8ff]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-[#00d8ff] text-sm font-bold">1</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Click "Connect Upstox" above</p>
                                        <p className="text-sm text-gray-400">You'll be redirected to Upstox login page</p>
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <MarketWatch />
                        </div>

                        <div className="space-y-6">
                            {/* Portfolio Summary Placeholder */}
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4">Portfolio</h3>
                                <div className="text-center py-8 text-gray-400">
                                    <p className="mb-2">Coming soon!</p>
                                    <p className="text-sm">Track your paper trading positions here</p>
                                </div>
                            </div>

                            {/* Quick Stats Placeholder */}
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4">Quick Stats</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Virtual Balance</span>
                                        <span className="text-white font-semibold">₹10,00,000</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Total P&L</span>
                                        <span className="text-green-400 font-semibold">+₹0</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Active Positions</span>
                                        <span className="text-white font-semibold">0</span>
                                    </div>
                                </div>
                            </div>
                        </div>
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
