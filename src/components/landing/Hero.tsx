import Link from "next/link";

export const Hero = () => {
  return (
    <div className="container">
      <header
        className="hero"
        style={{
          padding: "clamp(60px, 10vw, 120px) 0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="visual-stipple"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "40%",
            height: "100%",
            backgroundImage: "var(--stipple)",
            backgroundSize: "4px 4px",
            opacity: 0.4,
            borderLeft: "var(--border-width) solid var(--ink)",
            pointerEvents: "none",
          }}
        ></div>
        <div
          className="hero-content"
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: "min(80%, 700px)",
          }}
        >
          <p
            style={{
              textTransform: "uppercase",
              letterSpacing: "2px",
              marginBottom: "16px",
              fontWeight: 700,
              fontSize: "clamp(10px, 2vw, 13px)",
            }}
          >
            Zero Risk Environment
          </p>
          <h1>
            Practice Trading
            <br />
            Without Real Capital
          </h1>
          <p
            style={{
              marginBottom: "clamp(24px, 5vw, 48px)",
              color: "var(--ink)",
              maxWidth: "50ch",
            }}
          >
            Master the markets with ₹10L virtual currency. Real-time data,
            architectural precision, zero financial exposure.
          </p>
          <Link href="/login">
            <button
              className="btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
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
              Start Simulation Free
            </button>
          </Link>
        </div>
      </header>
    </div>
  );
};
