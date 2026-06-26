import { MOCK_MARKET_PRICES, getTrendIcon, getTrendColor } from "@/lib/dashboardHelpers";

export function MarketSnapshot() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "20px",
        padding: "24px",
        boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "10px",
            background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
          }}>📊</div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Market Snapshot</h3>
        </div>
        <span style={{
          display: "flex", alignItems: "center", gap: "5px",
          fontSize: "10.5px", fontWeight: 700, color: "#00B383",
          background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)",
          borderRadius: "999px", padding: "3px 9px",
        }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00C896", display: "inline-block" }} />
          LIVE
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {MOCK_MARKET_PRICES.map((item) => (
          <div
            key={item.material}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "11px 12px",
              background: "#F8FAFC",
              borderRadius: "12px",
              border: "1px solid #F1F5F9",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "9px",
                background: "#FFFFFF", border: "1px solid #E2E8F0",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
              }}>{item.emoji}</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>{item.material}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>{item.unit}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: getTrendColor(item.trend), fontWeight: 700, fontSize: "13.5px" }}>
              <span>₹{item.price}</span>
              <span style={{ fontSize: "14px" }}>{getTrendIcon(item.trend)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "14px", fontSize: "11.5px", color: "#94A3B8", display: "flex", alignItems: "center", gap: "6px" }}>
        💡 Prices are mock data for demonstration
      </div>
    </div>
  );
}
