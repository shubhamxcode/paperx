"use client";

import { signIn, useSession } from "next-auth/react";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Login() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);
  console.log(`there isa a session here:`, session);
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-black overflow-hidden selection:bg-[#00d8ff] selection:text-black">
      {/* Background Effects (reused from Hero for consistency) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#00d8ff]/10 blur-[120px] rounded-full opacity-20" />

        {/* Grid Floor */}
        <div className="absolute bottom-0 left-0 right-0 h-[300px] perspective-grid opacity-20"
          style={{
            background: `linear-gradient(transparent 0%, #00d8ff 100%), 
                            linear-gradient(90deg, rgba(0, 216, 255, 0.1) 1px, transparent 1px),
                            linear-gradient(rgba(0, 216, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: '100% 100%, 50px 50px, 50px 50px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'bottom'
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:border-[#00d8ff]/50 transition-colors">
              <TrendingUp className="h-6 w-6 text-[#00d8ff]" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">PaperX</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to PaperX</h1>
          <p className="text-gray-400">Sign in to access your trading dashboard</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold h-12 rounded-xl hover:bg-gray-100 transition-all active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-black px-2 text-gray-500">Secure Access</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[#00d8ff]/5 border border-[#00d8ff]/20 text-xs text-[#00d8ff] text-center">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Don't have an account? It's free to start.</p>
        </div>
      </div>
    </div>
  );
}
