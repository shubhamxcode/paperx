import Link from "next/link";

export const Footer = () => {
  return (
    <footer
      style={{
        background: "var(--ink)",
        color: "var(--paper)",
        padding: "80px calc(var(--unit) * 4)",
        borderLeft: "var(--border-width) solid var(--paper)",
        borderRight: "var(--border-width) solid var(--paper)",
        margin: "0 auto",
        maxWidth: "1400px",
      }}
    >
      <div
        className="footer-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          gap: "48px",
        }}
      >
        <div className="footer-col">
          <div
            className="logo"
            style={{
              display: "inline-block",
              borderColor: "var(--paper)",
              color: "var(--paper)",
              marginBottom: "24px",
              fontFamily: "Archivo, sans-serif",
              fontWeight: 800,
              fontSize: "24px",
              letterSpacing: "-1px",
              border: "2px solid var(--paper)",
              padding: "4px 12px",
              background: "transparent",
            }}
          >
            PAPERTRADE_SYS
          </div>
          <p
            style={{
              color: "#888",
              fontSize: "14px",
              maxWidth: "300px",
            }}
          >
            An advanced architectural approach to financial education. We build the
            foundations for your trading career.
          </p>
        </div>
        <div className="footer-col">
          <h4
            style={{
              color: "var(--paper)",
              fontFamily: "Space Mono, monospace",
              fontSize: "14px",
              marginBottom: "24px",
            }}
          >
            Platform
          </h4>
          <ul className="footer-links" style={{ listStyle: "none" }}>
            <li style={{ marginBottom: "12px" }}>
              <Link
                href="#"
                style={{
                  color: "#888",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "color 0.2s",
                }}
              >
                Live Markets
              </Link>
            </li>
            <li style={{ marginBottom: "12px" }}>
              <Link
                href="#"
                style={{
                  color: "#888",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "color 0.2s",
                }}
              >
                Simulator
              </Link>
            </li>
            <li style={{ marginBottom: "12px" }}>
              <Link
                href="#"
                style={{
                  color: "#888",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "color 0.2s",
                }}
              >
                Pricing
              </Link>
            </li>
            <li style={{ marginBottom: "12px" }}>
              <Link
                href="#"
                style={{
                  color: "#888",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "color 0.2s",
                }}
              >
                API Docs
              </Link>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h4
            style={{
              color: "var(--paper)",
              fontFamily: "Space Mono, monospace",
              fontSize: "14px",
              marginBottom: "24px",
            }}
          >
            Legal
          </h4>
          <ul className="footer-links" style={{ listStyle: "none" }}>
            <li style={{ marginBottom: "12px" }}>
              <Link
                href="#"
                style={{
                  color: "#888",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "color 0.2s",
                }}
              >
                Terms of Service
              </Link>
            </li>
            <li style={{ marginBottom: "12px" }}>
              <Link
                href="#"
                style={{
                  color: "#888",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "color 0.2s",
                }}
              >
                Privacy Policy
              </Link>
            </li>
            <li style={{ marginBottom: "12px" }}>
              <Link
                href="#"
                style={{
                  color: "#888",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "color 0.2s",
                }}
              >
                Risk Disclosure
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
};
