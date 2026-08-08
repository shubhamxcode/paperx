"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";

type Settings = {
  preferredExchange: "NSE" | "BSE";
  chartInterval: "1m" | "5m" | "15m" | "1D";
  defaultProduct: "DELIVERY" | "INTRADAY";
  orderConfirmation: boolean;
  orderUpdates: boolean;
  marketAlerts: boolean;
  learningReminders: boolean;
  compactMode: boolean;
  createdAt: string;
  updatedAt: string;
};

type Profile = {
  account: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    provider: string;
    memberSince: string;
  };
  paperAccount: {
    balancePaise: number;
    startingBalancePaise: number;
    holdingCount: number;
    orderCount: number;
    watchlistCount: number;
  };
  connections: {
    google: boolean;
  };
  settings: Settings;
};

type ConfirmAction = "reset" | "delete" | null;

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);

async function jsonResponse<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/10 transition-colors peer-checked:bg-cyan-400 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#07090b] after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmation, setConfirmation] = useState("");
  const [dangerLoading, setDangerLoading] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/profile", { cache: "no-store" });
      const body = await jsonResponse<Profile & { error?: string }>(response);
      if (!response.ok) throw new Error(body.error || "Failed to load profile");
      setProfile(body);
      setSettings(body.settings);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login?callbackUrl=%2Fprofile");
    if (status === "authenticated") void loadProfile();
  }, [status, router]);

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setMessage(null);
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await jsonResponse<{ settings?: Settings; error?: string }>(response);
      if (!response.ok || !body.settings) throw new Error(body.error || "Failed to save settings");
      setSettings(body.settings);
      setProfile((current) => current ? { ...current, settings: body.settings as Settings } : current);
      setMessage("Settings saved to your PaperX account.");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const runDangerAction = async () => {
    if (!confirmAction) return;
    const expected = confirmAction === "reset" ? "RESET" : "DELETE";
    if (confirmation !== expected) return;
    try {
      setDangerLoading(true);
      const response = await fetch(
        confirmAction === "reset" ? "/api/profile/reset-paper-account" : "/api/profile",
        {
          method: confirmAction === "reset" ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation }),
        }
      );
      const body = await jsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error || "Action failed");
      if (confirmAction === "delete") {
        await signOut({ callbackUrl: "/" });
        return;
      }
      setConfirmAction(null);
      setConfirmation("");
      setMessage("Paper account reset to ₹10,00,000. Your preferences and watchlist were kept.");
      await loadProfile();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    } finally {
      setDangerLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="paperx-dashboard min-h-screen bg-[#07090b] px-4 py-24 text-slate-300 sm:px-6" aria-busy="true" aria-label="Loading profile">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="mt-4 h-9 w-64 rounded bg-white/10" />
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.35fr]">
            <div className="h-72 rounded-2xl bg-white/[0.06]" />
            <div className="h-96 rounded-2xl bg-white/[0.06]" />
          </div>
        </div>
      </main>
    );
  }

  if (!profile || !settings) {
    return (
      <main className="paperx-dashboard grid min-h-screen place-items-center bg-[#07090b] px-4 text-center">
        <div>
          <p className="text-red-400">{error || "Profile unavailable"}</p>
          <button onClick={() => void loadProfile()} className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-black">Retry</button>
        </div>
      </main>
    );
  }

  const dirty = JSON.stringify(settings) !== JSON.stringify(profile.settings);
  const initials = (profile.account.name || "PX").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const expectedConfirmation = confirmAction === "reset" ? "RESET" : "DELETE";

  return (
    <div className="paperx-dashboard min-h-screen bg-[#07090b] text-slate-100">
      <header className="border-b border-white/10 bg-[#07090b]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <div className="flex items-center gap-2 font-semibold text-white">
            <span className="relative h-8 w-11 overflow-hidden rounded-md border border-white/10">
              <Image src="/PaperXLOGO.png" alt="PaperX" fill sizes="44px" className="object-cover" />
            </span>
            PaperX
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">Account center</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Profile &amp; settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Manage your PaperX identity, virtual account, data connections and learning preferences.</p>
        </div>

        {(message || error) && (
          <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
            {error || message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#0b0d10] p-6">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-cyan-400/10 text-lg font-bold text-cyan-300">
                  {profile.account.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.account.image} alt="" className="h-full w-full object-cover" />
                  ) : initials}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-white">{profile.account.name || "PaperX user"}</h2>
                  <p className="truncate text-sm text-slate-400">{profile.account.email}</p>
                  <p className="mt-1 text-xs text-slate-600">Member since {new Date(profile.account.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 text-sm">
                <div className="flex justify-between border-t border-white/10 pt-4"><span className="text-slate-500">Sign-in method</span><span className="text-white">Google</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Account ID</span><span className="font-mono text-xs text-slate-300">••••{profile.account.id.slice(-8)}</span></div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0b0d10] p-6">
              <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-cyan-400" /><h2 className="font-semibold text-white">Paper account</h2></div>
              <p className="mt-5 text-3xl font-semibold text-white">{money(profile.paperAccount.balancePaise)}</p>
              <p className="mt-1 text-xs text-slate-500">Available virtual cash · started with {money(profile.paperAccount.startingBalancePaise)}</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[["Holdings", profile.paperAccount.holdingCount], ["Orders", profile.paperAccount.orderCount], ["Watchlist", profile.paperAccount.watchlistCount]].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/[0.035] p-3 text-center"><p className="text-lg font-semibold text-white">{value}</p><p className="text-[11px] text-slate-500">{label}</p></div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] p-3 text-xs leading-5 text-cyan-200/80"><CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0" />This is learning money only. It cannot be deposited or withdrawn.</div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0b0d10] p-6">
              <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-cyan-400" /><h2 className="font-semibold text-white">Connections</h2></div>
              <div className="mt-4">
                <div className="flex items-center justify-between py-4"><div><p className="text-sm font-medium text-white">Google</p><p className="text-xs text-slate-500">Identity and secure login</p></div><span className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Connected</span></div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#0b0d10] p-6">
              <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-cyan-400" /><h2 className="font-semibold text-white">Notifications</h2></div>
              <p className="mt-1 text-xs text-slate-500">Preferences are ready; notification delivery will be enabled in its product chunk.</p>
              <div className="mt-3 divide-y divide-white/10">
                <Toggle checked={settings.orderUpdates} onChange={(value) => setSettings({ ...settings, orderUpdates: value })} label="Order updates" description="Paper order fills, rejections and cancellations." />
                <Toggle checked={settings.marketAlerts} onChange={(value) => setSettings({ ...settings, marketAlerts: value })} label="Market alerts" description="Important movement in watched instruments." />
                <Toggle checked={settings.learningReminders} onChange={(value) => setSettings({ ...settings, learningReminders: value })} label="Learning reminders" description="Practice sessions, quizzes and lesson progress." />
              </div>
              <button onClick={() => void saveSettings()} disabled={!dirty || saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Saving…" : dirty ? "Save settings" : "Settings saved"}</button>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0b0d10] p-6">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-400" /><h2 className="font-semibold text-white">Security &amp; account</h2></div>
              <div className="mt-4 divide-y divide-white/10">
                <button onClick={() => void signOut({ callbackUrl: "/" })} className="flex w-full items-center justify-between py-4 text-left"><span className="flex items-center gap-3 text-sm text-white"><LogOut className="h-4 w-4 text-slate-500" /> Sign out of PaperX</span><ChevronRight className="h-4 w-4 text-slate-600" /></button>
                <button onClick={() => { setConfirmAction("reset"); setConfirmation(""); }} className="flex w-full items-center justify-between py-4 text-left"><span><span className="flex items-center gap-3 text-sm text-amber-300"><RefreshCcw className="h-4 w-4" /> Reset paper account</span><span className="ml-7 mt-1 block text-xs text-slate-600">Clears holdings and orders; keeps settings and watchlist.</span></span><ChevronRight className="h-4 w-4 text-slate-600" /></button>
                <button onClick={() => { setConfirmAction("delete"); setConfirmation(""); }} className="flex w-full items-center justify-between py-4 text-left"><span><span className="flex items-center gap-3 text-sm text-red-400"><Trash2 className="h-4 w-4" /> Delete PaperX account</span><span className="ml-7 mt-1 block text-xs text-slate-600">Permanently removes PaperX data and connections.</span></span><ChevronRight className="h-4 w-4 text-slate-600" /></button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {confirmAction && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0d10] p-6 shadow-2xl">
            <div className={`grid h-11 w-11 place-items-center rounded-xl ${confirmAction === "delete" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-300"}`}>{confirmAction === "delete" ? <Trash2 className="h-5 w-5" /> : <RefreshCcw className="h-5 w-5" />}</div>
            <h2 id="confirm-title" className="mt-4 text-xl font-semibold text-white">{confirmAction === "delete" ? "Delete PaperX account?" : "Reset paper account?"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{confirmAction === "delete" ? "This permanently deletes your PaperX account, sessions, virtual balance, orders, holdings, watchlist and settings." : "Your virtual cash returns to ₹10,00,000 and all holdings and order history are removed. Your login, settings and watchlist remain."}</p>
            <label className="mt-5 block text-sm text-slate-400">Type <strong className="text-white">{expectedConfirmation}</strong> to confirm<input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 font-mono text-white outline-none focus:border-cyan-400/60" /></label>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setConfirmAction(null); setConfirmation(""); }} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">Cancel</button>
              <button onClick={() => void runDangerAction()} disabled={confirmation !== expectedConfirmation || dangerLoading} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40 ${confirmAction === "delete" ? "bg-red-500 text-white" : "bg-amber-400 text-black"}`}>{dangerLoading && <Loader2 className="h-4 w-4 animate-spin" />}{confirmAction === "delete" ? "Delete account" : "Reset account"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
