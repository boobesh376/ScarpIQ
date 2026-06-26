/**
 * ScrapIQ Valuation Service
 * ==========================
 * Reusable facade over pricingEngine + improvement engine.
 *
 * Responsibilities:
 *   - Map AI-detected cleanliness ("moderate") → pricing enum ("dirty")
 *   - Validate that subtype + cleanliness are explicitly provided before pricing
 *   - Call calculatePrice() and getImprovementSuggestions() cleanly
 *   - Return structured { pricing, improvement } or a safe { error } object
 *
 * RULES:
 *   - NEVER generates prices via AI — only pricingEngine does that
 *   - NEVER throws — returns { error } on failure
 *   - NEVER modifies input objects
 *   - NEVER silently applies default subtypes or cleanliness values.
 *     If subtype or cleanliness is missing, return { error } so the question
 *     engine has a chance to ask for them. Silent defaults cause the "shallow
 *     flow" bug where valuation runs without enough user input.
 *
 * Formula (via pricingEngine):
 *   effectiveRate = baseRate × subtypeFactor × cleanlinessFactor
 *   finalPrice    = weight  × effectiveRate  × conditionFactor
 */

"use strict";

const { calculatePrice, getImprovementSuggestions, SUBTYPE_FACTORS } = require("./pricingEngine");
const { normalizeCondition } = require("./coreEngine");
const { logEvent }           = require("../utils/logger");

// ─── Cleanliness Mapping ──────────────────────────────────────────────────────

/**
 * Map AI cleanliness vocabulary → pricing engine enum.
 *
 * Gemini returns: "clean" | "moderate" | "dirty"
 * Pricing engine expects: "clean" | "dirty"
 *
 * "moderate" → "dirty" (conservative — better to undervalue than overvalue)
 * "not_sure" → "dirty" (conservative — when user is uncertain, assume dirty)
 * 
 * Also handles "unknown" and other uncertainty indicators.
 */
const CLEANLINESS_MAP = {
  clean:    "clean",
  moderate: "dirty",
  dirty:    "dirty",
  unknown:  "dirty",
  not_sure: "dirty",
  "not sure": "dirty",
  unsure:   "dirty",
};

/**
 * Resolve cleanliness from user input (priority) or AI fallback.
 *
 * User input takes absolute priority. It is mapped through CLEANLINESS_MAP
 * so that values like "not_sure" resolve to the conservative "dirty" default.
 *
 * @param {string|null} rawCleanliness   - AI output (used only when user has no value)
 * @param {string|null} userCleanliness  - User-provided (takes priority)
 * @returns {"clean"|"dirty"|null}       - null only when neither source has any value
 */
function resolveCleanlinessForPricing(rawCleanliness, userCleanliness) {
  // User answer takes highest priority — map through CLEANLINESS_MAP
  if (userCleanliness && typeof userCleanliness === "string") {
    const mapped = CLEANLINESS_MAP[userCleanliness.toLowerCase().trim()];
    if (mapped) return mapped;
  }
  // AI fallback — only used when user has not answered
  if (!rawCleanliness || typeof rawCleanliness !== "string") {
    return null; // No value available — caller must NOT proceed to pricing
  }
  return CLEANLINESS_MAP[rawCleanliness.toLowerCase().trim()] ?? null;
}

// ─── Subtype Resolution ──────────────────────────────────────────────────────

/**
 * Materials that require a subtype for pricing.
 * Derived directly from pricingEngine's SUBTYPE_FACTORS table.
 */
const MATERIALS_REQUIRING_SUBTYPE = Object.keys(SUBTYPE_FACTORS);
// ["copper", "iron", "aluminum", "brass", "steel", "plastic", "mixed"]

/**
 * Uncertainty value set — any subtype matching these strings is treated as
 * "Not Sure" and mapped to the conservative default for the material.
 */
const UNCERTAIN_SUBTYPE_VALUES = new Set([
  "not_sure", "not sure", "unsure", "unknown", "?", "n/a", "na",
]);

/**
 * Conservative subtype default per material.
 *
 * "Conservative" = lowest subtype multiplier, so the system never
 * over-values when the user is unsure about the subtype.
 *
 *   plastic   → soft          (×0.70)
 *   copper    → insulated     (×0.70)
 *   aluminum  → mixed         (×0.85)
 *   iron      → light         (×0.80)
 *   brass     → mixed         (×0.80)
 *   steel     → mild          (×1.00, lower than stainless ×1.15)
 *   mixed     → mixed_general (×0.80)
 */
const CONSERVATIVE_SUBTYPES = {
  plastic:   "soft",
  copper:    "insulated",
  aluminum:  "mixed",
  iron:      "light",
  brass:     "mixed",
  steel:     "mild",
  mixed:     "mixed_general",
};

