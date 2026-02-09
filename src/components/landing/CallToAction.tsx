import Link from "next/link";

export const CallToAction = () => {
  return (
    <div
      className="container"
      style={{
        padding: "120px 48px",
        textAlign: "center",
      }}
    >
      <h2 style={{ marginBottom: "24px" }}>Ready to enter the market?</h2>
      <p style={{ margin: "0 auto 48px auto" }}>
        Join 50,000+ traders building their edge in the PaperTrade simulation.
      </p>
      <Link href="/login">
        <button
          className="btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "64px",
            padding: "0 48px",
            background: "var(--ink)",
            color: "var(--paper)",
            fontFamily: "Space Mono, monospace",
            fontWeight: 700,
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            border: "none",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.3s ease",
            zIndex: 1,
          }}
        >
          Create Free Account
        </button>
      </Link>
    </div>
  );
};
