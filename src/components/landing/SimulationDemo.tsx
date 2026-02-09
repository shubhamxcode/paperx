"use client";

import { useState } from "react";

export const SimulationDemo = () => {
  const [quantity, setQuantity] = useState(100);

  const handleBuy = () => {
    alert(`Buying ${quantity} shares of RELIANCE`);
  };

  const handleSell = () => {
    alert(`Selling ${quantity} shares of RELIANCE`);
  };

  return (
    <div className="container" style={{ padding: 0 }}>
      <div
        className="sim-container"
        style={{
          borderBottom: "var(--border-width) solid var(--ink)",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          minHeight: "600px",
        }}
      >
        <div
          className="chart-area"
          style={{
            padding: "48px",
            position: "relative",
            borderRight: "var(--border-width) solid var(--ink)",
            backgroundImage:
              "linear-gradient(var(--wash) 1px, transparent 1px), linear-gradient(90deg, var(--wash) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "24px",
              left: "24px",
              fontWeight: 700,
            }}
          >
            NIFTY 50 INDEX [SIM]
          </div>
          <div
            className="chart-line"
            style={{
              width: "100%",
              height: "300px",
              position: "absolute",
              bottom: "48px",
              left: 0,
              overflow: "hidden",
            }}
          >
            <svg
              className="chart-svg"
              viewBox="0 0 500 150"
              preserveAspectRatio="none"
              style={{ width: "100%", height: "100%" }}
            >
              <path
                className="line-path"
                d="M0,100 Q50,50 100,80 T200,60 T300,100 T400,40 T500,80 L500,150 L0,150 Z"
                style={{ fill: "rgba(0,0,0,0.05)", strokeWidth: 0 }}
              ></path>
              <path
                className="line-path"
                d="M0,100 Q50,50 100,80 T200,60 T300,100 T400,40 T500,80"
              ></path>
            </svg>
          </div>
        </div>
        <div
          className="trade-panel"
          style={{
            padding: "48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          <div className="input-group">
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                marginBottom: "8px",
                textTransform: "uppercase",
              }}
            >
              Symbol
            </label>
            <div
              className="input-box"
              style={{
                width: "100%",
                padding: "16px",
                background: "transparent",
                border: "1px solid var(--ink)",
                fontFamily: "Space Mono, monospace",
                fontSize: "18px",
                color: "var(--ink)",
                boxShadow: "4px 4px 0 var(--wash)",
                transition: "box-shadow 0.2s",
              }}
            >
              RELIANCE
            </div>
          </div>
          <div className="input-group">
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                marginBottom: "8px",
                textTransform: "uppercase",
              }}
            >
              Quantity
            </label>
            <input
              type="number"
              className="input-box"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "16px",
                background: "transparent",
                border: "1px solid var(--ink)",
                fontFamily: "Space Mono, monospace",
                fontSize: "18px",
                color: "var(--ink)",
                boxShadow: "4px 4px 0 var(--wash)",
                transition: "box-shadow 0.2s",
              }}
            />
          </div>
          <div
            className="trade-actions"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
          >
            <div
              className="btn-trade btn-buy"
              onClick={handleBuy}
              style={{
                padding: "20px",
                textAlign: "center",
                border: "1px solid var(--ink)",
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
                fontSize: "12px",
                transition: "all 0.2s",
                background: "var(--ink)",
                color: "var(--paper)",
              }}
            >
              Buy Long
            </div>
            <div
              className="btn-trade btn-sell"
              onClick={handleSell}
              style={{
                padding: "20px",
                textAlign: "center",
                border: "1px solid var(--ink)",
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
                fontSize: "12px",
                transition: "all 0.2s",
                background: "transparent",
                color: "var(--ink)",
              }}
            >
              Sell Short
            </div>
          </div>
          <p style={{ fontSize: "12px", opacity: 0.6, marginTop: "12px" }}>
            * This is a simulation. No real money is moved.
          </p>
        </div>
      </div>
    </div>
  );
};
