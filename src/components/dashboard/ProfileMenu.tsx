"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";

interface ProfileMenuProps {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

export function ProfileMenu({ name, email, image }: ProfileMenuProps) {
    const [open, setOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const initials = (name || "U")
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const handleLogout = async () => {
        setLoggingOut(true);
        // Clears the NextAuth session (DB + cookie) and returns to the landing page.
        await signOut({ callbackUrl: "/" });
    };

    const Avatar = ({ size }: { size: number }) => (
        <span
            className="flex items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 font-semibold text-white"
            style={{ width: size, height: size, fontSize: size * 0.35 }}
        >
            {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={name || "Profile"} className="h-full w-full object-cover" />
            ) : (
                initials
            )}
        </span>
    );

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                title={name || "Profile"}
                className="block rounded-full transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#00d8ff]/50"
            >
                <Avatar size={36} />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl"
                >
                    {/* User details */}
                    <div className="flex items-center gap-3 border-b border-white/10 p-4">
                        <Avatar size={44} />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{name || "User"}</p>
                            <p className="truncate text-xs text-gray-400">{email || ""}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-1.5">
                        <button
                            disabled
                            role="menuitem"
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-500"
                        >
                            <User className="h-4 w-4" />
                            Profile settings
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-600">Soon</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            role="menuitem"
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                        >
                            <LogOut className="h-4 w-4" />
                            {loggingOut ? "Logging out…" : "Logout"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