/**
 * Resolve subtype for pricing.
 *
 * When the user selects or types an uncertainty value ("Not Sure", "unsure",
 * etc.) for the subtype question, falls back to CONSERVATIVE_SUBTYPES so
 * pricing always completes successfully with a conservative (lower) estimate.
 *
 * Returns null only when no value at all was provided. Callers check for
 * null and return an error rather than proceeding.
 *
 * @param {string} material
 * @param {string|null|undefined} subtype
 * @returns {string|null}  null = "required but missing"
 */
function resolveSubtype(material, subtype) {
  const mat = (material || "").toLowerCase();

  // Material has no subtype table → sentinel "none" → ×1.0 factor
  if (!MATERIALS_REQUIRING_SUBTYPE.includes(mat)) {
    return "none";
  }

  if (subtype && typeof subtype === "string") {
    const trimmed = subtype.trim();
    if (trimmed && trimmed !== "none") {
      // Uncertainty values → conservative default for this material
      if (UNCERTAIN_SUBTYPE_VALUES.has(trimmed.toLowerCase())) {
        return CONSERVATIVE_SUBTYPES[mat] ?? null;
      }
      return trimmed;
    }
  }

  return null; // Required but missing
}

// ─── Main Valuation Function ──────────────────────────────────────────────────

/**
 * Calculate scrap valuation using deterministic pricing engine.
 * Never uses AI for price generation.
 *
 * Returns { error } (not a throw) when:
 *   - Required fields (material, weight, condition) are missing
 *   - Material requires subtype but none was provided
 *   - Cleanliness is missing and cannot be inferred from AI
 *   - pricingEngine throws (invalid enum values, etc.)
 *
 * @param {Object} params
 * @param {Object} params.data              - Resolved scrap data (material, weight, condition)
 * @param {string} params.category          - Detected category
 * @param {Object} params.categoryData      - Category-specific data from question flow
 * @param {Object} [params.imageAnalysis]   - AI analysis output (for cleanliness fallback)
 *
 * @returns {{ pricing, improvement, error? }}
 */
function calculateValuation(params) {
  const { data, category, categoryData, imageAnalysis } = params;

  // ── Guard: core fields ────────────────────────────────────────────────────
  if (!data || typeof data !== "object") {
    return { pricing: null, improvement: null, error: "Missing resolved data" };
  }
  if (!data.material || !data.weight || !data.condition) {
    return {
      pricing: null, improvement: null,
      error: "Incomplete data: material, weight, or condition missing",
    };
  }

  try {
    // ── Normalize condition ──────────────────────────────────────────────────
    const normalizedCondition = normalizeCondition(data.condition) || data.condition;
    const resolvedData        = { ...data, condition: normalizedCondition };

    // ── Resolve cleanliness ─────────────────────────────────────────────────
    const cleanlinessFromUser = categoryData?.cleanliness ?? null;
    const cleanlinessFromAI   = imageAnalysis?.cleanliness ?? null;
    const resolvedCleanliness = resolveCleanlinessForPricing(cleanlinessFromAI, cleanlinessFromUser);

    if (!resolvedCleanliness) {
      // Cleanliness is required by pricingEngine but was not provided by
      // user or AI. This means the question flow hasn't asked for it yet.
      // Return an error so the flow doesn't silently apply a "dirty" default.
      return {
        pricing: null, improvement: null,
        error: "cleanliness is required — question flow should ask for it",
      };
    }

    // ── Resolve subtype ─────────────────────────────────────────────────────
    const resolvedSubtype = resolveSubtype(data.material, categoryData?.subtype);

    if (resolvedSubtype === null) {
      // Subtype required by material but not yet provided.
      // Return error instead of silently defaulting.
      return {
        pricing: null, improvement: null,
        error: `subtype is required for material "${data.material}" — question flow should ask for it`,
      };
    }

    // ── Build pricing input ─────────────────────────────────────────────────
    const pricingInput = {
      data:         { ...resolvedData },
      category,
      categoryData: {
        ...categoryData,
        subtype:     resolvedSubtype,
        cleanliness: resolvedCleanliness,
      },
    };

    // ── Run deterministic pricing engine ────────────────────────────────────
    const pricing     = calculatePrice(pricingInput);
    const improvement = getImprovementSuggestions(pricingInput);

    return { pricing, improvement };

  } catch (err) {
    logEvent("PRICING_ERROR", {
      error:   err,
      details: { material: data.material, weight: data.weight, category },
    });
    return { pricing: null, improvement: null, error: err.message };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  calculateValuation,
  resolveCleanlinessForPricing,
  resolveSubtype,
  CLEANLINESS_MAP,
  MATERIALS_REQUIRING_SUBTYPE,
};