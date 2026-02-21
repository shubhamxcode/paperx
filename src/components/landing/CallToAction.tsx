import Link from "next/link";

export const CallToAction = () => {
  return (
    <div
      className="container"
      style={{
        padding: "clamp(48px, 10vw, 120px) clamp(16px, 5vw, 48px)",
        textAlign: "center",
      }}
    >
      <h2 style={{ marginBottom: "24px" }}>Ready to enter the market?</h2>
      <p style={{ margin: "0 auto 48px auto", maxWidth: "48ch" }}>
        Join 50,000+ traders building their edge in the PaperX simulation.
      </p>
      <Link href="/login" style={{ display: "inline-block", width: "100%", maxWidth: "320px" }}>
        <button
          className="btn"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "clamp(48px, 8vw, 64px)",
            padding: "0 clamp(24px, 5vw, 48px)",
            background: "var(--ink)",
            color: "var(--paper)",
            fontFamily: "Space Mono, monospace",
            fontWeight: 700,
            fontSize: "clamp(12px, 2vw, 14px)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            border: "none",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.3s ease",
            zIndex: 1,
            whiteSpace: "nowrap",
          }}
        >
          Create Free Account
        </button>
      </Link>
    </div>
  );
};
