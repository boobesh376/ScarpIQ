/**
 * ScrapIQ Core Engine
 * ===================
 * Deterministic field resolution engine.
 *
 * PRINCIPLE: AI assists, USER decides. Never guess. Never assume.
 *
 * Priority Rules:
 *   WEIGHT:     userInputs → description → MISSING (AI never used)
 *   MATERIAL:   userInputs → description → AI (confidence > 0.8) → MISSING
 *   CONDITION:  userInputs → description → AI (confidence > 0.8) → MISSING
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
];

const CONDITION_MAP = {
  rusted: "damaged",
  rusty: "damaged",
  broken: "damaged",
  cracked: "damaged",
  bent: "damaged",
  dented: "damaged",
  corroded: "damaged",
  working: "good",
  intact: "good",
  clean: "good",
  new: "excellent",
  "like new": "excellent",
};

/**
 * The canonical set of condition values accepted by pricingEngine.
 * This is the single source of truth — kept here so coreEngine can enforce
 * the contract before data ever reaches the pricing layer.
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
 *
 * Two categories of entries:
 *   • Aliases  — informal / legacy values the frontend may send ("used", "working")
 *   • Identity — valid enums pass through unchanged so normalization is safe
 *     to apply unconditionally to any source.
 *
 * Anything NOT in this map is unrecognisable and must become MISSING,
 * never silently corrupted.
 */
const CONDITION_NORMALIZATION_MAP = {
  // ── Aliases (UI / AI informal values) ───────────────────────────────────
  working:   "good",      // UI sends "working" → maps to "good"
  used:      "worn",      // UI sends "used"    → maps to "worn"
  old:       "worn",      // descriptive alias  → maps to "worn"
  broken:    "damaged",   // descriptive alias  → maps to "damaged"
  rusted:    "damaged",   // descriptive alias  → maps to "damaged"
  bad:       "damaged",   // descriptive alias  → maps to "damaged"
  // ── Identity (valid enums pass through) ─────────────────────────────────
  excellent:       "excellent",
  good:            "good",
  worn:            "worn",
  damaged:         "damaged",
  heavily_damaged: "heavily_damaged",
};

// ─── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Extract weight (in kg) from a text description.
 *
 * Supports formats:
 *   "2kg", "2 kg", "2.5kg", "2 kilograms", "2kgs", "0.75 kg"
 *
 * @param {string} description - Free-text description from the user.
 * @returns {number|null} Parsed weight in kg, or null if not found.
 */
function parseWeight(description) {
  if (!description || typeof description !== "string") return null;

  // Match patterns like: 2kg, 2 kg, 2.5kg, 2 kilograms, 2kgs, .5kg
  const regex = /(\d+\.?\d*|\.\d+)\s*(?:kg|kgs|kilogram|kilograms)\b/i;
  const match = description.match(regex);

  if (!match) return null;

  const value = parseFloat(match[1]);

  // Sanity: weight must be positive and finite
  if (!Number.isFinite(value) || value <= 0) return null;

  return value;
}

/**
 * Detect material keyword from a text description.
 *
 * Scans for known material keywords and returns the first match.
 * "aluminium" is normalized to "aluminum".
 *
 * @param {string} description - Free-text description from the user.
 * @returns {string|null} Detected material, or null if not found.
 */
function parseMaterial(description) {
  if (!description || typeof description !== "string") return null;

  const lower = description.toLowerCase();

  for (const material of KNOWN_MATERIALS) {
    // Use word-boundary matching to avoid partial matches
    // e.g. "ironing" should NOT match "iron"
    const regex = new RegExp(`\\b${material}\\b`, "i");
    if (regex.test(lower)) {
      // Normalize aluminium → aluminum
      if (material === "aluminium") return "aluminum";
      return material;
    }
  }

  return null;
}

/**
 * Detect condition from a text description using keyword mapping.
 *
 * Maps descriptive keywords to standardized conditions:
 *   rusted/broken/cracked/bent/dented/corroded → "damaged"
 *   working/intact/clean/new → "good"
 *
 * @param {string} description - Free-text description from the user.
 * @returns {string|null} Mapped condition, or null if not found.
 */
