"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { analyzeWithImage, analyze, answer, submitFeedback, type AnalyzeResponse, type Question } from "../../lib/api";
import { normalizeAnswer } from "../../lib/normalizer";
import { supabase } from "../../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import s from "./upload.module.css";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const STEPS = [
  { key: "upload", label: "Uploading image…", icon: "📤" },
  { key: "analyze", label: "Analyzing image…", icon: "🔍" },
  { key: "detect", label: "Detecting material…", icon: "🧪" },
  { key: "evaluate", label: "Evaluating condition…", icon: "📊" },
  { key: "prepare", label: "Preparing estimate…", icon: "💰" },
];

// ── SESSION_EXPIRED Detection ─────────────────────────────────────────────────
function isSessionExpired(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("SESSION_EXPIRED");
  }
  return String(error).includes("SESSION_EXPIRED");
}

// Phase 11: Condition options with labels/emojis — replaces free text
const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent", emoji: "✨", desc: "Like new" },
  { value: "good", label: "Good", emoji: "👍", desc: "Light wear" },
  { value: "worn", label: "Worn", emoji: "🔧", desc: "Visible use" },
  { value: "damaged", label: "Damaged", emoji: "⚠️", desc: "Clear damage" },
  { value: "heavily_damaged", label: "Heavy Damage", emoji: "🔴", desc: "Major damage" },
];

type Phase = "input" | "analyzing" | "asking" | "result" | "error" | "session-expired";
type ConfidenceLevel = "high" | "medium" | "low";

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function badgeClass(cat: string) {
  if (cat === "metal") return s.badgeMetal;
  if (cat === "electronics") return s.badgeElectronics;
  if (cat === "plastic") return s.badgePlastic;
  return s.badgeUnknown;
}

function catEmoji(cat: string) {
  if (cat === "metal") return "⚙️";
  if (cat === "electronics") return "🔌";
  if (cat === "plastic") return "♻️";
  return "📦";
}

