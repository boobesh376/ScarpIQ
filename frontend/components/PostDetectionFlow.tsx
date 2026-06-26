"use client";

/**
 * PostDetectionFlow — Progressive Material-Specific Questioning
 * ==============================================================
 * Renders one question at a time in the correct material-aware sequence.
 *
 * AI Field Policy (matches backend):
 *   Material  : Auto-detected banner. Not re-asked when resolved.
 *   Condition : Resolved from description when possible. Only asked when
 *               neither description nor AI could determine it. No AI badge
 *               shown as a "confirm below" prompt when condition already known.
 *   Weight    : AI estimate shown as input placeholder hint only. User must type.
 *
 * Question types handled:
 *   weight | material | condition | subtype | cleanliness | rustSeverity | quantity
 */

import React, { useState, useEffect } from "react";
import type { Question, AIAnalysis } from "@/lib/api";
import s from "./PostDetectionFlow.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  ai: AIAnalysis | null;
  currentQuestion: Question | null;
  loading: boolean;
  error: string;
  answeredHistory: Array<{ q: string; a: string; type: string }>;
  totalQuestions: number;
  onSubmitAnswer: (value: string | number) => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function capitalize(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}

// ── Option Definitions ─────────────────────────────────────────────────────────

function getMaterialOptions() {
  return [
    { value: "copper",   label: "Copper",    icon: "🟡" },
    { value: "iron",     label: "Iron",      icon: "⚫" },
    { value: "aluminum", label: "Aluminum",  icon: "🪶" },
    { value: "steel",    label: "Steel",     icon: "🛡️" },
    { value: "brass",    label: "Brass",     icon: "🔔" },
    { value: "plastic",  label: "Plastic",   icon: "♻️" },
    { value: "mixed",    label: "Mixed",     icon: "🔗" },
    { value: "not_sure", label: "Not Sure",  icon: "❓" },
  ];
}

function getConditionOptions() {
  return [
    { value: "excellent",       label: "Excellent",    emoji: "✨", desc: "Like new, no damage" },
    { value: "good",            label: "Good",         emoji: "👍", desc: "Light wear only" },
    { value: "worn",            label: "Worn",         emoji: "🔧", desc: "Visible use or age" },
    { value: "damaged",         label: "Damaged",      emoji: "⚠️", desc: "Clear damage or rust" },
    { value: "heavily_damaged", label: "Heavy Damage", emoji: "🔴", desc: "Major damage" },
    { value: "not_sure",        label: "Not Sure",     emoji: "❓", desc: "Unsure — will estimate" },
  ];
}

function getSubtypeOptions(material: string) {
  const m = (material || "").toLowerCase();
  if (m === "copper") return [
    { value: "bare",      label: "🔌 Bare Copper",    desc: "Uninsulated wire or scrap" },
    { value: "insulated", label: "🧵 Insulated Wire",  desc: "Copper with plastic coating" },
    { value: "insulated", label: "❓ Not Sure",         desc: "Conservative — assumes insulated" },
  ];
  if (m === "aluminum") return [
    { value: "pure",  label: "💎 Pure Aluminum",  desc: "Single material" },
    { value: "mixed", label: "🔗 Mixed Aluminum", desc: "Mixed with other metals" },
    { value: "cans",  label: "🥫 Cans",           desc: "Beverage or food cans" },
    { value: "mixed", label: "❓ Not Sure",         desc: "Conservative — assumes mixed" },
  ];
  if (m === "iron") return [
    { value: "light", label: "📦 Light Iron", desc: "Thin sheets, pipes" },
    { value: "heavy", label: "🏋️ Heavy Iron", desc: "Thick blocks, machinery" },
    { value: "cast",  label: "⚙️ Cast Iron",  desc: "Cookware, engine blocks" },
    { value: "light", label: "❓ Not Sure",    desc: "Conservative — assumes light iron" },
  ];
  if (m === "brass") return [
    { value: "pure",  label: "💎 Pure Brass", desc: "Single material only" },
    { value: "mixed", label: "🔗 Mixed Brass", desc: "With other metals" },
    { value: "mixed", label: "❓ Not Sure",    desc: "Conservative — assumes mixed" },
  ];
  if (m === "plastic") return [
    { value: "hard", label: "🧱 Hard Plastic", desc: "Rigid — better rate" },
    { value: "soft", label: "🎈 Soft Plastic",  desc: "Flexible — lower rate" },
    { value: "soft", label: "❓ Not Sure",       desc: "Conservative — assumes soft" },
  ];
  if (m === "steel") return [
    { value: "stainless", label: "✨ Stainless", desc: "Corrosion resistant" },
    { value: "mild",      label: "⚫ Mild Steel", desc: "Standard carbon steel" },
    { value: "mild",      label: "❓ Not Sure",   desc: "Conservative — assumes mild" },
  ];
  return [
    { value: "mixed_metals",  label: "🔗 Mixed Metals",  desc: "Multiple metal types" },
    { value: "mixed_general", label: "📦 Mixed General", desc: "Various materials" },
    { value: "mixed_general", label: "❓ Not Sure",       desc: "Conservative — assumes mixed general" },
  ];
}