function parseCondition(description) {
  if (!description || typeof description !== "string") return null;

  const lower = description.toLowerCase();

  for (const [keyword, condition] of Object.entries(CONDITION_MAP)) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(lower)) {
      return condition;
    }
  }

  return null;
}

// ─── Normalizer ──────────────────────────────────────────────────────────────

/**
 * Normalise any condition string to a valid pricing-engine enum.
 *
 * Applied to EVERY condition value regardless of source (userInputs, AI,
 * description parser). This is the single choke-point that prevents informal
 * strings like "used" or "working" from reaching pricingEngine.
 *
 * Returns null for anything not in the normalization map — the field will be
 * treated as MISSING and trigger a question rather than passing bad data
 * downstream.
 *
 * @param {string} input - Raw condition string from any source.
 * @returns {string|null} Valid condition enum, or null if unrecognised.
 */
function normalizeCondition(input) {
  if (!input || typeof input !== "string") return null;
  return CONDITION_NORMALIZATION_MAP[input.toLowerCase().trim()] || null;
}

/**
 * Maps human-readable subtype values → canonical backend enums.
 * Supports multiple phrasings of the same concept.
 */
const SUBTYPE_NORMALIZATION_MAP = {
  // Plastic subtypes
  "hard plastic": "hard",
  "hard": "hard",
  "soft plastic": "soft",
  "soft": "soft",
  // Copper subtypes
  "bare copper": "bare",
  "bare": "bare",
  "insulated wire": "insulated",
  "insulated": "insulated",
  "mixed metal": "mixed",
  "mixed": "mixed",
  // Iron subtypes
  "heavy iron": "heavy",
  "heavy": "heavy",
  "light iron": "light",
  "light": "light",
};

/**
 * Maps human-readable cleanliness values → canonical backend enums.
 */
const CLEANLINESS_NORMALIZATION_MAP = {
  "clean": "clean",
  "dirty": "dirty",
  "contaminated": "dirty",
  "grimy": "dirty",
  "rusty": "dirty",
  "soiled": "dirty",
};

/**
 * Normalise any subtype string to a valid pricing-engine enum.
 *
 * Safe fallback: returns original value if not in map (fails open).
 *
 * @param {string} input - Raw subtype string from any source.
 * @returns {string} Valid subtype enum, or original value if unmapped.
 */
function normalizeSubtype(input) {
  if (!input || typeof input !== "string") return input;
  const mapped = SUBTYPE_NORMALIZATION_MAP[input.toLowerCase().trim()];
  return mapped !== undefined ? mapped : input;
}

/**
 * Normalise any cleanliness string to a valid pricing-engine enum.
 *
 * Safe fallback: returns original value if not in map (fails open).
 *
 * @param {string} input - Raw cleanliness string from any source.
 * @returns {string} Valid cleanliness enum, or original value if unmapped.
 */
function normalizeCleanliness(input) {
  if (!input || typeof input !== "string") return input;
  const mapped = CLEANLINESS_NORMALIZATION_MAP[input.toLowerCase().trim()];
  return mapped !== undefined ? mapped : input;
}



/**
 * Pick the first valid (non-null, non-undefined, non-empty-string) value
 * from an ordered list of { value, source } candidates.
 *
 * @param {Array<{value: *, source: string}>} priorityList
 *   Ordered candidates, highest priority first.
 * @returns {{value: *, source: string}|null}
 *   The winning candidate, or null if all are invalid.
 */
function resolveField(priorityList) {
  if (!Array.isArray(priorityList)) return null;

  for (const candidate of priorityList) {
    if (candidate == null) continue;

    const { value, source } = candidate;

    // Reject null, undefined, empty string, NaN
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;

    return { value, source };
  }

  return null;
}

// ─── Inference Helpers ───────────────────────────────────────────────────────

