"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export const Navigation = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="container">
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "calc(var(--unit) * 3) 0",
          borderBottom: "var(--border-width) solid var(--ink)",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <div
            className="logo"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontFamily: "Archivo, sans-serif",
              fontWeight: 800,
              fontSize: "clamp(18px, 4vw, 24px)",
              letterSpacing: "-1px",
              border: "2px solid var(--ink)",
              padding: "4px 12px",
              background: "var(--ink)",
              color: "var(--paper)",
            }}
          >
            <Image
              src="/Logo.png"
              alt="PaperX Logo"
              width={32}
              height={32}
              style={{ objectFit: "contain", borderRadius: "50%" }}
            />
            PaperX
          </div>
        </Link>

        {/* Desktop nav links */}
        <div className="nav-links desktop-nav">
          {[
            { href: "#simulation", label: "Simulation" },
            { href: "#markets", label: "Markets" },
            { href: "#analytics", label: "Analytics" },
            { href: "/login", label: "Login" },
          ].map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              style={{
                marginLeft: "32px",
                textDecoration: "none",
                color: "var(--ink)",
                fontWeight: 700,
                fontSize: "12px",
                textTransform: "uppercase",
                position: "relative",
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Hamburger button — only shown on mobile via CSS */}
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="17" x2="21" y2="17" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        <Link href="#simulation" onClick={() => setMenuOpen(false)}>Simulation</Link>
        <Link href="#markets" onClick={() => setMenuOpen(false)}>Markets</Link>
        <Link href="#analytics" onClick={() => setMenuOpen(false)}>Analytics</Link>
        <Link href="/login" onClick={() => setMenuOpen(false)}>Login</Link>
      </div>
    </div>
  );
};
