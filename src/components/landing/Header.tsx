import Link from "next/link";

import { TrendingUp } from "lucide-react";

export function Header() {
  const navItems = [
    { label: "Home", href: "#" },
    { label: "Premium", href: "#" },
    { label: "Trading & Investing", href: "#" },
    { label: "Live Quotes", href: "#" },
    { label: "Resources", href: "#" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-[#00d8ff]" />
        <span className="text-xl font-bold text-white tracking-tight">PaperX</span>
      </div>

      <nav className="hidden md:flex items-center gap-8">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="text-sm font-medium text-gray-300 hover:text-[#00d8ff] transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <Link href="/login" className="px-6 py-2 rounded-full text-sm font-medium text-white border border-white/20 hover:bg-white/10 transition-colors">
          Log in
        </Link>
      </div>
    </header>
  );
}
