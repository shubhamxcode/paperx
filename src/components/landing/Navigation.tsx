import Link from "next/link";
import Image from "next/image";

export const Navigation = () => {
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
              fontSize: "24px",
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
  style={{
    objectFit: "contain",
    borderRadius: "50%", // 👈 makes it round
  }}
/>

            PaperX
          </div>
        </Link>
        <div className="nav-links" style={{ display: "flex" }}>
          <Link
            href="#simulation"
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
            Simulation
          </Link>
          <Link
            href="#markets"
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
            Markets
          </Link>
          <Link
            href="#analytics"
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
            Analytics
          </Link>
          <Link
            href="/login"
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
            Login
          </Link>
        </div>
      </nav>
    </div>
  );
};
