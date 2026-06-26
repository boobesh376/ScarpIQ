/**
 * ScrapIQ Core Engine
 * ===================
 * Deterministic field resolution engine.
 *
 * PRINCIPLE: AI assists, USER decides. Never guess. Never assume.
 *
 * Priority Rules (highest → lowest for every field):
 *   1. User description  (explicit keywords in free text)
 *   2. User answers      (userInputs supplied via question flow)
 *   3. AI estimates      (imageAnalysis, only when confidence > 0.8)
 *   4. Defaults          (never applied silently — field goes MISSING instead)
 *
 * Field-specific rules:
 *   WEIGHT:     userInputs → description → MISSING  (AI never used)
 *   MATERIAL:   userInputs → description → AI (>0.8) → inferMaterial → MISSING
 *   CONDITION:  userInputs → description → AI (>0.8) → MISSING
 *                 ↳ description parsing uses both CONDITION_MAP keywords AND
 *                   direct canonical-value detection ("excellent", "good", etc.)
 *                 ↳ AI estimate is surfaced as a UI suggestion but only
 *                   auto-resolved if no description signal exists
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const AI_CONFIDENCE_THRESHOLD = 0.8;

const KNOWN_MATERIALS = [
  "copper",
  "iron",
  "aluminum",
  "aluminium", // alias → normalized to "aluminum"
  "plastic",
  "steel",
  "brass",     // Added: UI option available
  "mixed",     // Added: catch-all for unknown/mixed materials
];

/**
 * Descriptive-keyword → condition mapping.
 * Used by parseCondition() for word-boundary scanning.
 *
 * Includes both damage/positive descriptors AND direct canonical values
 * so "excellent condition" and "good shape" are both caught.
 */
const CONDITION_MAP = {
  // Damage descriptors
  rusted:           "damaged",
  rusty:            "damaged",
  broken:           "damaged",
  cracked:          "damaged",
  bent:             "damaged",
  dented:           "damaged",
  corroded:         "damaged",
  damaged:          "damaged",
  // Positive/neutral descriptors
  working:          "good",
  intact:           "good",
  functional:       "good",
  good:             "good",
  // Pristine descriptors
  new:              "excellent",
  "like new":       "excellent",
  excellent:        "excellent",
  pristine:         "excellent",
  perfect:          "excellent",
  // Wear descriptors
  worn:             "worn",
  used:             "worn",
  old:              "worn",
  // Severe damage
  "heavily damaged":"heavily_damaged",
  destroyed:        "heavily_damaged",
};

/**
 * The canonical set of condition values accepted by pricingEngine.
 */
const VALID_CONDITIONS = [
  "excellent",
  "good",
  "worn",
  "damaged",
  "heavily_damaged",
];

/**
 * Maps every string a UI or AI layer might send → canonical pricing enum.
 * Applied unconditionally to all condition values from any source.
 *
 * "not_sure" maps to "worn" — the conservative middle-ground when the user
 * cannot assess condition. This prevents an infinite loop where the condition
 * question keeps appearing because normalizeCondition("not_sure") would return null.
 * 
 * For material "not_sure": mapped to "mixed" as a catch-all for unknown materials.
 * For cleanliness "not_sure": mapped to "dirty" (conservative when unsure).
 */
const CONDITION_NORMALIZATION_MAP = {
  // Aliases
  working:          "good",
  used:             "worn",
  old:              "worn",
  broken:           "damaged",
  rusted:           "damaged",
  bad:              "damaged",
  functional:       "good",
  "like new":       "excellent",
  new:              "excellent",
  pristine:         "excellent",
  perfect:          "excellent",
  destroyed:        "heavily_damaged",
  "heavily damaged":"heavily_damaged",
  // User-selected uncertainty → conservative safe default
  not_sure:         "worn",
  "not sure":       "worn",
  unsure:           "worn",
  unknown:          "worn",
  // Identity (valid enums pass through)
  excellent:        "excellent",
  good:             "good",
  worn:             "worn",
  damaged:          "damaged",
  heavily_damaged:  "heavily_damaged",
};

