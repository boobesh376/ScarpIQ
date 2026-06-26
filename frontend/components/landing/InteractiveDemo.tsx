"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type StageKey =
  | "idle"
  | "material"
  | "recognition"
  | "classification"
  | "condition"
  | "market"
  | "prediction"
  | "valuation";

interface EngineMaterial {
  id: string;
  name: string;
  emoji: string;
  category: string;
  grade: string;
  condition: string;
  purity: number;
  weight: string;
  pricePerKg: string;
  total: string;
  confidence: number;
  co2: string;
  demand: "High" | "Medium" | "Low";
  trend: "up" | "down" | "stable";
  color: string;
}

const ENGINE_MATERIALS: EngineMaterial[] = [
  {
    id: "copper-wire",
    name: "Copper Wire Bundle",
    emoji: "🔌",
    category: "Non-ferrous Metal",
    grade: "Grade A",
    condition: "Clean, stripped",
    purity: 98,
    weight: "12.5 kg",
    pricePerKg: "₹700",
    total: "₹8,750",
    confidence: 97,
    co2: "2.8 kg",
    demand: "High",
    trend: "up",
    color: "#FFB800",
  },
  {
    id: "aluminum-extrusion",
    name: "Aluminum Extrusion",
    emoji: "📋",
    category: "Non-ferrous Metal",
    grade: "Grade B",
    condition: "Light oxidation",
    purity: 91,
    weight: "8.2 kg",
    pricePerKg: "₹200",
    total: "₹1,640",
    confidence: 94,
    co2: "1.9 kg",
    demand: "Medium",
    trend: "stable",
    color: "#0EA5E9",
  },
  {
    id: "stainless-steel-304",
    name: "Stainless Steel 304",
    emoji: "⚙️",
    category: "Ferrous Metal",
    grade: "Grade 304",
    condition: "Mixed scrap",
    purity: 88,
    weight: "22.0 kg",
    pricePerKg: "₹85",
    total: "₹1,870",
    confidence: 91,
    co2: "3.4 kg",
    demand: "High",
    trend: "up",
    color: "#64748B",
  },
];

const PIPELINE: { key: StageKey; label: string; sub: string; icon: string }[] = [
  { key: "material",       label: "Material Intake",       sub: "Image received",            icon: "📷" },
  { key: "recognition",    label: "AI Recognition",        sub: "Vision model scanning",      icon: "🤖" },
  { key: "classification", label: "Classification",        sub: "Identifying type & grade",   icon: "🧬" },
  { key: "condition",      label: "Condition Analysis",    sub: "Assessing quality",          icon: "🔍" },
  { key: "market",         label: "Market Intelligence",   sub: "Cross-referencing prices",   icon: "📡" },
  { key: "prediction",     label: "Price Prediction",      sub: "Modeling valuation",         icon: "📈" },
  { key: "valuation",      label: "Final Valuation",       sub: "Report generated",           icon: "✅" },
];

const STAGE_DURATIONS: Record<StageKey, number> = {
  idle: 0,
  material: 600,
  recognition: 1100,
  classification: 1000,
  condition: 900,
  market: 1000,
  prediction: 900,
  valuation: 600,
};

function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/** Counts up to a target integer once `active` flips true. */
function useCountTo(target: number, active: boolean, duration = 700) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let t0: number | null = null;
    let raf = 0;
    const tick = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target, duration]);
  return val;
}