/**
 * TASK 1 — Safe Material Inference
 *
 * Produces a weak material signal from description keywords and/or AI output.
 * This is OPTIONAL ASSISTANCE — never authoritative.
 *
 * Only called from processInput when:
 *   • userInputs.material is missing
 *   • parseMaterial(description) returned null
 *   • AI is not usable (mock or low confidence)
 *
 * Scoring:
 *   description keyword match  → weight 3 (strong)
 *   AI signal (real, ≥ 0.8)    → weight 1 (weak)
 *
 * Returns the top-scoring material, or null if nothing scores.
 *
 * @param {{ description?: string, imageAnalysis?: object }} opts
 * @returns {string|null}
 */
function inferMaterial({ description, imageAnalysis } = {}) {
  const score = {};

  function add(mat, w) {
    score[mat] = (score[mat] || 0) + w;
  }

  // Description signal (strong — weight 3)
  if (description) {
    const d = description.toLowerCase();
    if (d.includes("copper"))   add("copper",   3);
    if (d.includes("plastic"))  add("plastic",  3);
    if (d.includes("iron"))     add("iron",     3);
    if (d.includes("steel"))    add("steel",    3);
    if (d.includes("aluminum")) add("aluminum", 3);
    if (d.includes("aluminium")) add("aluminum", 3);
  }

  // AI signal (weak + conditional — weight 1)
  // Only use real AI output with confidence strictly > AI_CONFIDENCE_THRESHOLD (0.8)
  // This mirrors the core engine's aiIsReliable rule exactly.
  if (
    imageAnalysis &&
    imageAnalysis.source !== "mock" &&
    typeof imageAnalysis.confidence === "number" &&
    imageAnalysis.confidence > AI_CONFIDENCE_THRESHOLD &&
    imageAnalysis.material
  ) {
    add(imageAnalysis.material, 1);
  }

  let best = null;
  let max  = 0;
  for (const m in score) {
    if (score[m] > max) {
      max  = score[m];
      best = m;
    }
  }

  return best;
}

/**
 * TASK 2 — Condition Auto-Fill from Description (Safe)
 *
 * Applied ONLY when userInputs.condition is missing.
 * Checks for high-signal condition keywords and maps them to canonical values:
 *   "rust"   → damaged
 *   "broken" → damaged
 *   "new"    → excellent
 *
 * Differs from parseCondition in that it:
 *   • Handles the substring "rust" (not just word-boundary "rusted")
 *   • Maps "new" → "excellent" (stronger assertion than the alias table)
 *   • Is explicitly labeled as auto-fill so callers can set source accordingly
 *
 * Returns null if no signal found — caller must NOT assign.
 *
 * @param {string} description
 * @returns {string|null}
 */
function inferConditionFromDescription(description) {
  if (!description || typeof description !== "string") return null;

  const d = description.toLowerCase();

  // Damage signals (substring match is intentional — "rusty", "rusted", etc.)
  if (d.includes("rust") || /\bbroken\b/.test(d)) return "damaged";

  // New / pristine signal
  if (/\bnew\b/.test(d)) return "excellent";

  return null;
}

// ─── Main Processor ──────────────────────────────────────────────────────────