// ─── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Extract weight (in kg) from a text description.
 *
 * Supports: "2kg", "2 kg", "2.5kg", "2 kilograms", "2kgs", "0.75 kg"
 *
 * @param {string} description
 * @returns {number|null}
 */
function parseWeight(description) {
  if (!description || typeof description !== "string") return null;

  const regex = /(\d+\.?\d*|\.\d+)\s*(?:kg|kgs|kilogram|kilograms)\b/i;
  const match = description.match(regex);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Detect material keyword from a text description.
 * "aluminium" is normalized to "aluminum".
 *
 * @param {string} description
 * @returns {string|null}
 */
function parseMaterial(description) {
  if (!description || typeof description !== "string") return null;

  const lower = description.toLowerCase();

  for (const material of KNOWN_MATERIALS) {
    const regex = new RegExp(`\\b${material}\\b`, "i");
    if (regex.test(lower)) {
      if (material === "aluminium") return "aluminum";
      return material;
    }
  }

  return null;
}

/**
 * Detect condition from a text description using keyword/phrase mapping.
 *
 * Strategy:
 *   1. Check multi-word phrases first ("like new", "heavily damaged")
 *   2. Then single-word keywords with word-boundary matching
 *
 * This catches both descriptors ("rusty", "broken") and direct canonical
 * values ("excellent", "good", "worn", "damaged") written in the description.
 *
 * @param {string} description
 * @returns {string|null} Canonical condition value, or null if not found.
 */
function parseCondition(description) {
  if (!description || typeof description !== "string") return null;

  const lower = description.toLowerCase();

  // Phase 1: multi-word phrases (must be checked before single words)
  const multiWordPhrases = [
    ["heavily damaged", "heavily_damaged"],
    ["like new",        "excellent"],
  ];

  for (const [phrase, condition] of multiWordPhrases) {
    if (lower.includes(phrase)) return condition;
  }

  // Phase 2: single keywords with word-boundary matching
  for (const [keyword, condition] of Object.entries(CONDITION_MAP)) {
    // Skip multi-word entries already handled above
    if (keyword.includes(" ")) continue;

    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(lower)) return condition;
  }

  return null;
}

// ─── Normalizer ──────────────────────────────────────────────────────────────

/**
 * Normalise any condition string to a valid pricing-engine enum.
 * Returns null for unrecognised input — triggers MISSING rather than bad data.
 *
 * @param {string} input
 * @returns {string|null}
 */
function normalizeCondition(input) {
  if (!input || typeof input !== "string") return null;
  return CONDITION_NORMALIZATION_MAP[input.toLowerCase().trim()] || null;
}

const SUBTYPE_NORMALIZATION_MAP = {
  "hard plastic": "hard",
  "hard":         "hard",
  "soft plastic": "soft",
  "soft":         "soft",
  "bare copper":  "bare",
  "bare":         "bare",
  "insulated wire":"insulated",
  "insulated":    "insulated",
  "mixed metal":  "mixed",
  "mixed":        "mixed",
  "heavy iron":   "heavy",
  "heavy":        "heavy",
  "light iron":   "light",
  "light":        "light",
  "cast iron":    "cast",
  "cast":         "cast",
  "pure":         "pure",
  "stainless":    "stainless",
  "mild":         "mild",
  "cans":         "cans",
  // Mixed/unknown material subtypes
  "mixed metals":  "mixed_metals",
  "mixed_metals":  "mixed_metals",
  "mixed general": "mixed_general",
  "mixed_general": "mixed_general",
};

const CLEANLINESS_NORMALIZATION_MAP = {
  "clean":        "clean",
  "dirty":        "dirty",
  "contaminated": "dirty",
  "grimy":        "dirty",
  "rusty":        "dirty",
  "soiled":       "dirty",
  // Uncertainty → conservative dirty (matches valuationService CLEANLINESS_MAP)
  "not_sure":     "dirty",
  "not sure":     "dirty",
  "unsure":       "dirty",
  "unknown":      "dirty",
};

