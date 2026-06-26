"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeWithImage,
  analyze,
  answer,
  submitFeedback,
  type AnalyzeResponse,
  type Question,
  type AIAnalysis,
} from "@/lib/api";
import { normalizeAnswer } from "@/lib/normalizer";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import AnalysisResult from "@/components/AnalysisResult";
import PostDetectionFlow from "@/components/PostDetectionFlow";
import s from "./upload.module.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED  = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const ANALYSIS_STEPS = [
  { key: "upload",    label: "Image uploaded",              icon: "📤" },
  { key: "vision",    label: "Features extracted",          icon: "🔬" },
  { key: "material",  label: "Material identified",         icon: "🧪" },
  { key: "valuation", label: "Market intelligence loaded",  icon: "💹" },
  { key: "finalize",  label: "Generating valuation",        icon: "✨" },
];

const STEP_DURATION_MS = [300, 900, 750, 650, 500];

const AI_INSIGHTS = [
  "Analyzing material composition…",
  "Comparing against scrap intelligence database…",
  "Matching against historical patterns…",
  "Retrieving market intelligence…",
  "Calculating optimal valuation…",
  "Generating final estimate…",
];

// Procedural confidence ramp shown while the engine call is in flight —
// illustrates the AI "thinking", not a literal readout of a backend metric.
const CONFIDENCE_RAMP = [67, 74, 81, 88, 93, 97];

// Illustrative live-processing widgets shown only during the analyzing
// animation. These are not assertions about the real classification —
// the backend doesn't expose a probability breakdown or market snapshot —
// so they're framed purely as "engine is working" motion, finalized away
// once the real aiAnalysis/result data arrives.
const DEMO_MARKET_SNAPSHOT = [
  { label: "Demand",     value: "High" },
  { label: "Trend",      value: "Positive" },
  { label: "Volatility", value: "Low" },
];

const CONDITION_OPTIONS = [
  { value: "excellent",       emoji: "✨", label: "Excellent",    desc: "Like new"       },
  { value: "good",            emoji: "👍", label: "Good",         desc: "Light wear"     },
  { value: "worn",            emoji: "🔧", label: "Worn",         desc: "Visible use"    },
  { value: "damaged",         emoji: "⚠️", label: "Damaged",      desc: "Clear damage"   },
  { value: "heavily_damaged", emoji: "🔴", label: "Heavy Damage", desc: "Major damage"   },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "idle" | "analyzing" | "asking" | "result" | "error" | "expired";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function capitalize(str: string) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function friendlyMaterial(m: string | null | undefined) {
  if (!m || m === "unknown") return null;
  const labels: Record<string, string> = {
    copper: "Copper", iron: "Iron", aluminum: "Aluminum",
    steel: "Steel", plastic: "Plastic",
  };
  return labels[m.toLowerCase()] ?? capitalize(m);
}

function badgeClass(cat: string) {
  if (cat === "metal")       return s.badgeMetal;
  if (cat === "plastic")     return s.badgePlastic;
  if (cat === "electronics") return s.badgeElectronics;
  return s.badgeUnknown;
}

function catEmoji(cat: string) {
  if (cat === "metal")       return "⚙️";
  if (cat === "electronics") return "🔌";
  if (cat === "plastic")     return "♻️";
  return "📦";
}

// ── LivePulse ─────────────────────────────────────────────────────────────────

function LivePulse({ color = "#10B981", size = 7 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 4, height: size + 4 }}>
      <span style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: color, opacity: 0.3, animation: "dRipple 2s ease-out infinite" }} />
      <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "block" }} />
    </span>
  );
}

// ── ConfidenceMeter (for AI insights panel) ───────────────────────────────────

