/**
 * ScrapIQ Confidence Mapper
 * ==========================
 * Maps raw AI confidence scores (0–100) to structured human-readable levels.
 *
 * Tiers:
 *   90–100 → High Confidence   — AI is highly certain
 *   70–89  → Medium Confidence — AI is reasonably confident
 *   0–69   → Low Confidence    — Uncertain; manual verification recommended
 *
 * Accepts both 0–1 floats (Gemini internal) and 0–100 integers.
 * Always returns a safe, non-throwing result.
 */

"use strict";

// ─── Tier Definitions ─────────────────────────────────────────────────────────

const CONFIDENCE_TIERS = [
  {
    level:       "high",
    minScore:    90,
    label:       "High Confidence",
    description: "AI is highly certain of this identification",
    icon:        "🟢",
  },
  {
    level:       "medium",
    minScore:    70,
    label:       "Medium Confidence",
    description: "AI is reasonably confident — verify if uncertain",
    icon:        "🟡",
  },
  {
    level:       "low",
    minScore:    0,
    label:       "Low Confidence",
    description: "Uncertain identification — manual verification recommended",
    icon:        "🔴",
  },
];

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Map a raw confidence score to a structured confidence result.
 *
 * Accepts:
 *   - 0–1 floats  (e.g. 0.92 → treated as 92%)
 *   - 0–100 ints  (e.g. 92)
 *   - null/undefined → defaults to score 0 (Low Confidence)
 *
 * @param {number|null|undefined} rawScore - Raw confidence value from AI.
 * @returns {{
 *   level:       "high"|"medium"|"low",
 *   score:       number,     // 0–100 integer
 *   label:       string,
 *   description: string,
 *   icon:        string,
 * }}
 */
function mapConfidenceScore(rawScore) {
  // ── Normalize to 0–100 integer ────────────────────────────────────────────
  let score = 0;

  if (rawScore !== null && rawScore !== undefined && Number.isFinite(rawScore)) {
    // Detect 0–1 float vs 0–100 integer by checking if value is <= 1
    if (rawScore <= 1) {
      score = Math.round(rawScore * 100);
    } else {
      score = Math.round(rawScore);
    }
  }

  // Clamp to [0, 100]
  score = Math.max(0, Math.min(100, score));

  // ── Find matching tier ────────────────────────────────────────────────────
  const tier = CONFIDENCE_TIERS.find(t => score >= t.minScore) ?? CONFIDENCE_TIERS[CONFIDENCE_TIERS.length - 1];

  return {
    level:       tier.level,
    score,
    label:       tier.label,
    description: tier.description,
    icon:        tier.icon,
  };
}

/**
 * Convert a 0–100 confidence score to a 0–1 float for internal coreEngine use.
 * Rounds to 2 decimal places to avoid floating-point noise.
 *
 * @param {number} score0to100
 * @returns {number} 0–1 float
 */
function scoreToFloat(score0to100) {
  const clamped = Math.max(0, Math.min(100, score0to100 || 0));
  return Math.round((clamped / 100) * 100) / 100;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  mapConfidenceScore,
  scoreToFloat,
  CONFIDENCE_TIERS,
};