function getCleanlinessOptions() {
  return [
    { value: "clean",    label: "✨ Clean",    desc: "No oil, rust, or coating" },
    { value: "dirty",    label: "🪣 Dirty",    desc: "Contaminated or coated" },
    { value: "not_sure", label: "❓ Not Sure", desc: "Unsure — will use conservative rate" },
  ];
}

function getRustSeverityOptions() {
  return [
    { value: "minimal_rust",  label: "🟢 Minimal Rust",  desc: "Surface rust only" },
    { value: "moderate_rust", label: "🟡 Moderate Rust", desc: "Spreading corrosion" },
    { value: "severe_rust",   label: "🔴 Severe Rust",   desc: "Heavy corrosion throughout" },
  ];
}

// Map AI condition string → condition chip value for pre-selection
function aiConditionToValue(aiCondition: string | null | undefined): string | null {
  if (!aiCondition) return null;
  const map: Record<string, string> = {
    good:      "good",
    excellent: "excellent",
    used:      "worn",
    worn:      "worn",
    damaged:   "damaged",
    broken:    "damaged",
    rusted:    "damaged",
    uncertain: "",
  };
  return map[aiCondition.toLowerCase()] ?? null;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PostDetectionFlow({
  ai,
  currentQuestion,
  loading,
  error,
  answeredHistory,
  totalQuestions,
  onSubmitAnswer,
}: Props) {
  const [inputValue, setInputValue]   = useState<string | number>("");
  const [showWeightInput, setShowWeightInput] = useState(false);

  // Reset local state each time the question type changes.
  // Pre-select AI condition estimate only when the condition question is shown
  // AND condition was not already resolved from description (i.e. we're actually asking it).
  useEffect(() => {
    setInputValue("");
    setShowWeightInput(false);
    if (currentQuestion?.type === "condition" && ai?.detectedCondition) {
      const suggested = aiConditionToValue(ai.detectedCondition);
      if (suggested) setInputValue(suggested);
    }
  }, [currentQuestion?.type, ai?.detectedCondition]);

  if (!currentQuestion) return null;

  const questionType = currentQuestion.type;
  const confidenceScore = ai?.confidence?.score ?? 0;

  const stepsDone    = answeredHistory.length;
  const stepsCurrent = Math.max(totalQuestions, stepsDone + 1);
  const progressPct  = Math.round((stepsDone / Math.max(stepsCurrent, 1)) * 100);

  // Derive current material from answered history or AI detection
  const materialFromHistory = answeredHistory.find((h) => h.type === "material")?.a ?? "";
  const currentMaterial     = materialFromHistory || ai?.detectedMaterial || "";

  const handleSubmit = async (value: string | number) => {
    try {
      await onSubmitAnswer(value);
      setInputValue("");
      setShowWeightInput(false);
    } catch { /* parent handles */ }
  };

  // ── Question Renderers ────────────────────────────────────────────────────

  const renderWeight = () => {
    const aiWeightHint = ai?.estimatedWeightKg ? `~${ai.estimatedWeightKg} kg` : null;
    if (!showWeightInput) {
      return (
        <div className={s.weightPrompt}>
          <div className={s.weightIcon}>⚖️</div>
          <p className={s.weightText}>Weigh your item and enter the exact weight</p>
          {aiWeightHint && (
            <div className={s.aiWeightHint}>
              <span className={s.aiWeightHintIcon}>🤖</span>
              <span className={s.aiWeightHintText}>
                AI visual estimate: <strong>{aiWeightHint}</strong> — confirm with a scale
              </span>
            </div>
          )}
          <button className={s.chipButton} onClick={() => setShowWeightInput(true)} disabled={loading}>
            Enter Weight
          </button>
        </div>
      );
    }
    return (
      <div className={s.weightInputWrap}>
        {aiWeightHint && (
          <div className={s.aiWeightHint}>
            <span className={s.aiWeightHintIcon}>🤖</span>
            <span className={s.aiWeightHintText}>AI estimate: <strong>{aiWeightHint}</strong></span>
          </div>
        )}
        <input
          type="number"
          className={s.weightInputField}
          placeholder={ai?.estimatedWeightKg ? String(ai.estimatedWeightKg) : "0.0"}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && inputValue && handleSubmit(inputValue)}
          autoFocus
          min="0"
          step="0.1"
        />
        <p className={s.weightHint}>kg — use a scale for accuracy</p>
        <button
          className={s.submitWeightBtn}
          onClick={() => handleSubmit(inputValue)}
          disabled={loading || !inputValue}
        >
          {loading ? "Submitting…" : "Confirm Weight"}
        </button>
      </div>
    );
  };

  const renderCondition = () => {
    const options     = getConditionOptions();
    const aiSuggested = aiConditionToValue(ai?.detectedCondition);
    return (
      <>
        {aiSuggested && (
          <div className={s.aiConditionHint}>
            <span className={s.aiConditionHintIcon}>🤖</span>
            <span className={s.aiConditionHintText}>
              AI estimated: <strong>{capitalize(ai?.detectedCondition)}</strong> — confirm or change below
            </span>
          </div>
        )}
        <div className={s.conditionGrid}>
          {options.map((opt) => (
            <button
              key={opt.value}
              className={[
                s.conditionChip,
                s.premiumChip,
                inputValue === opt.value ? `${s.chipSelected} ${s.premiumChipSelected}` : "",
                opt.value === aiSuggested && inputValue === "" ? s.chipAiSuggested : "",
              ].filter(Boolean).join(" ")}
              onClick={() => handleSubmit(opt.value)}
              disabled={loading}
            >
              <span className={s.chipEmoji}>{opt.emoji}</span>
              <span className={s.chipLabel}>{opt.label}</span>
              <span className={s.chipDesc}>{opt.desc}</span>
              {opt.value === aiSuggested && <span className={s.aiSuggestedTag}>AI</span>}
            </button>
          ))}
        </div>
      </>
    );
  };

  const renderMaterial = () => (
    <div className={s.chipGrid}>
      {getMaterialOptions().map((opt) => (
        <button
          key={opt.value}
          className={[s.materialChip, s.premiumChip, inputValue === opt.value ? `${s.chipSelected} ${s.premiumChipSelected}` : ""].filter(Boolean).join(" ")}
          onClick={() => handleSubmit(opt.value)}
          disabled={loading}
        >
          <span className={s.chipMaterialIcon}>{opt.icon}</span>
          <span className={s.chipLabel}>{opt.label}</span>
        </button>
      ))}
    </div>
  );

  const renderSubtype = () => {
    const options = getSubtypeOptions(currentMaterial);
    return (
      <div className={s.chipGrid}>
        {options.map((opt) => (
          <button
            key={opt.value}
            className={[s.subtypeChip, s.premiumChip, inputValue === opt.value ? `${s.chipSelected} ${s.premiumChipSelected}` : ""].filter(Boolean).join(" ")}
            onClick={() => handleSubmit(opt.value)}
            disabled={loading}
          >
            <span className={s.chipLabel}>{opt.label}</span>
            <span className={s.chipDesc}>{opt.desc}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderCleanliness = () => (
    <div className={s.chipGrid}>
      {getCleanlinessOptions().map((opt) => (
        <button
          key={opt.value}
          className={[s.optionChip, s.premiumChip, inputValue === opt.value ? `${s.chipSelected} ${s.premiumChipSelected}` : ""].filter(Boolean).join(" ")}
          onClick={() => handleSubmit(opt.value)}
          disabled={loading}
        >
          <span className={s.chipLabel}>{opt.label}</span>
          <span className={s.chipDesc}>{opt.desc}</span>
        </button>
      ))}
    </div>
  );

  const renderRustSeverity = () => (
    <div className={s.chipGrid}>
      {getRustSeverityOptions().map((opt) => (
        <button
          key={opt.value}
          className={[s.optionChip, s.premiumChip, inputValue === opt.value ? `${s.chipSelected} ${s.premiumChipSelected}` : ""].filter(Boolean).join(" ")}
          onClick={() => handleSubmit(opt.value)}
          disabled={loading}
        >
          <span className={s.chipLabel}>{opt.label}</span>
          <span className={s.chipDesc}>{opt.desc}</span>
        </button>
      ))}
    </div>
  );

  // Quantity: numeric input — ask for approximate count
  const renderQuantity = () => (
    <div className={s.weightInputWrap}>
      <input
        type="number"
        className={s.weightInputField}
        placeholder="e.g. 10"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && inputValue && handleSubmit(inputValue)}
        autoFocus
        min="1"
        step="1"
      />
      <p className={s.weightHint}>approximate number of pieces or bundles</p>
      <button
        className={s.submitWeightBtn}
        onClick={() => handleSubmit(inputValue)}
        disabled={loading || !inputValue}
      >
        {loading ? "Submitting…" : "Confirm Count"}
      </button>
    </div>
  );

  const renderTextFallback = () => (
    <div className={s.textInputWrap}>
      <input
        type="text"
        className={s.textInput}
        placeholder="Type your answer…"
        value={inputValue as string}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit(inputValue)}
        autoFocus
      />
      <button
        className={s.submitBtn}
        onClick={() => handleSubmit(inputValue)}
        disabled={loading || !inputValue}
      >
        {loading ? "Submitting…" : "Continue"}
      </button>
    </div>
  );

  const renderQuestionContent = () => {
    switch (questionType) {
      case "weight":       return renderWeight();
      case "condition":    return renderCondition();
      case "material":     return renderMaterial();
      case "subtype":      return renderSubtype();
      case "cleanliness":  return renderCleanliness();
      case "rustSeverity": return renderRustSeverity();
      case "quantity":     return renderQuantity();
      default:             return renderTextFallback();
    }
  };

  // Build memory nodes from what's resolved so far (history + AI detection)
  const memoryNodes = [
    { label: "Material",  value: currentMaterial ? capitalize(currentMaterial) : null },
    { label: "Condition", value: (answeredHistory.find(h => h.type === "condition")?.a ?? (questionType !== "condition" ? ai?.detectedCondition : null)) },
    { label: "Weight",    value: answeredHistory.find(h => h.type === "weight")?.a ? `${answeredHistory.find(h => h.type === "weight")?.a} kg` : null },
    { label: "Purity",    value: answeredHistory.find(h => h.type === "purity")?.a ?? null },
  ]
    .map(n => ({ ...n, value: n.value ? capitalize(String(n.value)) : null }))
    .filter(n => n.value);

  return (
    <div className={s.flowContainer}>

      {/* ── AI Memory Timeline ────────────────────────────────────── */}
      <div className={s.memoryPanel}>
        <div className={s.memoryPanelTitle}><span>🧠</span> AI Memory Timeline</div>
        {memoryNodes.length === 0 ? (
          <p className={s.memoryEmpty}>Nothing learned yet — answer below to begin.</p>
        ) : (
          <div className={s.memoryList}>
            {memoryNodes.map((n, i) => (
              <div key={n.label} className={s.memoryNode} style={{ animationDelay: `${i * 90}ms` }}>
                <div className={s.memoryNodeDotCol}>
                  <div className={s.memoryNodeDot}>✓</div>
                  {i < memoryNodes.length - 1 && <div className={s.memoryNodeLine} />}
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
            <span className={s.memoryConfValue}>{confidenceScore}%</span>
          </div>
          <div className={s.memoryConfTrack}>
            <div className={s.memoryConfFill} style={{ width: `${confidenceScore}%` }} />
          </div>
        </div>
      </div>

      {/* ── AI Intelligence Progress — milestone system ─────────────── */}
      <div className={s.milestoneTrack}>
        <div className={s.milestoneLine} />
        <div className={s.milestoneLineFill} style={{ width: `${progressPct}%` }} />
        {Array.from({ length: Math.max(stepsCurrent, 1) }).map((_, i) => {
          const nodeCls = i < stepsDone ? s.milestoneNodeDone : i === stepsDone ? s.milestoneNodeActive : "";
          return <div key={i} className={`${s.milestoneNode} ${nodeCls}`} />;
        })}
      </div>
      <div className={s.progressText}>
        Question {stepsDone + 1} of {Math.max(stepsCurrent, 1)}
      </div>

      {/* ── Question Card ─────────────────────────────────────────── */}
      <div className={s.questionCard}>
        <h3 className={s.questionText}>{currentQuestion.question}</h3>

        {/* Answered history */}
        {answeredHistory.length > 0 && (
          <div className={s.answeredHistory}>
            {answeredHistory.map((item, idx) => (
              <div key={idx} className={s.answeredItem}>
                <span className={s.answeredCheck}>✓</span>
                <span className={s.answeredLabel}>{item.q}</span>
                <span className={s.answeredValue}>{capitalize(String(item.a))}</span>
              </div>
            ))}
          </div>
        )}

        <div className={s.questionContent}>{renderQuestionContent()}</div>

        {error && <div className={s.errorMsg}>{error}</div>}
      </div>
    </div>
  );
}