function ConfidenceMeter({ level, score }: { level: "high" | "medium" | "low"; score: number }) {
  const barCls   = level === "high" ? s.confidenceBarHigh  : level === "medium" ? s.confidenceBarMed  : s.confidenceBarLow;
  const scoreCls = level === "high" ? s.confidenceScoreHigh : level === "medium" ? s.confidenceScoreMed : s.confidenceScoreLow;
  const label    = level === "high" ? "High Confidence"    : level === "medium" ? "Medium Confidence" : "Low Confidence";
  return (
    <div className={s.confidenceRow}>
      <span className={s.confidenceLabel}>{label}</span>
      <div className={s.confidenceBarWrap}>
        <div className={`${s.confidenceBar} ${barCls}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`${s.confidenceScore} ${scoreCls}`}>{score}%</span>
    </div>
  );
}

// ── AIInsightsPanel ───────────────────────────────────────────────────────────

function AIInsightsPanel({ ai }: { ai: AIAnalysis }) {
  const hasReasoning  = ai.reasoning && ai.reasoning.length > 0;
  const hasConfidence = ai.confidence && typeof ai.confidence.score === "number";
  return (
    <div className={s.insightsCard}>
      <div className={s.insightsHeader}>
        <span className={s.insightsIcon}>🤖</span>
        <span className={s.insightsTitle}>AI Vision Analysis</span>
      </div>
      {hasConfidence && <ConfidenceMeter level={ai.confidence.level} score={ai.confidence.score} />}
      {hasReasoning ? (
        <div className={s.reasoningList}>
          {ai.reasoning.map((r, i) => (
            <div key={i} className={s.reasoningItem}>
              <div className={s.reasoningDot} />
              <span>{r}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={s.fallbackNote}>Visual indicators were analysed to identify the material.</p>
      )}
    </div>
  );
}

// ── FallbackBanner (redesigned) ───────────────────────────────────────────────

function FallbackBanner() {
  return (
    <div className={s.fallbackBanner}>
      <div className={s.fallbackBannerIcon}>⚡</div>
      <div className={s.fallbackBannerText}>
        <div className={s.fallbackBannerTitle}>Assisted Analysis Mode</div>
        <div className={s.fallbackBannerSub}>AI vision is temporarily unavailable — answering a few quick questions will give you an accurate valuation.</div>
      </div>
    </div>
  );
}

// ── MaterialBanner ────────────────────────────────────────────────────────────

function MaterialBanner({ ai }: { ai: AIAnalysis | null | undefined }) {
  if (!ai || !ai.detectedMaterial || ai.detectedMaterial === "unknown") return null;
  const material = friendlyMaterial(ai.detectedMaterial);
  if (!material) return null;
  const level    = ai.confidence?.level ?? "low";
  const score    = ai.confidence?.score ?? 0;
  const pillCls  = level === "high" ? s.detectionPillHigh : level === "medium" ? s.detectionPillMed : s.detectionPillLow;
  return (
    <div className={s.detectionBanner}>
      <span className={s.detectionLabel}>AI Detected</span>
      <span className={s.detectionMaterial}>{material}</span>
      {ai.detectedCategory && ai.detectedCategory !== "unknown" && (
        <>
          <span className={s.detectionSep}>·</span>
          <span className={s.detectionCategory}>{capitalize(ai.detectedCategory)}</span>
        </>
      )}
      <span className={`${s.detectionPill} ${pillCls}`}>{score}% confidence</span>
    </div>
  );
}

// ── ConfidenceBadge ───────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const cls   = level === "high" ? s.confidenceHigh : level === "medium" ? s.confidenceMedium : s.confidenceLow;
  const icon  = level === "high" ? "🟢" : level === "medium" ? "🟡" : "🔴";
  const label = level === "high" ? "High Confidence" : level === "medium" ? "Medium Confidence" : "Low Confidence — verify manually";
  return (
    <div className={`${s.confidenceBadge} ${cls}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// ── AI Panel (question phase sidebar) ─────────────────────────────────────────

function AIAssistantPanel({
  qHistory, currentQ, aiInsights,
}: {
  qHistory: { q: string; a: string; type: string }[];
  currentQ: Question | null;
  aiInsights: AIAnalysis | null;
}) {
  const material  = qHistory.find(h => h.type === "material")?.a    ?? aiInsights?.detectedMaterial ?? null;
  const condition = qHistory.find(h => h.type === "condition")?.a   ?? null;
  const weight    = qHistory.find(h => h.type === "weight")?.a      ?? null;
  const purity    = qHistory.find(h => h.type === "purity")?.a      ?? null;
  const confidence = aiInsights?.confidence?.score
    ?? (qHistory.length > 0 ? Math.min(72 + qHistory.length * 5, 95) : 60);

  const nodes = [
    { label: "Material",  value: material  ? capitalize(material)  : null },
    { label: "Condition", value: condition ? capitalize(condition) : null },
    { label: "Weight",    value: weight    ? `${weight} kg`        : null },
    { label: "Purity",    value: purity    ? capitalize(purity)    : null },
    { label: "Market",    value: material  ? "Detected"            : null },
  ].filter(n => n.value);

  return (
    <div className={s.memoryPanel}>
      <div className={s.memoryPanelTitle}><span>🧠</span> AI Memory Timeline</div>
      {nodes.length === 0 ? (
        <p className={s.memoryEmpty}>Nothing learned yet — answer below to begin.</p>
      ) : (
        <div className={s.memoryList}>
          {nodes.map((n, i) => (
            <div key={n.label} className={s.memoryNode} style={{ animationDelay: `${i * 90}ms` }}>
              <div className={s.memoryNodeDotCol}>
                <div className={s.memoryNodeDot}>✓</div>
                {i < nodes.length - 1 && <div className={s.memoryNodeLine} />}
              </div>
              <div className={s.memoryNodeBody}>
                <div className={s.memoryNodeLabel}>{n.label}</div>
                <div className={s.memoryNodeValue}>{n.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={s.memoryConfBar}>
        <div className={s.memoryConfLabel}>
          <span>Confidence</span>
          <span className={s.memoryConfValue}>{confidence}%</span>
        </div>
        <div className={s.memoryConfTrack}>
          <div className={s.memoryConfFill} style={{ width: `${confidence}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── AICoreOrb (analyzing phase centerpiece) ──────────────────────────────────

function AICoreOrb() {
  const particles = [
    { left: "20%", top: "15%", delay: "0s",   px: "22px", py: "-30px" },
    { left: "75%", top: "20%", delay: "0.6s", px: "-18px", py: "-28px" },
    { left: "12%", top: "65%", delay: "1.2s", px: "26px", py: "20px"  },
    { left: "82%", top: "70%", delay: "1.8s", px: "-24px", py: "24px" },
    { left: "50%", top: "8%",  delay: "2.4s", px: "10px",  py: "-32px" },
  ];
  return (
    <div className={s.orbWrap}>
      <div className={s.orbRing} />
      <div className={s.orbRing2} />
      {particles.map((p, i) => (
        <span
          key={i}
          className={s.orbParticle}
          style={{
            left: p.left, top: p.top, animationDelay: p.delay,
            "--px": p.px, "--py": p.py,
          } as React.CSSProperties}
        />
      ))}
      <div className={s.orbCore}>
        <div className={s.orbCoreInner} />
      </div>
    </div>
  );
}

// ── LiveFeed (rotating intelligence messages) ────────────────────────────────

function LiveFeed() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % AI_INSIGHTS.length); setVisible(true); }, 280);
    }, 1500);
    return () => clearInterval(iv);
  }, []);

  return (
    <p
      key={idx}
      className={s.feedText}
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.26s ease" }}
    >
      {AI_INSIGHTS[idx]}
    </p>
  );
}

// ── ConfidenceCounter (single animated metric) ───────────────────────────────

function ConfidenceCounter({ step }: { step: number }) {
  const idx = Math.min(step, CONFIDENCE_RAMP.length - 1);
  const value = CONFIDENCE_RAMP[idx];
  return (
    <div className={s.confCounterWrap}>
      <span className={s.confCounterValue}>{value}%</span>
      <span className={s.confCounterLabel}>Valuation Confidence</span>
    </div>
  );
}

// ── IntelligenceTimeline (vertical step rail) ────────────────────────────────

function IntelligenceTimeline({ step }: { step: number }) {
  return (
    <div className={s.timelineWrap}>
      {ANALYSIS_STEPS.map((st, i) => {
        const done   = i < step;
        const active = i === step;
        const dotCls = done ? s.timelineDotDone : active ? s.timelineDotActive : s.timelineDotPending;
        const lblCls = done ? s.timelineLabelDone : active ? s.timelineLabelActive : "";
        return (
          <div key={st.key} className={s.timelineRow} style={{ animationDelay: `${i * 70}ms` }}>
            <div className={s.timelineDotCol}>
              <div className={`${s.timelineDot} ${dotCls}`}>{done ? "✓" : active ? "⚡" : ""}</div>
              {i < ANALYSIS_STEPS.length - 1 && (
                <div className={`${s.timelineConnector} ${done ? s.timelineConnectorDone : ""}`}>
                  {active && <div className={s.timelineConnectorBeam} />}
                </div>
              )}
            </div>
            <span className={`${s.timelineLabel} ${lblCls}`}>{st.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── MaterialProbability (live-feel processing visual) ────────────────────────

function MaterialProbability({ step }: { step: number }) {
  // Animates toward an illustrative split while the engine call is in flight.
  // Purely motion — the real detected material/confidence is shown once the
  // actual result/aiAnalysis arrives.
  const t = Math.min(step / (ANALYSIS_STEPS.length - 1), 1);
  const rows = [
    { label: "Aluminum", pct: Math.round(38 + t * 54) },
    { label: "Steel",    pct: Math.round(22 - t * 17) },
    { label: "Copper",   pct: Math.round(14 - t * 11) },
  ];
  return (
    <div className={s.probCard}>
      <div className={s.probTitle}>Material Probability</div>
      {rows.map(r => (
        <div key={r.label} className={s.probRow}>
          <span className={s.probLabel}>{r.label}</span>
          <div className={s.probTrack}>
            <div className={s.probFill} style={{ width: `${Math.max(r.pct, 2)}%` }} />
          </div>
          <span className={s.probPct}>{Math.max(r.pct, 2)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── MarketSnapshot (live-feel processing visual) ─────────────────────────────

function MarketSnapshot() {
  return (
    <div className={s.marketGrid}>
      {DEMO_MARKET_SNAPSHOT.map(m => (
        <div key={m.label} className={s.marketCard}>
          <div className={s.marketCardLabel}>{m.label}</div>
          <div className={s.marketCardValue}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── MilestoneProgress (premium step progress) ────────────────────────────────

function MilestoneProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const nodes = Math.max(total, 1);
  return (
    <div>
      <div className={s.milestoneTrack}>
        <div className={s.milestoneLine} />
        <div className={s.milestoneLineFill} style={{ width: `calc(${pct}% * 0.96)` }} />
        {Array.from({ length: nodes }).map((_, i) => {
          const nodeCls = i < done ? s.milestoneNodeDone : i === done ? s.milestoneNodeActive : "";
          return <div key={i} className={`${s.milestoneNode} ${nodeCls}`} />;
        })}
      </div>
      <div className={s.milestoneLabel}>AI Intelligence Progress — Step {Math.min(done + 1, nodes)} of {nodes}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();

  const [user,        setUser]        = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUser(session.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
      else setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const [phase,       setPhase]       = useState<Phase>("idle");
  const [file,        setFile]        = useState<File | null>(null);
  const [preview,     setPreview]     = useState<string | null>(null);
  const [description, setDesc]        = useState("");
  const [dragActive,  setDrag]        = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [activeStep,  setActiveStep]  = useState(0);

  const [sessionId,     setSessionId]     = useState<string | null>(null);
  const [currentQ,      setCurrentQ]      = useState<Question | null>(null);
  const [ansVal,        setAnsVal]        = useState<string | number>("");
  const [qHistory,      setQHistory]      = useState<{ q: string; a: string; type: string }[]>([]);
  const [totalQuestions,setTotalQ]        = useState(5);

  const [result,      setResult]      = useState<AnalyzeResponse | null>(null);
  const [aiInsights,  setAIInsights]  = useState<AIAnalysis | null>(null);
  const [hasAI,       setHasAI]       = useState(true);

  const [feedbackVote,    setFBVote]    = useState<boolean | null>(null);
  const [feedbackNote,    setFBNote]    = useState("");
  const [feedbackSent,    setFBSent]    = useState(false);
  const [feedbackSending, setFBSend]    = useState(false);
  const [feedbackError,   setFBError]   = useState("");
  const [showFBNote,      setShowFBNote]= useState(false);

  const fileRef    = useRef<HTMLInputElement>(null);
  const restartRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { if (restartRef.current) clearTimeout(restartRef.current); }, []);

  // ── File handling ──────────────────────────────────────────────────────────

  const pickFile = useCallback((f: File) => {
    if (!ALLOWED.includes(f.type)) { setError(`Unsupported format: ${f.type}`); return; }
    if (f.size > MAX_SIZE) { setError(`File too large (${fmtBytes(f.size)}). Max 10 MB.`); return; }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const removeFile = useCallback(() => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }, [preview]);

  // ── Progress animation ─────────────────────────────────────────────────────

  async function runProgressAnimation(): Promise<void> {
    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setActiveStep(i);
      await new Promise(r => setTimeout(r, STEP_DURATION_MS[i]));
    }
  }

  // ── Result routing ─────────────────────────────────────────────────────────

  function handleRes(res: AnalyzeResponse) {
    console.log("[upload/page] Response received, status:", res.status);
    console.log("[upload/page] res.aiAnalysis:", res.aiAnalysis);
    if (res.aiAnalysis) {
      console.log("[upload/page] Setting aiInsights from response");
      setAIInsights(res.aiAnalysis);
      setHasAI(true);
    }
    if (res.status === "COMPLETE") {
      setResult(res);
      setPhase("result");
      setSessionId(null);
      setCurrentQ(null);
    } else if (res.status === "NEEDS_INPUT") {
      const newId = res.sessionId || sessionId;
      setSessionId(newId);
      setCurrentQ(res.question || null);
      setPhase("asking");
      if (res.answeredSoFar !== undefined) {
        setTotalQ(Math.max(totalQuestions, (res.answeredSoFar ?? 0) + 3));
      }
    }
  }

  // ── Analyze ────────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!file && !description.trim()) {
      setError("Please upload an image or enter a description.");
      return;
    }
    setError(""); setPhase("analyzing"); setActiveStep(0); setAIInsights(null); setHasAI(true);
    try {
      const [res] = await Promise.all([
        file
          ? analyzeWithImage(file, description.trim())
          : analyze({ description: description.trim(), userInputs: {}, imageAnalysis: null }),
        runProgressAnimation(),
      ]);
      if (!res.aiAnalysis && res.status === "NEEDS_INPUT") setHasAI(false);
      handleRes(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("SESSION_EXPIRED")) handleExpired();
      else { setError(msg || "Analysis failed. Please try again."); setPhase("error"); }
    }
  }

  // ── Answer ─────────────────────────────────────────────────────────────────

  async function submitAnswer(val?: string | number) {
    const v = val ?? ansVal;
    if (!sessionId || !currentQ) return;
    let parsed: string | number = typeof v === "string" ? v.trim() : v;
    if (currentQ.type === "weight") {
      const n = parseFloat(String(parsed));
      if (isNaN(n) || n <= 0) { setError("Enter a valid positive weight."); return; }
      parsed = n;
    }
    if (!parsed && typeof parsed === "string") { setError("Please select or enter an answer."); return; }
    setLoading(true); setError("");
    try {
      const res = await answer(sessionId, {
        type: currentQ.type,
        value: normalizeAnswer(currentQ.type, parsed),
      });
      setQHistory(h => [...h, { q: currentQ.question, a: String(parsed), type: currentQ.type }]);
      setAnsVal("");
      handleRes(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("SESSION_EXPIRED")) handleExpired();
      else setError(msg || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  // ── Session expired ────────────────────────────────────────────────────────

  function handleExpired() {
    setPhase("expired");
    setSessionId(null); setCurrentQ(null); setAnsVal("");
    if (restartRef.current) clearTimeout(restartRef.current);
    restartRef.current = setTimeout(() => { reset(); restartRef.current = null; }, 1800);
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function reset() {
    setPhase("idle"); setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null); setDesc(""); setSessionId(null); setCurrentQ(null);
    setAnsVal(""); setQHistory([]); setResult(null); setError("");
    setActiveStep(0); setLoading(false); setAIInsights(null); setHasAI(true); setTotalQ(5);
    setFBVote(null); setFBNote(""); setFBSent(false); setFBSend(false); setFBError(""); setShowFBNote(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Question input renderer ────────────────────────────────────────────────

  function renderAnswerInput() {
    if (!currentQ) return null;
    const t = currentQ.type;
    const q = currentQ.question.toLowerCase();

    if (t === "weight") return (
      <div>
        <div className={s.numberInputWrap}>
          <input
            id="weight-input" type="number"
            className={s.numberInput}
            value={ansVal}
            onChange={e => setAnsVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submitAnswer()}
            placeholder="0.0" min="0" step="0.1" autoFocus
          />
          <div className={s.unitBadge}>⚖️ kilograms (kg)</div>
        </div>
        <p className={s.unitHint}>Enter the total weight of all items</p>
      </div>
    );

    if (t === "condition") {
      if (q.includes("working")) return (
        <div className={s.optionGroup}>
          {[
            { value: "yes", label: "✅ Working",     sub: "Powers on / functional"    },
            { value: "no",  label: "❌ Not Working", sub: "Broken / non-functional"   },
          ].map(o => (
            <button key={o.value} type="button"
              className={`${s.optionBtn} ${s.premiumOptionBtn} ${ansVal === o.value ? `${s.optionBtnSelected} ${s.premiumOptionSelected}` : ""}`}
              onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
              <span>{o.label}</span>
              <span className={s.optionSub}>{o.sub}</span>
            </button>
          ))}
        </div>
      );
      return (
        <div className={s.conditionGrid}>
          {CONDITION_OPTIONS.map(o => (
            <button key={o.value} type="button"
              className={`${s.conditionBtn} ${s.premiumOptionBtn} ${ansVal === o.value ? `${s.conditionBtnSelected} ${s.premiumOptionSelected}` : ""}`}
              onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
              <span className={s.conditionEmoji}>{o.emoji}</span>
              <span className={s.conditionLabel}>{o.label}</span>
              <span className={s.conditionDesc}>{o.desc}</span>
            </button>
          ))}
        </div>
      );
    }

    if (t === "material") return (
      <div className={s.chipGroup}>
        {[
          { value: "copper",   label: "🟡 Copper"   },
          { value: "iron",     label: "⚫ Iron"      },
          { value: "steel",    label: "🛡️ Steel"    },
          { value: "aluminum", label: "🪶 Aluminum"  },
          { value: "brass",    label: "🔔 Brass"     },
          { value: "plastic",  label: "♻️ Plastic"  },
          { value: "mixed",    label: "🔗 Mixed"     },
          { value: "mixed",    label: "❓ Not Sure"  },
        ].map((m, i) => (
          <button key={m.value + i} type="button"
            className={`${s.chip} ${s.premiumOptionBtn} ${ansVal === m.value ? `${s.chipSelected} ${s.premiumOptionSelected}` : ""}`}
            onClick={() => { setAnsVal(m.value); submitAnswer(m.value); }}>
            {m.label}
          </button>
        ))}
      </div>
    );

    if (t === "purity") return (
      <div className={s.optionGroup}>
        {[
          { value: "pure",  label: "💎 Pure Metal", sub: "Single material only" },
          { value: "mixed", label: "🔗 Mixed",       sub: "Multiple materials"  },
        ].map(o => (
          <button key={o.value} type="button"
            className={`${s.optionBtn} ${s.premiumOptionBtn} ${ansVal === o.value ? `${s.optionBtnSelected} ${s.premiumOptionSelected}` : ""}`}
            onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
            <span>{o.label}</span>
            <span className={s.optionSub}>{o.sub}</span>
          </button>
        ))}
      </div>
    );

    if (t === "plasticType") return (
      <div className={s.optionGroup}>
        {[
          { value: "hard plastic", label: "🧱 Hard Plastic", sub: "Rigid — better rate"    },
          { value: "soft plastic", label: "🎈 Soft Plastic",  sub: "Flexible — lower rate" },
        ].map(o => (
          <button key={o.value} type="button"
            className={`${s.optionBtn} ${s.premiumOptionBtn} ${ansVal === o.value ? `${s.optionBtnSelected} ${s.premiumOptionSelected}` : ""}`}
            onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
            <span>{o.label}</span>
            <span className={s.optionSub}>{o.sub}</span>
          </button>
        ))}
      </div>
    );

    if (t === "cleanliness") return (
      <div className={s.optionGroup}>
        {[
          { value: "clean", label: "✨ Clean",    sub: "No oil, rust, or coating"         },
          { value: "dirty", label: "🪣 Dirty",    sub: "Contaminated or coated"            },
          { value: "dirty", label: "❓ Not Sure", sub: "Conservative — assumes dirty"      },
        ].map((o, i) => (
          <button key={o.value + i} type="button"
            className={`${s.optionBtn} ${s.premiumOptionBtn} ${ansVal === o.value ? `${s.optionBtnSelected} ${s.premiumOptionSelected}` : ""}`}
            onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
            <span>{o.label}</span>
            <span className={s.optionSub}>{o.sub}</span>
          </button>
        ))}
      </div>
    );

    if (t === "partsMissing") return (
      <div className={s.optionGroup}>
        {[
          { value: "yes", label: "⚠️ Parts Missing", sub: "Some components absent" },
          { value: "no",  label: "✅ All Intact",     sub: "Complete unit"          },
        ].map(o => (
          <button key={o.value} type="button"
            className={`${s.optionBtn} ${s.premiumOptionBtn} ${ansVal === o.value ? `${s.optionBtnSelected} ${s.premiumOptionSelected}` : ""}`}
            onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
            <span>{o.label}</span>
            <span className={s.optionSub}>{o.sub}</span>
          </button>
        ))}
      </div>
    );

    if (t === "rustSeverity") return (
      <div className={s.optionGroup}>
        {[
          { value: "minimal_rust",  label: "🟢 Minimal Rust",  sub: "Surface rust only"           },
          { value: "moderate_rust", label: "🟡 Moderate Rust", sub: "Spreading corrosion"          },
          { value: "severe_rust",   label: "🔴 Severe Rust",   sub: "Heavy corrosion throughout"   },
        ].map(o => (
          <button key={o.value} type="button"
            className={`${s.optionBtn} ${s.premiumOptionBtn} ${ansVal === o.value ? `${s.optionBtnSelected} ${s.premiumOptionSelected}` : ""}`}
            onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
            <span>{o.label}</span>
            <span className={s.optionSub}>{o.sub}</span>
          </button>
        ))}
      </div>
    );

    if (t === "subtype") {
      const matFromHistory = (qHistory.find(h => h.type === "material")?.a || "").toLowerCase().trim();
      const qText = (currentQ?.question || "").toLowerCase();
      const mat = matFromHistory
        || (qText.includes("copper")   ? "copper"
          : qText.includes("aluminum") ? "aluminum"
          : qText.includes("iron")     ? "iron"
          : qText.includes("brass")    ? "brass"
          : qText.includes("steel")    ? "steel"
          : qText.includes("plastic")  ? "plastic"
          : "unknown");

      const SUBTYPE_OPTS: Record<string, Array<{ value: string; label: string; sub: string }>> = {
        copper:   [
          { value: "bare",      label: "🔌 Bare Copper",    sub: "Uninsulated wire or scrap"         },
          { value: "insulated", label: "🧵 Insulated Wire",  sub: "Copper with plastic coating"        },
          { value: "insulated", label: "❓ Not Sure",         sub: "Conservative — assumes insulated"  },
        ],
        aluminum: [
          { value: "pure",  label: "💎 Pure Aluminum",  sub: "Single material"          },
          { value: "mixed", label: "🔗 Mixed Aluminum", sub: "Mixed with other metals"  },
          { value: "cans",  label: "🥫 Cans",           sub: "Beverage or food cans"    },
          { value: "mixed", label: "❓ Not Sure",         sub: "Conservative — assumes mixed" },
        ],
        iron: [
          { value: "light", label: "📦 Light Iron",  sub: "Thin sheets, pipes"          },
          { value: "heavy", label: "🏋️ Heavy Iron",  sub: "Thick blocks, machinery"     },
          { value: "cast",  label: "⚙️ Cast Iron",   sub: "Cookware, engine blocks"     },
          { value: "light", label: "❓ Not Sure",      sub: "Conservative — assumes light" },
        ],
        brass: [
          { value: "pure",  label: "💎 Pure Brass",  sub: "Single material only"  },
          { value: "mixed", label: "🔗 Mixed Brass", sub: "With other metals"      },
          { value: "mixed", label: "❓ Not Sure",      sub: "Conservative — assumes mixed" },
        ],
        steel: [
          { value: "stainless", label: "✨ Stainless",   sub: "Corrosion resistant"    },
          { value: "mild",      label: "⚫ Mild Steel",   sub: "Standard carbon steel"  },
          { value: "mild",      label: "❓ Not Sure",      sub: "Conservative — assumes mild" },
        ],
        plastic: [
          { value: "hard", label: "🧱 Hard Plastic", sub: "Rigid — better rate"   },
          { value: "soft", label: "🎈 Soft Plastic", sub: "Flexible — lower rate" },
          { value: "soft", label: "❓ Not Sure",       sub: "Conservative — assumes soft" },
        ],
      };
      const defaultOpts = [
        { value: "mixed_metals",  label: "🔗 Mixed Metals",  sub: "Multiple metal types"  },
        { value: "mixed_general", label: "📦 Mixed General", sub: "Various materials"      },
        { value: "mixed_general", label: "❓ Not Sure",       sub: "Conservative estimate" },
      ];
      const opts = SUBTYPE_OPTS[mat] ?? defaultOpts;
      return (
        <div className={s.conditionGrid}>
          {opts.map((o, i) => (
            <button key={o.value + i} type="button"
              className={`${s.conditionBtn} ${s.premiumOptionBtn} ${ansVal === o.value ? `${s.conditionBtnSelected} ${s.premiumOptionSelected}` : ""}`}
              onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
              <span className={s.conditionLabel}>{o.label}</span>
              <span className={s.conditionDesc}>{o.sub}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <input type="text" className={s.textInput}
        value={ansVal}
        onChange={e => setAnsVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submitAnswer()}
        placeholder="Type your answer…"
        autoFocus
      />
    );
  }

  const needsSubmitBtn = currentQ && (
    currentQ.type === "weight" ||
    !["condition","purity","material","plasticType","cleanliness","partsMissing","subtype","rustSeverity"].includes(currentQ.type)
  );

  const stepsDone  = qHistory.length;
  const stepsTotal = Math.max(totalQuestions, stepsDone + (currentQ ? 1 : 0));

  // ── Auth guard ─────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F7F3" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: "dFloat 2s ease-in-out infinite" }}>🧠</div>
          <span style={{ color: "#64748B", fontSize: ".9rem" }}>Loading AI Intelligence Lab…</span>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <main className={s.main}>

        {/* ═══════════════════════════════════════════════════════════
            IDLE — Upload Experience
        ════════════════════════════════════════════════════════════ */}
        {phase === "idle" && (
          <>
            {/* Hero — image-first, becomes the app's main moment */}
            <div className={s.heroCard}>
              <div className={s.heroGlowA} />
              <div className={s.heroGlowB} />

              <div className={s.heroEyebrow}>
                <LivePulse color="#059669" />
                {file ? "Scrap Ready For Analysis" : "AI Valuation Engine"}
              </div>

              <h1 className={s.heroTitle}>
                {file ? "SCRAP READY FOR ANALYSIS" : "Upload Your Scrap"}
              </h1>
              <p className={s.heroSubtitle}>
                {file
                  ? "AI valuation engine prepared and connected to live market intelligence."
                  : "Drag & drop a clear photo — our AI identifies the material and delivers a market-backed estimate in seconds."}
              </p>

              {/* Drop zone or showcase preview */}
              {!file ? (
                <div
                  className={`${s.uploadZone} ${dragActive ? s.uploadZoneDragging : ""}`}
                  onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={e => { e.preventDefault(); setDrag(false); }}
                  onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
                  onClick={() => fileRef.current?.click()}
                  role="button" tabIndex={0} aria-label="Upload scrap image"
                  onKeyDown={e => e.key === "Enter" && fileRef.current?.click()}
                  style={{ position: "relative", zIndex: 1 }}
                >
                  <span className={s.uploadIcon}>{dragActive ? "📂" : "📷"}</span>
                  <p className={s.uploadLabel}>
                    {dragActive ? "Drop it here — AI is ready!" : <><strong>Browse or drag</strong> your scrap photo here</>}
                  </p>
                  <p className={s.uploadHint}>Takes 5–10 seconds · Works best with clear, well-lit photos</p>
                  <div className={s.uploadFormats}>
                    {["JPEG", "PNG", "WebP", "GIF"].map(f => (
                      <span key={f} className={s.uploadFormatPill}>{f}</span>
                    ))}
                    <span className={s.uploadFormatPill}>Max 10 MB</span>
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                    className={s.fileInput} onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
                </div>
              ) : (
                <div className={s.showcaseWrap}>
                  <div className={s.showcaseBorderGlow} />
                  <div className={s.showcaseImgFrame}>
                    {preview && <img src={preview} alt="Scrap preview" className={s.showcaseImg} />}
                    <div className={s.showcaseOverlay} />
                    <div className={s.showcasePillRow}>
                      {["✓ Image Verified", "✓ AI Ready", "✓ Market Connected", "✓ Valuation Engine Active"].map((p, i) => (
                        <span key={p} className={s.showcasePill} style={{ animationDelay: `${i * 110}ms` }}>
                          <span className={s.showcasePillDot} />
                          {p}
                        </span>
                      ))}
                    </div>
                    <div className={s.showcaseFooter}>
                      <div className={s.showcaseMeta}>
                        <span className={s.showcaseName}>{file.name}</span>
                        <span className={s.showcaseSize}>{fmtBytes(file.size)}</span>
                      </div>
                      <button type="button" className={s.showcaseRemoveBtn} onClick={removeFile} title="Remove image" aria-label="Remove uploaded image">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className={s.descGroup} style={{ position: "relative", zIndex: 1 }}>
                <label className={s.descLabel} htmlFor="desc-input">
                  Description {!file && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
                </label>
                <textarea id="desc-input" className={s.descInput}
                  value={description} onChange={e => setDesc(e.target.value)}
                  placeholder='e.g. "Copper wire bundle, about 2 kg" or "Old ceiling fan, broken motor"'
                  rows={3} />
              </div>

              <button id="analyze-btn" type="button" className={s.magneticBtn}
                onClick={handleAnalyze} disabled={loading}>
                {loading
                  ? <><span className={s.spinner} />Analysing…</>
                  : <>Get AI Estimate <span className={s.magneticBtnArrow}>→</span></>}
              </button>

              {error && <p className={s.errorMsg} role="alert" style={{ position: "relative", zIndex: 1 }}>{error}</p>}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ANALYZING — AI Processing Experience
        ════════════════════════════════════════════════════════════ */}
        {phase === "analyzing" && (
          <section className={`${s.card} ${s.engineCard}`}>
            <div className={s.engineEyebrow}>
              <LivePulse color="#6D28D9" />
              ScrapIQ Intelligence Engine
            </div>
            <h2 className={s.engineTitle}>Thinking through your scrap…</h2>

            <AICoreOrb />
            <LiveFeed />
            <ConfidenceCounter step={activeStep} />
            <IntelligenceTimeline step={activeStep} />
            <MaterialProbability step={activeStep} />
            <MarketSnapshot />
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ASKING (with AI) — PostDetectionFlow
        ════════════════════════════════════════════════════════════ */}
        {phase === "asking" && currentQ && aiInsights && (
          <>
            {console.log("[upload/page] Rendering PostDetectionFlow. phase=asking, currentQ exists, aiInsights exists")}
            <section className={s.card}>
              <PostDetectionFlow
                ai={aiInsights}
                currentQuestion={currentQ}
                loading={loading}
                error={error}
                answeredHistory={qHistory}
                totalQuestions={totalQuestions}
                onSubmitAnswer={submitAnswer}
              />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ASKING (fallback) — Manual question flow
        ════════════════════════════════════════════════════════════ */}
        {phase === "asking" && currentQ && !aiInsights && (
          <>
            {console.log("[upload/page] Falling back to traditional mode. phase=asking, currentQ exists, BUT aiInsights is NULL/UNDEFINED")}

            <FallbackBanner />

            <section className={`${s.card} ${s.questionCard}`}>
              {/* AI Intelligence Progress — milestone system */}
              <MilestoneProgress done={stepsDone} total={stepsTotal} />
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div className={`${s.categoryBadge} ${badgeClass(currentQ.category)}`}>
                  {catEmoji(currentQ.category)} {currentQ.category}
                </div>
                <span className={s.questionStep}>Step {stepsDone + 1} of ~{stepsTotal}</span>
              </div>

              {/* Two-column layout: question + AI sidebar */}
              <div className={s.questionLayout}>
                <div className={s.questionMain}>
                  {/* Answered history */}
                  {qHistory.length > 0 && (
                    <div className={s.answeredHistory}>
                      {qHistory.map((h, i) => (
                        <div key={i} className={s.answeredItem}>
                          <span className={s.answeredCheck}>✓</span>
                          <span className={s.answeredLabel}>{h.q}</span>
                          <span className={s.answeredVal}>{h.a}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className={s.questionText}>{currentQ.question}</p>

                  {renderAnswerInput()}

                  {needsSubmitBtn && (
                    <button id="answer-btn" type="button" className={s.magneticBtn}
                      onClick={() => submitAnswer()} disabled={loading}>
                      {loading ? <><span className={s.spinner} />Processing…</> : <>Continue <span className={s.magneticBtnArrow}>→</span></>}
                    </button>
                  )}

                  {error && <p className={s.errorMsg} role="alert">{error}</p>}
                </div>

                {/* AI knows sidebar */}
                <AIAssistantPanel qHistory={qHistory} currentQ={currentQ} aiInsights={aiInsights} />
              </div>
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            RESULT
        ════════════════════════════════════════════════════════════ */}
        {phase === "result" && result && (
          <AnalysisResult
            result={result}
            aiInsights={aiInsights}
            preview={preview}
            onReset={reset}
            feedbackSlot={
              feedbackSent ? (
                <p className={s.feedbackSuccess}>✓ Thanks for your feedback!</p>
              ) : (
                <div>
                  <div className={s.feedbackRow}>
                    <button type="button"
                      className={`${s.feedbackBtn} ${feedbackVote === true ? s.feedbackBtnActive : ""}`}
                      onClick={() => { setFBVote(true); setShowFBNote(true); }}
                      disabled={feedbackSending}>
                      👍 Accurate
                    </button>
                    <button type="button"
                      className={`${s.feedbackBtn} ${feedbackVote === false ? s.feedbackBtnBad : ""}`}
                      onClick={() => { setFBVote(false); setShowFBNote(true); }}
                      disabled={feedbackSending}>
                      👎 Not accurate
                    </button>
                  </div>
                  {showFBNote && feedbackVote !== null && (
                    <div className={s.feedbackInputRow}>
                      <input type="text" className={s.feedbackInput}
                        placeholder="Optional note (e.g. actual price received)"
                        value={feedbackNote}
                        onChange={e => setFBNote(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === "Enter" && feedbackVote !== null && !feedbackSending) {
                            setFBSend(true);
                            try {
                              await submitFeedback({ analysis_id: result?.analysis_id ?? "unknown", is_accurate: feedbackVote, note: feedbackNote.trim() || undefined });
                              setFBSent(true);
                            } catch { setFBError("Failed to send feedback"); }
                            finally { setFBSend(false); }
                          }
                        }}
                      />
                      <button type="button" className={s.feedbackSubmit} disabled={feedbackSending}
                        onClick={async () => {
                          if (feedbackVote === null) return;
                          setFBSend(true);
                          try {
                            await submitFeedback({ analysis_id: result?.analysis_id ?? "unknown", is_accurate: feedbackVote, note: feedbackNote.trim() || undefined });
                            setFBSent(true);
                          } catch { setFBError("Failed to send feedback"); }
                          finally { setFBSend(false); }
                        }}>
                        {feedbackSending ? "…" : "Send"}
                      </button>
                    </div>
                  )}
                  {feedbackError && <p className={s.errorMsg}>{feedbackError}</p>}
                </div>
              )
            }
          />
        )}

        {/* ═══════════════════════════════════════════════════════════
            ERROR
        ════════════════════════════════════════════════════════════ */}
        {phase === "error" && (
          <section className={`${s.card} ${s.errorCard}`}>
            <div className={s.errorEmoji}>⚠️</div>
            <div className={s.errorTitle}>Analysis Unavailable</div>
            <div className={s.errorBody}>{error || "Something went wrong during analysis."}</div>
            <div className={s.errorNote}>Your image was not lost — please try again.</div>
            <button type="button" className={s.primaryBtn} onClick={reset}>Try Again →</button>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════
            SESSION EXPIRED
        ════════════════════════════════════════════════════════════ */}
        {phase === "expired" && (
          <section className={`${s.card} ${s.expiredCard}`}>
            <div className={s.expiredIcon}>🔄</div>
            <div className={s.expiredTitle}>Session Timed Out</div>
            <div className={s.expiredBody}>Restarting automatically…</div>
          </section>
        )}

      </main>

      <style>{`
        @keyframes dFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes dRipple { 0%{transform:scale(0.7);opacity:0.5} 100%{transform:scale(2.4);opacity:0} }
      `}</style>
    </div>
  );
}