function normalizeSubtype(input) {
  if (!input || typeof input !== "string") return input;
  const mapped = SUBTYPE_NORMALIZATION_MAP[input.toLowerCase().trim()];
  return mapped !== undefined ? mapped : input;
}

function normalizeCleanliness(input) {
  if (!input || typeof input !== "string") return input;
  const mapped = CLEANLINESS_NORMALIZATION_MAP[input.toLowerCase().trim()];
  return mapped !== undefined ? mapped : input;
}

/**
 * Pick the first valid (non-null, non-empty) value from a priority list.
 *
 * @param {Array<{value: *, source: string}>} priorityList
 * @returns {{value: *, source: string}|null}
 */
function resolveField(priorityList) {
  if (!Array.isArray(priorityList)) return null;

  for (const candidate of priorityList) {
    if (candidate == null) continue;
    const { value, source } = candidate;
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    return { value, source };
  }

  return null;
}

// ─── Inference Helpers ───────────────────────────────────────────────────────

/**
 * Weak material inference from description keywords and/or AI.
 * Only called when all deterministic sources are exhausted.
 *
 * @param {{ description?: string, imageAnalysis?: object }} opts
 * @returns {string|null}
 */
function inferMaterial({ description, imageAnalysis } = {}) {
  const score = {};

  function add(mat, w) {
    score[mat] = (score[mat] || 0) + w;
  }

  if (description) {
    const d = description.toLowerCase();
    if (d.includes("copper"))   add("copper",   3);
    if (d.includes("plastic"))  add("plastic",  3);
    if (d.includes("iron"))     add("iron",     3);
    if (d.includes("steel"))    add("steel",    3);
    if (d.includes("aluminum")) add("aluminum", 3);
    if (d.includes("aluminium"))add("aluminum", 3);
  }

  if (
    imageAnalysis &&
    imageAnalysis.source !== "mock" &&
    typeof imageAnalysis.confidence === "number" &&
    imageAnalysis.confidence > AI_CONFIDENCE_THRESHOLD &&
    imageAnalysis.material
  ) {
    add(imageAnalysis.material, 1);
  }

  let best = null, max = 0;
  for (const m in score) {
    if (score[m] > max) { max = score[m]; best = m; }
  }
  return best;
}

/**
 * Condition auto-fill from description — high-signal keywords only.
 * Subset of parseCondition focused on the strongest signals.
 * Kept for backward-compatibility; parseCondition is now comprehensive enough
 * to handle all cases including canonical value keywords.
 *
 * @param {string} description
 * @returns {string|null}
 */
function inferConditionFromDescription(description) {
  if (!description || typeof description !== "string") return null;
  const d = description.toLowerCase();
  if (d.includes("rust") || /\bbroken\b/.test(d)) return "damaged";
  if (/\bnew\b/.test(d)) return "excellent";
  return null;
}

// ─── Main Processor ──────────────────────────────────────────────────────────

/**
 * Process combined inputs and produce deterministic structured output.
 *
 * Priority order for every field:
 *   1. User description  (free-text parsing)
 *   2. User answers      (userInputs)
 *   3. AI estimates      (imageAnalysis, confidence > 0.8)
 *   4. Inferred          (weak heuristics, last resort)
 *   → MISSING            (triggers question in questionEngine)
 *
 * Note on condition:
 *   Condition is resolved from description when a keyword is found.
 *   The user can always override by explicitly answering the condition question
 *   (userInputs takes highest priority so it wins in the next processInput call).
 *   AI condition is used as a fallback when description has no signal.
 *
 * @param {Object} input
 * @returns {Object} { status, data, source, missingFields, confidenceLevel }
 */
