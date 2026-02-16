"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UpstoxStatus {
    connected: boolean;
    expiresAt: string | null;
}

export function UpstoxConnect() {
    const [status, setStatus] = useState<UpstoxStatus>({ connected: false, expiresAt: null });
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const response = await fetch("/api/upstox/status");
            const data = await response.json();
            setStatus(data);
        } catch (error) {
            console.error("Error checking Upstox status:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        window.location.href = "/api/auth/upstox/authorize";
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect your Upstox account?")) {
            return;
        }

        try {
            const response = await fetch("/api/auth/upstox/disconnect", {
                method: "POST",
            });

            if (response.ok) {
                setStatus({ connected: false, expiresAt: null });
                router.refresh();
            }
        } catch (error) {
            console.error("Error disconnecting Upstox:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-400">Checking connection...</span>
            </div>
        );
    }

    if (status.connected) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-400 font-medium">Upstox Connected</span>
                </div>
                <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleConnect}
            className="px-6 py-2.5 bg-[#00d8ff] text-black font-semibold rounded-lg hover:bg-[#00c4e6] transition-all active:scale-[0.98] shadow-lg shadow-[#00d8ff]/20"
        >
            Connect Upstox
        </button>
    );
}
