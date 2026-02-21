export const Features = () => {
  return (
    <div className="container" style={{ padding: 0 }}>
      {/* 3-column feature cards — CSS class handles responsive columns */}
      <div className="features-section">
        <div
          className="feature-card"
          style={{
            padding: "clamp(32px, 5vw, 64px) 32px",
            minHeight: "clamp(280px, 40vw, 400px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            background: "var(--paper)",
            transition: "background 0.3s",
          }}
        >
          <div
            className="feature-icon"
            style={{
              fontSize: "32px",
              marginBottom: "32px",
              width: "64px",
              height: "64px",
              border: "1px solid var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--paper)",
              boxShadow: "4px 4px 0 var(--ink)",
            }}
          >
            A1
          </div>
          <h3>Real-Time Simulation</h3>
          <p>
            Trade on live market data without the lag. Experience the pressure of
            the opening bell with zero financial risk.
          </p>
        </div>

        <div
          className="feature-card"
          style={{
            padding: "clamp(32px, 5vw, 64px) 32px",
            minHeight: "clamp(280px, 40vw, 400px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            background: "var(--paper)",
            transition: "background 0.3s",
            backgroundImage:
              "linear-gradient(to bottom, transparent 95%, var(--ink) 95%)",
            backgroundSize: "100% 24px",
          }}
        >
          <div
            className="feature-icon"
            style={{
              fontSize: "32px",
              marginBottom: "32px",
              width: "64px",
              height: "64px",
              border: "1px solid var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--paper)",
              boxShadow: "4px 4px 0 var(--ink)",
            }}
          >
            B2
          </div>
          <h3>Smart Analytics</h3>
          <p>
            Post-trade analysis tools that dissect your P&L. Understand your
            psychological triggers and win/loss ratios.
          </p>
        </div>

        <div
          className="feature-card"
          style={{
            padding: "clamp(32px, 5vw, 64px) 32px",
            minHeight: "clamp(280px, 40vw, 400px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            background: "var(--paper)",
            transition: "background 0.3s",
          }}
        >
          <div
            className="feature-icon"
            style={{
              fontSize: "32px",
              marginBottom: "32px",
              width: "64px",
              height: "64px",
              border: "1px solid var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--paper)",
              boxShadow: "4px 4px 0 var(--ink)",
            }}
          >
            C3
          </div>
          <h3>Gamified Learning</h3>
          <p>
            Earn badges for consistency, risk management, and streak maintenance.
            Level up your trader profile.
          </p>
        </div>
      </div>

      {/* 2-column stats — CSS class handles responsive columns */}
      <div className="features-grid-2">
        <div
          className="block"
          style={{
            borderRight: "var(--border-width) solid var(--ink)",
            borderBottom: "1px solid var(--ink)",
            padding: "calc(var(--unit) * 4)",
            position: "relative",
            background: "var(--paper)",
            transition: "transform 0.2s ease, background 0.2s ease",
          }}
        >
          <h2>Virtual Wallet</h2>
          <div
            style={{
              fontSize: "clamp(2.5rem, 8vw, 4rem)",
              fontFamily: "Archivo, sans-serif",
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            ₹10L
          </div>
          <p style={{ marginTop: "16px" }}>
            Instant demo balance credited to your account upon signup. Reset
            anytime.
          </p>
        </div>
        <div
          className="block"
          style={{
            borderBottom: "1px solid var(--ink)",
            padding: "calc(var(--unit) * 4)",
            position: "relative",
            background: "var(--hatch)",
            transition: "transform 0.2s ease, background 0.2s ease",
          }}
        >
          <div
            style={{
              background: "var(--paper)",
              padding: "clamp(16px, 4vw, 32px)",
              border: "1px solid var(--ink)",
              boxShadow: "8px 8px 0 var(--ink)",
            }}
          >
            <h3>Instant Feedback Loop</h3>
            <p>
              Execute buy/sell orders and get immediate execution reports. Test
              strategies against historical data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