function processInput(input) {
  if (!input || typeof input !== "object") {
    return {
      status: "NEEDS_INPUT",
      data: {},
      source: {},
      missingFields: ["material", "weight", "condition"],
    };
  }

  const { imageAnalysis, description, userInputs } = input;

  const ai   = imageAnalysis || {};
  const user = userInputs   || {};
  const desc = typeof description === "string" ? description : "";

  // ── AI usability ────────────────────────────────────────────────────────
  const aiConfidence = typeof ai.confidence === "number" ? ai.confidence : 0;
  const aiIsMock     = ai.source === "mock";
  const aiIsReliable = !aiIsMock && aiConfidence > AI_CONFIDENCE_THRESHOLD;

  // ── WEIGHT ──────────────────────────────────────────────────────────────
  // Priority: userInputs → description → MISSING  (AI never used)
  const weightResult = resolveField([
    {
      value: user.weight !== null && user.weight !== undefined ? user.weight : null,
      source: "userInputs",
    },
    { value: parseWeight(desc), source: "description" },
  ]);

  // ── MATERIAL ────────────────────────────────────────────────────────────
  // Priority: userInputs → description → AI (>0.8) → inferMaterial → MISSING
  const userMaterial  = user.material !== null && user.material !== undefined ? user.material : null;
  const descMaterial  = parseMaterial(desc);
  const aiMaterial    = aiIsReliable && ai.material ? ai.material : null;

  const inferredMaterial =
    !userMaterial && !descMaterial && !aiMaterial
      ? inferMaterial({ description: desc, imageAnalysis: ai })
      : null;

  const materialResult = resolveField([
    { value: userMaterial,     source: "userInputs"    },
    { value: descMaterial,     source: "description"   },
    { value: aiMaterial,       source: "imageAnalysis" },
    { value: inferredMaterial, source: "inferred"      },
  ]);

  // ── CONDITION ───────────────────────────────────────────────────────────
  // Priority: userInputs → description (parsed) → MISSING
  //
  // AI is intentionally NOT a source for condition resolution.
  // Condition directly affects valuation — the user must be the authoritative
  // source. AI condition estimates are shown in the UI as suggestions only
  // (via aiAnalysis.detectedCondition) but never used to resolve the field.
  //
  // If condition is in the description ("rusty", "excellent", "broken" etc.)
  // it is resolved automatically. The user can always override by explicitly
  // answering the condition question (userInputs takes highest priority).
  const userConditionRaw =
    user.condition !== null && user.condition !== undefined
      ? String(user.condition)
      : null;

  const descCondition = parseCondition(desc);

  const conditionResult = resolveField([
    { value: normalizeCondition(userConditionRaw), source: "userInputs"  },
    { value: normalizeCondition(descCondition),    source: "description" },
    // AI condition intentionally omitted — user is the authority for condition.
  ]);

  // ── Assemble output ─────────────────────────────────────────────────────
  const data          = {};
  const source        = {};
  const missingFields = [];

  if (weightResult) {
    data.weight   = weightResult.value;
    source.weight = weightResult.source;
  } else {
    missingFields.push("weight");
  }

  if (materialResult) {
    data.material   = materialResult.value;
    source.material = materialResult.source;
  } else {
    missingFields.push("material");
  }

  if (conditionResult) {
    data.condition   = conditionResult.value;
    source.condition = conditionResult.source;
  } else {
    missingFields.push("condition");
  }

  const status = missingFields.length === 0 ? "READY" : "NEEDS_INPUT";

  // ── Confidence Level ────────────────────────────────────────────────────
  const resolvedSources = Object.values(source);
  let confidenceLevel;
  if (resolvedSources.length === 0) {
    confidenceLevel = "low";
  } else if (resolvedSources.some((s) => s === "inferred")) {
    confidenceLevel = "low";
  } else if (resolvedSources.some((s) => s === "description" || s === "imageAnalysis")) {
    confidenceLevel = "medium";
  } else {
    confidenceLevel = "high";
  }

  return { status, data, source, missingFields, confidenceLevel };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  parseWeight,
  parseMaterial,
  parseCondition,
  normalizeCondition,
  normalizeSubtype,
  normalizeCleanliness,
  resolveField,
  processInput,
  inferMaterial,
  inferConditionFromDescription,
  AI_CONFIDENCE_THRESHOLD,
  KNOWN_MATERIALS,
  CONDITION_MAP,
  VALID_CONDITIONS,
  CONDITION_NORMALIZATION_MAP,
  SUBTYPE_NORMALIZATION_MAP,
  CLEANLINESS_NORMALIZATION_MAP,
};