// Phase 11: Confidence badge rendering
function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config = {
    high: { cls: s.confidenceHigh, icon: "🟢", label: "High Confidence" },
    medium: { cls: s.confidenceMedium, icon: "🟡", label: "Medium Confidence" },
    low: { cls: s.confidenceLow, icon: "🔴", label: "Low Confidence — verify manually" },
  };
  const c = config[level] ?? config.low;
  return (
    <div className={`${s.confidenceBadge} ${c.cls}`}>
      <span>{c.icon}</span>
      <span>{c.label}</span>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();

  // ── Auth state ────────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const [phase, setPhase] = useState<Phase>("input");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [ansVal, setAnsVal] = useState<string | number>("");
  const [qHistory, setQHistory] = useState<{ q: string; a: string; type: string }[]>([]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Feedback state ────────────────────────────────────────────────────────
  const [feedbackVote, setFeedbackVote] = useState<boolean | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [showFeedbackNote, setShowFeedbackNote] = useState(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pickFile = useCallback((f: File) => {
    if (!ALLOWED.includes(f.type)) { setError(`Invalid type: ${f.type}`); return; }
    if (f.size > MAX_SIZE) { setError(`File too large (${fmtBytes(f.size)}). Max 10 MB.`); return; }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);

  // ── Cleanup restart timeout on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  const removeFile = useCallback(() => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }, [preview]);

  // ── Handle SESSION_EXPIRED ───────────────────────────────────────────────
  function handleSessionExpired() {
    setPhase("session-expired");
    setError("Session expired. Restarting...");
    setSessionId(null);
    setCurrentQ(null);
    setAnsVal("");
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    restartTimeoutRef.current = setTimeout(() => {
      reset();
      restartTimeoutRef.current = null;
    }, 1000);
  }

  // ── Analyze ──────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!file && !description.trim()) { setError("Please upload an image or enter a description."); return; }
    setError(""); setPhase("analyzing"); setActiveStep(0);
    try {
      const stepsP = (async () => { for (let i = 0; i < STEPS.length; i++) { setActiveStep(i); await new Promise(r => setTimeout(r, 400)); } })();
      const userId = user?.id;
      const res = file
        ? await analyzeWithImage(file, description.trim(), userId)
        : await analyze({ description: description.trim(), userInputs: {}, imageAnalysis: null }, userId);
      await stepsP;
      handleRes(res);
    } catch (e: unknown) {
      if (isSessionExpired(e)) {
        handleSessionExpired();
      } else {
        setError(e instanceof Error ? e.message : "Analysis failed");
        setPhase("error");
      }
    }
  }

  // ── Answer ───────────────────────────────────────────────────────────────
  async function submitAnswer(val?: string | number) {
    const v = val ?? ansVal;
    if (!sessionId || !currentQ) return;
    let parsed: string | number = typeof v === "string" ? v.trim() : v;
    if (currentQ.type === "weight") { const n = parseFloat(String(parsed)); if (isNaN(n) || n <= 0) { setError("Enter a valid positive number."); return; } parsed = n; }
    if (!parsed && typeof parsed === "string") { setError("Please provide an answer."); return; }
    setLoading(true); setError("");
    try {
      const res = await answer(sessionId, { type: currentQ.type, value: normalizeAnswer(currentQ.type, parsed) }, user?.id);
      setQHistory(h => [...h, { q: currentQ.question, a: String(parsed), type: currentQ.type }]);
      setAnsVal("");
      handleRes(res);
    } catch (e: unknown) {
      if (isSessionExpired(e)) {
        handleSessionExpired();
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    }
    finally { setLoading(false); }
  }

  function handleRes(res: AnalyzeResponse) {
    if (res.status === "COMPLETE") { setResult(res); setPhase("result"); setSessionId(null); setCurrentQ(null); }
    else if (res.status === "NEEDS_INPUT") { setSessionId(res.sessionId || sessionId); setCurrentQ(res.question || null); setPhase("asking"); }
  }

  function reset() {
    setPhase("input"); setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null);
    setDescription(""); setSessionId(null); setCurrentQ(null); setAnsVal(""); setQHistory([]); setResult(null); setError(""); setActiveStep(0); setLoading(false);
    setFeedbackVote(null); setFeedbackNote(""); setFeedbackSent(false); setFeedbackSending(false); setFeedbackError(""); setShowFeedbackNote(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Question input renderer ──────────────────────────────────────────────
  function renderInput() {
    if (!currentQ) return null;
    const t = currentQ.type;
    const q = currentQ.question.toLowerCase();

    if (t === "weight") return (
      <div>
        <input id="weight-input" type="number" className={s.numberInput} value={ansVal}
          onChange={e => setAnsVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitAnswer()}
          placeholder="0.00" min="0" step="0.1" autoFocus />
        <p className={s.unitHint}>Weight in kilograms (kg)</p>
      </div>
    );

    if (t === "condition") {
      if (q.includes("working")) return (
        <div className={s.optionGroup}>
          {[
            { value: "yes", label: "✅ Working", sub: "Powers on" },
            { value: "no", label: "❌ Not Working", sub: "Dead / broken" },
          ].map(o => (
            <button key={o.value} className={`${s.optionBtn} ${ansVal === o.value ? s.optionBtnSelected : ""}`}
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
            <button key={o.value}
              className={`${s.conditionBtn} ${ansVal === o.value ? s.conditionBtnSelected : ""}`}
              onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
              <span className={s.conditionEmoji}>{o.emoji}</span>
              <span className={s.conditionLabel}>{o.label}</span>
              <span className={s.conditionDesc}>{o.desc}</span>
            </button>
          ))}
        </div>
      );
    }

    if (t === "purity") return (
      <div className={s.optionGroup}>
        {[
          { value: "pure", label: "💎 Pure Metal", sub: "Single material" },
          { value: "mixed", label: "🔗 Mixed", sub: "Multiple materials" },
        ].map(o => (
          <button key={o.value} className={`${s.optionBtn} ${ansVal === o.value ? s.optionBtnSelected : ""}`}
            onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
            <span>{o.label}</span>
            <span className={s.optionSub}>{o.sub}</span>
          </button>
        ))}
      </div>
    );

    if (t === "material") return (
      <div className={s.chipGroup}>
        {["copper", "iron", "steel", "aluminum", "plastic"].map(o => (
          <button key={o} className={`${s.chip} ${ansVal === o ? s.chipSelected : ""}`}
            onClick={() => { setAnsVal(o); submitAnswer(o); }}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </button>
        ))}
      </div>
    );

    if (t === "plasticType") return (
      <div className={s.optionGroup}>
        {[
          { value: "hard plastic", label: "🧱 Hard Plastic", sub: "Rigid — better rate" },
          { value: "soft plastic", label: "🎈 Soft Plastic", sub: "Flexible — lower rate" },
        ].map(o => (
          <button key={o.value} className={`${s.optionBtn} ${ansVal === o.value ? s.optionBtnSelected : ""}`}
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
          { value: "clean", label: "✨ Clean", sub: "Ready to recycle" },
          { value: "dirty", label: "🪣 Dirty", sub: "Needs cleaning" },
        ].map(o => (
          <button key={o.value} className={`${s.optionBtn} ${ansVal === o.value ? s.optionBtnSelected : ""}`}
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
          { value: "yes", label: "⚠️ Yes, Parts Missing", sub: "Incomplete" },
          { value: "no", label: "✅ No, All Intact", sub: "Complete unit" },
        ].map(o => (
          <button key={o.value} className={`${s.optionBtn} ${ansVal === o.value ? s.optionBtnSelected : ""}`}
            onClick={() => { setAnsVal(o.value); submitAnswer(o.value); }}>
            <span>{o.label}</span>
            <span className={s.optionSub}>{o.sub}</span>
          </button>
        ))}
      </div>
    );

    return (
      <input type="text" className={s.textInput} value={ansVal}
        onChange={e => setAnsVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submitAnswer()}
        placeholder="Type your answer…" autoFocus />
    );
  }

  const needsSubmitBtn = currentQ && (currentQ.type === "weight" || !["condition", "purity", "material", "plasticType", "cleanliness", "partsMissing"].includes(currentQ.type));

  // ── Auth loading guard ────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <span style={{ color: "#94a3b8", fontSize: "1rem" }}>Loading…</span>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.logo}>ScrapIQ</h1>
        <p className={s.tagline}>Smart scrap valuation assistant</p>
        {/* Auth bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
          {user && (
            <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
              {user.email}
            </span>
          )}
          <a href="/history" style={{ color: "var(--accent)", fontSize: "0.82rem", textDecoration: "none", fontWeight: 500 }}>
            History →
          </a>
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.8rem",
              padding: "0.3rem 0.7rem",
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className={s.main}>
        {/* INPUT */}
        {phase === "input" && (
          <section className={s.card}>
            <h2 className={s.cardTitle}>{file ? "Ready to Analyze" : "Upload Your Scrap"}</h2>

            {!file ? (
              <div id="dropzone" className={`${s.dropzone} ${dragActive ? s.dropzoneActive : ""}`}
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
                onDrop={e => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
                onClick={() => fileRef.current?.click()}>
                <span className={s.dropzoneIcon}>📷</span>
                <p className={s.dropzoneLabel}>Drag & drop your image here, or <strong>browse</strong></p>
                <p className={s.dropzoneHint}>JPEG, PNG, WebP, GIF • Max 10 MB</p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                  className={s.fileInput} onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
              </div>
            ) : (
              <div className={s.preview}>
                {preview && <img src={preview} alt="Scrap preview" className={s.previewImg} />}
                <div className={s.previewOverlay}>
                  <div className={s.previewInfo}>
                    <span className={s.previewName}>{file.name}</span>
                    <span className={s.previewSize}>{fmtBytes(file.size)}</span>
                  </div>
                  <button className={s.removeBtn} onClick={removeFile} title="Remove image">✕</button>
                </div>
              </div>
            )}

            <div className={s.descGroup}>
              <label className={s.descLabel} htmlFor="desc-input">Description {!file && "(required if no image)"}</label>
              <textarea id="desc-input" className={s.descInput} value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder='e.g. "2kg copper wire rusted" or "old ceiling fan broken"' rows={3} />
            </div>

            <button id="analyze-btn" className={s.primaryBtn} onClick={handleAnalyze} disabled={loading}>
              {loading ? <><span className={s.spinner} /> Analyzing…</> : "Get Estimate →"}
            </button>
            {error && <p className={s.errorMsg}>{error}</p>}
          </section>
        )}

        {/* ANALYZING */}
        {phase === "analyzing" && (
          <section className={s.card}>
            <h2 className={s.cardTitle}>Analyzing your scrap…</h2>
            <div className={s.stepsWrap}>
              {STEPS.map((st, i) => {
                const cls = i < activeStep ? `${s.step} ${s.stepDone}` : i === activeStep ? `${s.step} ${s.stepActive}` : `${s.step} ${s.stepPending}`;
                const ico = i < activeStep ? `${s.stepIcon} ${s.stepIconDone}` : i === activeStep ? `${s.stepIcon} ${s.stepIconActive}` : `${s.stepIcon} ${s.stepIconPending}`;
                return (
                  <div key={st.key} className={cls}>
                    <div className={ico}>{i < activeStep ? "✓" : st.icon}</div>
                    <span className={s.stepLabel}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* QUESTION */}
        {phase === "asking" && currentQ && (
          <section className={`${s.card} ${s.questionCard}`}>
            <div className={`${s.badge} ${badgeClass(currentQ.category)}`}>{catEmoji(currentQ.category)} {currentQ.category}</div>

            {qHistory.length > 0 && (
              <div className={s.history}>
                {qHistory.map((h, i) => (
                  <div key={i} className={s.historyItem}>
                    <span className={s.historyCheck}>✓</span>
                    <span className={s.historyLabel}>{h.q}</span>
                    <span className={s.historyValue}>{h.a}</span>
                  </div>
                ))}
              </div>
            )}

            <p className={s.questionText}>{currentQ.question}</p>
            {renderInput()}

            {needsSubmitBtn && (
              <button id="answer-btn" className={s.primaryBtn} onClick={() => submitAnswer()} disabled={loading}>
                {loading ? <><span className={s.spinner} /> Processing…</> : "Continue →"}
              </button>
            )}
            {error && <p className={s.errorMsg}>{error}</p>}
          </section>
        )}

        {/* RESULT */}
        {phase === "result" && result && (
          <section className={`${s.card} ${s.resultCard}`}>
            <div className={s.resultHeader}>
              <div className={s.resultIcon}>✓</div>
              <div>
                <div className={s.resultTitle}>Estimation Complete</div>
                <div className={s.resultSubtitle}>Your scrap has been valued</div>
              </div>
            </div>

            {result.confidenceLevel && (
              <ConfidenceBadge level={result.confidenceLevel as ConfidenceLevel} />
            )}

            {result.pricing && (
              <div className={s.finalPrice}>
                <div className={s.finalPriceLabel}>Estimated Scrap Value</div>
                <div className={s.finalPriceValue}>₹{result.pricing.finalPrice}</div>
                <div className={s.finalPriceCurrency}>Indian Rupees (INR)</div>
              </div>
            )}

            <div className={s.section}>
              <div className={s.sectionLabel}>Item Details</div>
              <div className={s.detailsGrid}>
                <div className={s.detailItem}><div className={s.detailLabel}>Material</div><div className={s.detailValue}>{result.data?.material || "—"}</div></div>
                <div className={s.detailItem}><div className={s.detailLabel}>Weight</div><div className={s.detailValue}>{result.data?.weight ? `${result.data.weight} kg` : "—"}</div></div>
                <div className={s.detailItem}><div className={s.detailLabel}>Condition</div><div className={s.detailValue}>{result.data?.condition || "—"}</div></div>
                <div className={s.detailItem}><div className={s.detailLabel}>Category</div><div className={s.detailValue}>{result.category || "—"}</div></div>
              </div>
            </div>

            {result.pricing?.richExplanation && (
              <div className={s.section}>
                <div className={s.sectionLabel}>Why This Price</div>

                <div className={s.explainSummary}>
                  💡 {result.pricing.richExplanation.summary}
                </div>

                {result.pricing.richExplanation.positives?.length > 0 && (
                  <div className={s.explainBlock}>
                    <div className={s.explainBlockTitle}>
                      <span className={s.explainIconPositive}>▲</span> Value Factors
                    </div>
                    {result.pricing.richExplanation.positives.map((p: string, i: number) => (
                      <div key={i} className={`${s.explainItem} ${s.explainItemPositive}`}>
                        <span className={s.explainIcon}>✅</span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}

                {result.pricing.richExplanation.negatives?.length > 0 && (
                  <div className={s.explainBlock}>
                    <div className={s.explainBlockTitle}>
                      <span className={s.explainIconNegative}>▼</span> Reducing Factors
                    </div>
                    {result.pricing.richExplanation.negatives.map((n: string, i: number) => (
                      <div key={i} className={`${s.explainItem} ${s.explainItemNegative}`}>
                        <span className={s.explainIcon}>⚠️</span>
                        <span>{n}</span>
                      </div>
                    ))}
                  </div>
                )}

                {result.pricing.richExplanation.tips?.length > 0 && (
                  <div className={s.explainBlock}>
                    <div className={s.explainBlockTitle}>
                      <span>💡</span> How to Improve Your Value
                    </div>
                    {result.pricing.richExplanation.tips.map((t: string, i: number) => (
                      <div key={i} className={`${s.explainItem} ${s.explainItemTip}`}>
                        <span className={s.explainIcon}>→</span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {result.pricing && (
              <div className={s.section}>
                <div className={s.sectionLabel}>Price Breakdown</div>
                <table className={s.breakdownTable}><tbody>
                  <tr><td>Material Rate</td><td>₹{result.pricing.breakdown.materialRate}/kg</td></tr>
                  <tr><td>Weight</td><td>{result.pricing.breakdown.weight} kg</td></tr>
                  <tr><td>Condition Factor</td><td>×{result.pricing.breakdown.conditionFactor}</td></tr>
                  <tr><td>Adjustment</td><td>×{result.pricing.breakdown.adjustmentFactor}</td></tr>
                  <tr><td>Base Price</td><td>₹{result.pricing.basePrice}</td></tr>
                </tbody></table>
              </div>
            )}

            {result.pricing?.priceRange && (
              <div className={s.section}>
                <div className={s.sectionLabel}>Price Range</div>
                <div className={s.priceRange}>
                  <span className={s.priceRangeVal}>₹{result.pricing.priceRange.min}</span>
                  <div className={s.priceRangeBar}><div className={s.priceRangeFill} /></div>
                  <span className={s.priceRangeVal}>₹{result.pricing.priceRange.max}</span>
                </div>
              </div>
            )}

            {result.pricing?.negotiation && (
              <div className={s.section}>
                <div className={s.sectionLabel}>Negotiation Guide</div>
                <div className={s.negoGrid}>
                  <div className={s.negoCard}><div className={s.negoLabel}>Dealer Offer</div><div className={`${s.negoValue} ${s.negoDealer}`}>₹{result.pricing.negotiation.dealerOffer}</div></div>
                  <div className={s.negoCard}><div className={s.negoLabel}>Target Price</div><div className={`${s.negoValue} ${s.negoTarget}`}>₹{result.pricing.negotiation.targetPrice}</div></div>
                  <div className={s.negoCard}><div className={s.negoLabel}>Min Accept</div><div className={`${s.negoValue} ${s.negoFloor}`}>₹{result.pricing.negotiation.minAcceptable}</div></div>
                </div>
              </div>
            )}

            {result.pricing?.explanation && !result.pricing?.richExplanation && (
              <div className={s.section}>
                <div className={s.sectionLabel}>Insights</div>
                <div className={s.explainList}>
                  {Object.entries(result.pricing.explanation).map(([k, v]) => (
                    <div key={k} className={s.explainItem}>
                      <span className={s.explainKey}>{k}:</span>{String(v)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.improvement && result.improvement.delta > 0 && (
              <div className={s.section}>
                <div className={s.sectionLabel}>💹 Potential Value Improvement</div>
                <div style={{ padding: "0.75rem", background: "rgba(54,214,182,0.06)", borderRadius: "var(--radius-md)", border: "1px solid rgba(54,214,182,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Improved estimate</span>
                    <span style={{ color: "var(--success)", fontWeight: 700 }}>₹{result.improvement.improvedPrice}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Potential gain</span>
                    <span style={{ color: "var(--success)", fontWeight: 600 }}>+₹{result.improvement.delta}</span>
                  </div>
                  {result.improvement.suggestions.map((tip: string, i: number) => (
                    <div key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", paddingLeft: "0.5rem", borderLeft: "2px solid var(--success)", marginBottom: "0.35rem" }}>
                      → {tip}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            <div className={s.section}>
              <div className={s.sectionLabel}>Rate This Estimate</div>
              {feedbackSent ? (
                <p style={{ color: "var(--success)", fontSize: "0.88rem" }}>✓ Thank you for your feedback!</p>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => { setFeedbackVote(true); setShowFeedbackNote(true); }}
                      disabled={feedbackSending}
                      style={{
                        padding: "0.45rem 1.1rem",
                        borderRadius: "var(--radius-full)",
                        border: `1px solid ${feedbackVote === true ? "var(--success)" : "var(--border-default)"}`,
                        background: feedbackVote === true ? "rgba(54,214,182,0.1)" : "transparent",
                        color: feedbackVote === true ? "var(--success)" : "var(--text-secondary)",
                        cursor: "pointer",
                        fontSize: "0.88rem",
                        transition: "all 0.2s",
                      }}
                    >
                      👍 Accurate
                    </button>
                    <button
                      onClick={() => { setFeedbackVote(false); setShowFeedbackNote(true); }}
                      disabled={feedbackSending}
                      style={{
                        padding: "0.45rem 1.1rem",
                        borderRadius: "var(--radius-full)",
                        border: `1px solid ${feedbackVote === false ? "var(--error)" : "var(--border-default)"}`,
                        background: feedbackVote === false ? "rgba(255,90,101,0.08)" : "transparent",
                        color: feedbackVote === false ? "var(--error)" : "var(--text-secondary)",
                        cursor: "pointer",
                        fontSize: "0.88rem",
                        transition: "all 0.2s",
                      }}
                    >
                      👎 Not accurate
                    </button>
                  </div>

                  {showFeedbackNote && feedbackVote !== null && (
                    <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        placeholder="Optional note (e.g. actual price)"
                        value={feedbackNote}
                        onChange={(e) => setFeedbackNote(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "0.4rem 0.75rem",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontSize: "0.85rem",
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && feedbackVote !== null && !feedbackSending) {
                            setFeedbackSending(true);
                            try {
                              await submitFeedback({
                                analysis_id: result?.analysis_id ?? "unknown",
                                is_accurate: feedbackVote,
                                note: feedbackNote.trim() || undefined,
                              }, user?.id);
                              setFeedbackSent(true);
                            } catch (err) {
                              setFeedbackError(err instanceof Error ? err.message : "Failed");
                            } finally {
                              setFeedbackSending(false);
                            }
                          }
                        }}
                      />
                      <button
                        disabled={feedbackSending}
                        onClick={async () => {
                          if (feedbackVote === null) return;
                          setFeedbackSending(true);
                          try {
                            await submitFeedback({
                              analysis_id: result?.analysis_id ?? "unknown",
                              is_accurate: feedbackVote,
                              note: feedbackNote.trim() || undefined,
                            }, user?.id);
                            setFeedbackSent(true);
                          } catch (err) {
                            setFeedbackError(err instanceof Error ? err.message : "Failed");
                          } finally {
                            setFeedbackSending(false);
                          }
                        }}
                        style={{
                          padding: "0.4rem 0.9rem",
                          borderRadius: "var(--radius-sm)",
                          border: "none",
                          background: "var(--accent)",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {feedbackSending ? "…" : "Send →"}
                      </button>
                    </div>
                  )}

                  {feedbackError && (
                    <p style={{ color: "var(--error)", fontSize: "0.78rem", marginTop: "0.3rem" }}>
                      {feedbackError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button id="reset-btn" className={s.primaryBtn} onClick={reset}>Estimate Another Item →</button>
          </section>
        )}

        {/* ERROR */}
        {phase === "error" && (
          <section className={`${s.card} ${s.errorCard}`}>
            <div className={s.errorIcon}>⚠️</div>
            <div className={s.errorTitle}>Something went wrong</div>
            <div className={s.errorText}>{error}</div>
            <button className={s.primaryBtn} onClick={reset}>Try Again →</button>
          </section>
        )}

        {/* SESSION EXPIRED */}
        {phase === "session-expired" && (
          <section className={`${s.card} ${s.errorCard}`}>
            <div className={s.errorIcon}>🔄</div>
            <div className={s.errorTitle}>Session Expired</div>
            <div className={s.errorText}>{error}</div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
              Your session has expired. The flow is restarting automatically...
            </p>
          </section>
        )}
      </main>

      <footer className={s.footer}>ScrapIQ — Deterministic valuation. Real market rates.</footer>
    </div>
  );
}