export function InteractiveDemo() {
  const header = useReveal(0.15);
  const panel = useReveal(0.1);

  const [selectedId, setSelectedId] = useState(ENGINE_MATERIALS[0].id);
  const [stage, setStage] = useState<StageKey>("idle");
  const [running, setRunning] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const mat = ENGINE_MATERIALS.find((m) => m.id === selectedId) ?? ENGINE_MATERIALS[0];
  const stageIdx = stage === "idle" ? -1 : PIPELINE.findIndex((p) => p.key === stage);
  const isComplete = stage === "valuation";

  const clearTimers = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  }, []);

  const runEngine = useCallback((id: string) => {
    clearTimers();
    setSelectedId(id);
    setStage("idle");
    setRunning(true);

    let delay = 150;
    PIPELINE.forEach((p) => {
      const t = setTimeout(() => setStage(p.key), delay);
      timeouts.current.push(t);
      delay += STAGE_DURATIONS[p.key];
    });
    const finishTimer = setTimeout(() => setRunning(false), delay);
    timeouts.current.push(finishTimer);
  }, [clearTimers]);

  // Auto-run the first material once the panel scrolls into view
  const autoStarted = useRef(false);
  useEffect(() => {
    if (panel.visible && !autoStarted.current) {
      autoStarted.current = true;
      runEngine(ENGINE_MATERIALS[0].id);
    }
  }, [panel.visible, runEngine]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const confidence = useCountTo(mat.confidence, isComplete, 800);
  const purity = useCountTo(mat.purity, stageIdx >= 3, 700); // condition stage onward

  return (
    <section id="intelligence" style={{
      background: "#F8FAFC",
      padding: "100px 24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
        width: "900px", height: "500px",
        background: "radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse 70% 70% at 50% 30%, black 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: "1140px", margin: "0 auto", position: "relative" }}>
        {/* Header */}
        <div
          ref={header.ref}
          style={{
            textAlign: "center",
            marginBottom: "56px",
            opacity: header.visible ? 1 : 0,
            transform: header.visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
          }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#10B981",
            background: "#DCFCE7",
            border: "1px solid #A7F3D0",
            borderRadius: "999px", padding: "5px 14px", marginBottom: "20px",
          }}>
            Live Engine
          </div>
          <h2 style={{
            fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, lineHeight: 1.15,
            letterSpacing: "-0.03em", color: "#0F172A", marginBottom: "16px",
          }}>
            Inside the{" "}
            <span style={{
              background: "linear-gradient(135deg, #10B981, #34D399)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              ScrapIQ AI Engine
            </span>
          </h2>
          <p style={{ color: "#475569", fontSize: "17px", maxWidth: "520px", margin: "0 auto", lineHeight: 1.65 }}>
            Watch the model think — from raw image to verified market valuation, in real time.
          </p>
        </div>

        {/* Material selector chips */}
        <div
          style={{
            display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap",
            marginBottom: "40px",
          }}
        >
          {ENGINE_MATERIALS.map((m) => {
            const active = m.id === selectedId;
            return (
              <button
                key={m.id}
                onClick={() => runEngine(m.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "9px 18px",
                  borderRadius: "999px",
                  background: active ? `${m.color}15` : "#FFFFFF",
                  border: `1px solid ${active ? m.color + "40" : "#E2E8F0"}`,
                  color: active ? "#0F172A" : "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  minHeight: "auto",
                }}
              >
                <span style={{ fontSize: "16px" }}>{m.emoji}</span>
                {m.name}
              </button>
            );
          })}
        </div>

        {/* Main panel */}
        <div
          ref={panel.ref}
          style={{
            display: "grid",
            gridTemplateColumns: "0.85fr 1.15fr",
            gap: "0",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            overflow: "hidden",
            opacity: panel.visible ? 1 : 0,
            transform: panel.visible ? "translateY(0)" : "translateY(28px)",
            transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
          className="engine-grid"
        >
          {/* Left: Pipeline stepper */}
          <div style={{
            padding: "32px 28px",
            borderRight: "1px solid #E2E8F0",
            background: "#FFFFFF",
          }} className="engine-stepper-col">
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "24px",
            }}>
              <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>
                Pipeline
              </span>
              {running && (
                <span style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  fontSize: "11px", fontWeight: 700, color: "#10B981",
                }}>
                  <span style={{
                    width: "5px", height: "5px", borderRadius: "50%", background: "#10B981",
                    animation: "enginePulse 1s ease-in-out infinite", display: "inline-block",
                  }} />
                  RUNNING
                </span>
              )}
            </div>

            <div style={{ position: "relative" }}>
              {/* Connector line */}
              <div style={{
                position: "absolute", left: "15px", top: "16px", bottom: "16px",
                width: "2px", background: "#E2E8F0",
              }} />
              <div style={{
                position: "absolute", left: "15px", top: "16px",
                width: "2px",
                height: stageIdx < 0 ? "0%" : `${(Math.min(stageIdx + 1, PIPELINE.length) / PIPELINE.length) * 100}%`,
                background: "linear-gradient(180deg, #10B981, #34D399)",
                transition: "height 0.5s ease",
              }} />

              {PIPELINE.map((p, i) => {
                const done = stageIdx > i;
                const active = stageIdx === i;
                return (
                  <div key={p.key} style={{
                    display: "flex", alignItems: "flex-start", gap: "14px",
                    position: "relative", paddingBottom: i < PIPELINE.length - 1 ? "22px" : "0",
                  }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", flexShrink: 0, zIndex: 1,
                      background: done ? "#10B981" : active ? "#DCFCE7" : "#F1F5F9",
                      border: done ? "none" : active ? "2px solid #10B981" : "2px solid #CBD5E1",
                      color: done ? "#FFFFFF" : active ? "#10B981" : "#0F172A",
                      transition: "all 0.3s ease",
                      boxShadow: active ? "0 0 0 4px rgba(16,185,129,0.12)" : "none",
                    }}>
                      {done ? "✓" : p.icon}
                    </div>
                    <div style={{ paddingTop: "5px" }}>
                      <div style={{
                        fontSize: "13.5px", fontWeight: 700,
                        color: done || active ? "#0F172A" : "#64748B",
                        transition: "color 0.3s",
                      }}>
                        {p.label}
                      </div>
                      <div style={{
                        fontSize: "12px",
                        color: active ? "#10B981" : "#94A3B8",
                        transition: "color 0.3s",
                      }}>
                        {active ? p.sub + "…" : done ? "Done" : p.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => runEngine(selectedId)}
              disabled={running}
              style={{
                marginTop: "28px",
                width: "100%",
                padding: "11px",
                borderRadius: "10px",
                border: "1px solid #D1FAE5",
                background: running ? "#F8FAFC" : "#DCFCE7",
                color: running ? "#94A3B8" : "#10B981",
                fontSize: "13px",
                fontWeight: 700,
                cursor: running ? "default" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {running ? "Engine running…" : "Run Again ↻"}
            </button>
          </div>

          {/* Right: Live readout */}
          <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
            {/* Radar / scan visual */}
            <div style={{
              position: "relative",
              height: "150px",
              borderRadius: "16px",
              background: "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.08), rgba(255,255,255,0.5))",
              border: "1px solid #E2E8F0",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "24px",
              overflow: "hidden",
            }}>
              {/* Rotating sweep */}
              {running && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.25) 25deg, transparent 70deg)",
                  animation: "engineSweep 1.8s linear infinite",
                }} />
              )}
              {/* Concentric rings */}
              {[1, 2, 3].map((r) => (
                <div key={r} style={{
                  position: "absolute",
                  width: `${r * 44}px`, height: `${r * 44}px`,
                  borderRadius: "50%",
                  border: "1px solid rgba(16,185,129,0.15)",
                }} />
              ))}
              <div style={{
                fontSize: "44px",
                position: "relative",
                filter: running ? "drop-shadow(0 0 14px rgba(16,185,129,0.3))" : "none",
                animation: running ? "engineFloat 2s ease-in-out infinite" : "none",
                transition: "filter 0.3s",
              }}>
                {mat.emoji}
              </div>
            </div>

            {/* Progressive readout grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <ReadoutField label="Material" value={stageIdx >= 1 ? mat.name : "—"} ready={stageIdx >= 1} />
              <ReadoutField label="Category" value={stageIdx >= 2 ? mat.category : "—"} ready={stageIdx >= 2} accent={mat.color} />
              <ReadoutField label="Grade" value={stageIdx >= 2 ? mat.grade : "—"} ready={stageIdx >= 2} />
              <ReadoutField label="Condition" value={stageIdx >= 3 ? mat.condition : "—"} ready={stageIdx >= 3} />
            </div>

            {/* Purity bar */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
                <span>Purity Estimate</span>
                <span style={{ color: "#0F172A" }}>{stageIdx >= 3 ? purity : 0}%</span>
              </div>
              <div style={{ height: "6px", borderRadius: "3px", background: "#E2E8F0", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: "3px",
                  width: stageIdx >= 3 ? `${purity}%` : "0%",
                  background: `linear-gradient(90deg, ${mat.color}, #10B981)`,
                  transition: "width 0.2s linear",
                }} />
              </div>
            </div>

            {/* Market row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px",
            }}>
              <ReadoutField
                label="Market Demand"
                value={stageIdx >= 4 ? mat.demand : "—"}
                ready={stageIdx >= 4}
                accent={mat.demand === "High" ? "#10B981" : "#FFB800"}
              />
              <ReadoutField
                label="Price / kg"
                value={stageIdx >= 5 ? mat.pricePerKg : "—"}
                ready={stageIdx >= 5}
                accent="#10B981"
              />
            </div>

            {/* Final valuation reveal */}
            <div style={{
              marginTop: "auto",
              padding: "20px",
              borderRadius: "16px",
              background: isComplete ? `linear-gradient(135deg, ${mat.color}12, rgba(16,185,129,0.08))` : "#F8FAFC",
              border: `1px solid ${isComplete ? "#D1FAE5" : "#E2E8F0"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "16px", flexWrap: "wrap",
              transition: "all 0.4s ease",
              transform: isComplete ? "scale(1)" : "scale(0.99)",
            }}>
              <div>
                <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Final Valuation
                </div>
                <div style={{
                  fontSize: "30px", fontWeight: 900, letterSpacing: "-0.02em",
                  color: isComplete ? "#0F172A" : "#94A3B8",
                  transition: "color 0.4s",
                }}>
                  {isComplete ? mat.total : "₹ — . — —"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  AI Confidence
                </div>
                <div style={{
                  fontSize: "30px", fontWeight: 900,
                  color: isComplete ? "#10B981" : "#94A3B8",
                  transition: "color 0.4s",
                }}>
                  {confidence}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes enginePulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes engineSweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes engineFloat {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @media (max-width: 860px) {
          .engine-grid { grid-template-columns: 1fr !important; }
          .engine-stepper-col { border-right: none !important; border-bottom: 1px solid #E2E8F0; }
        }
      `}</style>
    </section>
  );
}

function ReadoutField({
  label,
  value,
  ready,
  accent,
}: {
  label: string;
  value: string;
  ready: boolean;
  accent?: string;
}) {
  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: "10px",
      background: "#F8FAFC",
      border: "1px solid #E2E8F0",
    }}>
      <div style={{ fontSize: "10.5px", color: "#64748B", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{
        fontSize: "13.5px",
        fontWeight: 700,
        color: ready ? (accent || "#0F172A") : "#94A3B8",
        opacity: ready ? 1 : 0.5,
        transition: "opacity 0.3s, color 0.3s",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {value}
      </div>
    </div>
  );
}