/**
 * Process combined inputs and produce deterministic structured output.
 *
 * @param {Object} input
 * @param {Object} [input.imageAnalysis]       - AI vision output.
 * @param {string} [input.imageAnalysis.material]
 * @param {number} [input.imageAnalysis.confidence]
 * @param {string} [input.imageAnalysis.condition]
 * @param {string} [input.description]         - Free-text from user.
 * @param {Object} [input.userInputs]          - Explicit user-provided values.
 * @param {number|null} [input.userInputs.weight]
 * @param {string|null} [input.userInputs.material]
 * @param {string|null} [input.userInputs.condition]
 *
 * @returns {Object} Result object with status, data, source, missingFields.
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

  // Safe accessors
  const ai = imageAnalysis || {};
  const user = userInputs || {};
  const desc = typeof description === "string" ? description : "";

  // ── Determine AI usability ──────────────────────────────────────────────
  const aiConfidence =
    typeof ai.confidence === "number" ? ai.confidence : 0;

  // RULE A: Mock output is never authoritative — always discard it.
  // source === "mock" means the imageAnalysis module is running in dev/test
  // mode; it returns a hardcoded copper stub regardless of the actual image.
  const aiIsMock = ai.source === "mock";

  // RULE B: Real AI is only trusted when confidence exceeds the threshold.
  // threshold is strict: must be > 0.8, not >= 0.8.
  const aiIsReliable = !aiIsMock && aiConfidence > AI_CONFIDENCE_THRESHOLD;

  // ── WEIGHT resolution ───────────────────────────────────────────────────
  // Priority: userInputs → description → MISSING
  // AI is NEVER used for weight.
  const weightResult = resolveField([
    {
      value:
        user.weight !== null && user.weight !== undefined
          ? user.weight
          : null,
      source: "userInputs",
    },
    { value: parseWeight(desc), source: "description" },
    // NO AI fallback for weight — intentionally omitted
  ]);

  // ── MATERIAL resolution ─────────────────────────────────────────────────
  // Priority: userInputs → description → AI (if confidence > 0.8) → inferMaterial → MISSING
  //
  // inferMaterial is ONLY used when all deterministic sources return null.
  // It combines description substring scoring + weak AI signal.
  // If it returns null → field goes MISSING → question is asked.
  const userMaterial =
    user.material !== null && user.material !== undefined ? user.material : null;
  const descMaterial = parseMaterial(desc);
  const aiMaterial   = aiIsReliable && ai.material ? ai.material : null;

  // Only invoke inference when all primary sources are exhausted
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

  // ── CONDITION resolution ────────────────────────────────────────────────
  // Priority: userInputs → description → AI (if confidence > 0.8) → MISSING
  //
  // TASK 2 — Auto-fill: if userInputs.condition is missing, attempt to infer
  // condition from description high-signal keywords BEFORE falling through to
  // the existing parseCondition path. inferConditionFromDescription runs first
  // in the priority list only when userInputs.condition is absent.
  //
  // normalizeCondition() is applied to EVERY candidate.
  const userConditionRaw =
    user.condition !== null && user.condition !== undefined
      ? String(user.condition)
      : null;
  const userConditionMissing = userConditionRaw === null;

  // Auto-fill fires only when the user hasn't supplied a condition
  const autoFilledCondition = userConditionMissing
    ? inferConditionFromDescription(desc)
    : null;

  const conditionResult = resolveField([
    {
      value: normalizeCondition(userConditionRaw),
      source: "userInputs",
    },
    // Auto-fill (TASK 2): high-signal description keywords — "rust", "broken", "new"
    // Runs above parseCondition so that "new → excellent" wins over the alias table
    {
      value: normalizeCondition(autoFilledCondition),
      source: "description",
    },
    { value: normalizeCondition(parseCondition(desc)), source: "description" },
    {
      value: aiIsReliable && ai.condition
        ? normalizeCondition(ai.condition)
        : null,
      source: "imageAnalysis",
    },
  ]);

  // ── Assemble output ─────────────────────────────────────────────────────
  const data = {};
  const source = {};
  const missingFields = [];

  if (weightResult) {
    data.weight = weightResult.value;
    source.weight = weightResult.source;
  } else {
    missingFields.push("weight");
  }

  if (materialResult) {
    data.material = materialResult.value;
    source.material = materialResult.source;
  } else {
    missingFields.push("material");
  }

  if (conditionResult) {
    data.condition = conditionResult.value;
    source.condition = conditionResult.source;
  } else {
    missingFields.push("condition");
  }

  const status = missingFields.length === 0 ? "READY" : "NEEDS_INPUT";

  // ── TASK 4 — Confidence Level ───────────────────────────────────────────
  // Reflects how authoritatively the resolved fields were determined:
  //   "high"   → every resolved field came from userInputs
  //   "medium" → at least one field from description or imageAnalysis
  //   "low"    → at least one field was inferred (inferMaterial / auto-fill)
  //
  // Rule: lowest-confidence source wins (most conservative label).
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
  // Exported for testing / configurability
  AI_CONFIDENCE_THRESHOLD,
  KNOWN_MATERIALS,
  CONDITION_MAP,
  VALID_CONDITIONS,
  CONDITION_NORMALIZATION_MAP,
  SUBTYPE_NORMALIZATION_MAP,
  CLEANLINESS_NORMALIZATION_MAP,
};