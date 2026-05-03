/**
 * ScrapIQ Pricing Engine
 * =======================
 * Deterministic price calculation. Zero AI. Zero guessing.
 *
 * Formula:
 *   effectiveRate = baseRate × subtypeFactor × cleanlinessFactor
 *   finalPrice = weight × effectiveRate × conditionFactor
 *
 * Output includes:
 *   - finalPrice + priceRange (±10%)
 *   - negotiation insights (dealer offer, target, floor)
 *   - structured human-readable explanation
 *   - full breakdown of every factor
 *   - Phase 11: rich explanation { summary, positives, negatives, tips }
 *
 * All inputs MUST be present and valid.
 * Missing or invalid data → throws Error (never falls back).
 */

// ─── Rate Tables ─────────────────────────────────────────────────────────────

/**
 * Base price per kg for each material (in currency units).
 */
const MATERIAL_RATES = {
  copper: 600,
  aluminum: 150,
  iron: 30,
  steel: 40,
  plastic: 20,
};

/**
 * Subtype multipliers per material.
 * Each material that supports subtypes maps subtype name → factor.
 */
const SUBTYPE_FACTORS = {
  copper: {
    bare: 1.0,
    insulated: 0.7,
    mixed: 0.8,
  },
  iron: {
    heavy: 1.0,
    light: 0.8,
  },
  plastic: {
    hard: 1.0,
    soft: 0.7,
  },
};

/**
 * Cleanliness multiplier.
 */
const CLEANLINESS_FACTOR = {
  clean: 1.0,
  dirty: 0.75,
};

/**
 * Multiplier based on item condition.
 */
const CONDITION_FACTOR = {
  excellent: 1.0,
  good: 0.9,
  worn: 0.75,
  damaged: 0.6,
  heavily_damaged: 0.4,
};

/**
 * The canonical set of valid condition strings this engine accepts.
 * Derived directly from CONDITION_FACTOR so the two can never drift apart.
 * Exported so upstream layers (coreEngine, orchestrator) can enforce the
 * same contract before data reaches calculatePrice().
 */
const VALID_CONDITIONS = Object.keys(CONDITION_FACTOR);
// ["excellent", "good", "worn", "damaged", "heavily_damaged"]

// ─── Explanation Tables ──────────────────────────────────────────────────────

/**
 * Human-readable material insight.
 */
const MATERIAL_EXPLANATIONS = {
  copper: "Copper has high scrap value due to strong industrial demand",
  iron: "Iron is abundant — lower per-kg value but sells in bulk",
  aluminum: "Aluminum is lightweight with good recyclability value",
  steel: "Steel has moderate scrap value, widely recycled",
  plastic: "Plastic has the lowest scrap rate — recycling margins are thin",
};

/**
 * Human-readable condition insight.
 */
const CONDITION_EXPLANATIONS = {
  excellent: "Excellent condition retains full scrap value",
  good: "Good condition reduces price by 10%",
  worn: "Worn condition reduces price by 25%",
  damaged: "Damaged condition reduces price by 40%",
  heavily_damaged: "Heavily damaged condition reduces price by 60%",
};

/**
 * Human-readable subtype insight.
 */
const SUBTYPE_EXPLANATIONS = {
  copper: {
    bare: "Bare copper gives full value — no stripping cost",
    insulated: "Insulated wire reduces value by 30% — requires stripping",
    mixed: "Mixed copper reduces value by 20% — requires sorting",
  },
  iron: {
    heavy: "Heavy iron gives full value — easier to process",
    light: "Light iron reduces value by 20% — lower density",
  },
  plastic: {
    hard: "Hard plastic gives full value — easier to recycle",
    soft: "Soft plastic reduces value by 30% — harder to process",
  },
};

/**
 * Human-readable cleanliness insight.
 */
const CLEANLINESS_EXPLANATIONS = {
  clean: "Clean material ready for recycling — full value",
  dirty: "Dirty material needs cleaning — value reduced by 25%",
};

// ─── Phase 11: Rich Explanation Data ────────────────────────────────────────

/**
 * Summaries per material–condition pair (material is dominant factor).
 */
const MATERIAL_SUMMARIES = {
  copper: "Copper is a premium scrap material with strong market demand",
  aluminum: "Aluminum offers reliable scrap value with broad recycler acceptance",
  iron: "Iron is a common scrap with stable but lower per-kg rates",
  steel: "Steel is moderately valued and consistently accepted by recyclers",
  plastic: "Plastic scrap has thin margins — volume is key for value",
};

/**
 * Tips indexed by factor key + value.
 */
const IMPROVEMENT_TIPS = {
  condition: {
    heavily_damaged: [
      "Strip out any salvageable components before selling",
      "Sort by material type to avoid bulk-rate penalties",
      "Consider selling to specialized recyclers who handle damaged goods",
    ],
    damaged: [
      "Clean off rust or grime to move to 'worn' condition tier",
      "Remove non-metal parts to improve material purity",
      "Bundle with other scrap to negotiate better bulk rates",
    ],
    worn: [
      "Light cleaning can move this to 'good' condition and recover 15% value",
      "Ensure no mixed materials are bundled with this item",
    ],
    good: [
      "Consider whether a quick clean could push this to 'excellent' condition",
    ],
    excellent: [
      "Maintain this quality — excellent condition maximizes your return",
    ],
  },
  cleanliness: {
    dirty: [
      "Washing or wiping down the material can recover up to 25% value",
      "Remove oil, paint, or debris before weighing",
      "Separate dirty and clean portions to get better rates on the clean part",
    ],
    clean: [],
  },
  subtype: {
    insulated: [
      "Stripping insulation off copper wire increases value by ~43%",
      "Use a wire stripper tool — even partial stripping improves rates",
    ],
    mixed: [
      "Sort mixed copper to separate bare and insulated portions",
      "Bare copper commands full rate vs 20% discount for mixed",
    ],
    light: [
      "Bundle light iron pieces together for better weight-based pricing",
    ],
    soft: [
      "Hard plastic consistently commands better rates — sort if mixed",
    ],
  },
};

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate that all required fields are present and valid.
 * Throws descriptive errors — never silently fills defaults.
 *
 * @param {Object} input - The pricing input.
 * @throws {Error} If any required field is missing or invalid.
 */
function validateInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("pricingEngine: input is required and must be an object");
  }

  const { data, categoryData } = input;

  if (!data || typeof data !== "object") {
    throw new Error("pricingEngine: input.data is required");
  }

  // Material
  if (!data.material || typeof data.material !== "string") {
    throw new Error("pricingEngine: data.material is required");
  }
  const material = data.material.toLowerCase();
  if (!(material in MATERIAL_RATES)) {
    throw new Error(
      `pricingEngine: unknown material "${data.material}". Supported: ${Object.keys(MATERIAL_RATES).join(", ")}`
    );
  }

  // Weight
  if (data.weight === null || data.weight === undefined) {
    throw new Error("pricingEngine: data.weight is required");
  }
  if (typeof data.weight !== "number" || !Number.isFinite(data.weight) || data.weight <= 0) {
    throw new Error(
      `pricingEngine: data.weight must be a positive number, got ${data.weight}`
    );
  }

  // Condition
  if (!data.condition || typeof data.condition !== "string") {
    throw new Error("pricingEngine: data.condition is required");
  }
  const condition = data.condition.toLowerCase();
  if (!VALID_CONDITIONS.includes(condition)) {
    throw new Error(
      `pricingEngine: invalid condition "${data.condition}". ` +
      `Must be one of: ${VALID_CONDITIONS.join(", ")}. ` +
      `Did you forget to run normalizeCondition() before pricing?`
    );
  }

  // categoryData is required and must contain subtype + cleanliness
  if (!categoryData || typeof categoryData !== "object") {
    throw new Error("pricingEngine: categoryData is required");
  }

  // Subtype
  if (!categoryData.subtype || typeof categoryData.subtype !== "string") {
    throw new Error("pricingEngine: categoryData.subtype is required");
  }

  // Cleanliness
  if (!categoryData.cleanliness || typeof categoryData.cleanliness !== "string") {
    throw new Error("pricingEngine: categoryData.cleanliness is required");
  }

  const cleanliness = categoryData.cleanliness.toLowerCase();
  if (!(cleanliness in CLEANLINESS_FACTOR)) {
    throw new Error(
      `pricingEngine: unknown cleanliness "${categoryData.cleanliness}". Supported: ${Object.keys(CLEANLINESS_FACTOR).join(", ")}`
    );
  }

  // Validate subtype against material's subtype table (if material has subtypes)
  const subtype = categoryData.subtype.toLowerCase();
  if (material in SUBTYPE_FACTORS) {
    if (!(subtype in SUBTYPE_FACTORS[material])) {
      throw new Error(
        `pricingEngine: unknown subtype "${categoryData.subtype}" for material "${material}". Supported: ${Object.keys(SUBTYPE_FACTORS[material]).join(", ")}`
      );
    }
  }
}

// ─── Main Calculator ─────────────────────────────────────────────────────────

/**
 * Calculate the scrap value deterministically.
 *
 * Formula:
 *   effectiveRate = baseRate × subtypeFactor × cleanlinessFactor
 *   finalPrice = weight × effectiveRate × conditionFactor
 *
 * @param {Object} input
 * @param {Object} input.data              - Resolved item data.
 * @param {string} input.data.material     - Material type.
 * @param {number} input.data.weight       - Weight in kg.
 * @param {string} input.data.condition    - Item condition.
 * @param {Object} input.categoryData      - Category-specific data (subtype, cleanliness).
 * @param {string} input.categoryData.subtype     - Material subtype.
 * @param {string} input.categoryData.cleanliness - Cleanliness level.
 *
 * @returns {Object} Pricing result with basePrice, effectiveRate, finalPrice, and breakdown.
 * @throws {Error} If any required data is missing.
 */
function calculatePrice(input) {
  // 1. Validate — throws on any missing/invalid field
  validateInput(input);

  const { data, categoryData } = input;

  const material = data.material.toLowerCase();
  const condition = data.condition.toLowerCase();
  const weight = data.weight;
  const subtype = categoryData.subtype.toLowerCase();
  const cleanliness = categoryData.cleanliness.toLowerCase();

  // 2. Look up rates
  const baseRate = MATERIAL_RATES[material];
  const conditionFactor = CONDITION_FACTOR[condition];

  // 3. Resolve subtype factor
  //    If the material has a subtype table, use it; otherwise subtypeFactor = 1.0
  const subtypeFactor = (material in SUBTYPE_FACTORS)
    ? SUBTYPE_FACTORS[material][subtype]
    : 1.0;

  // 4. Resolve cleanliness factor
  const cleanlinessFactor = CLEANLINESS_FACTOR[cleanliness];

  // 5. Calculate
  const effectiveRate = round(baseRate * subtypeFactor * cleanlinessFactor);
  const basePrice = round(weight * baseRate);
  const finalPrice = round(weight * effectiveRate * conditionFactor);

  // 6. Price range (±10%)
  const priceRange = {
    min: round(finalPrice * 0.9),
    max: round(finalPrice * 1.1),
  };

  // 7. Negotiation insights
  const negotiation = {
    dealerOffer: round(finalPrice * 0.85),
    targetPrice: finalPrice,
    minAcceptable: round(finalPrice * 0.8),
  };

  // 8. Build breakdown
  const breakdown = {
    baseRate,
    weight,
    subtypeFactor,
    cleanlinessFactor,
    effectiveRate,
    conditionFactor,
  };

  // 9. Legacy structured explanation (backward-compatible)
  const explanation = generateExplanation(material, condition, subtype, cleanliness);

  // 10. Phase 11: Rich explainability engine
  const richExplanation = generateRichExplanation(
    material, condition, subtype, cleanliness,
    { baseRate, subtypeFactor, cleanlinessFactor, conditionFactor, finalPrice, basePrice }
  );

  return {
    basePrice,
    effectiveRate,
    finalPrice,
    priceRange,
    negotiation,
    currency: "INR",
    breakdown,
    explanation,
    richExplanation,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Round to 2 decimal places to avoid floating-point artifacts.
 */
function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Build a structured, human-readable explanation of the price.
 * Preserved for backward compatibility — tests check these fields.
 *
 * @param {string} material
 * @param {string} condition
 * @param {string} subtype
 * @param {string} cleanliness
 * @returns {Object} Explanation keyed by factor.
 */
function generateExplanation(material, condition, subtype, cleanliness) {
  const explanation = {
    material: MATERIAL_EXPLANATIONS[material] || `${material} scrap`,
    condition: CONDITION_EXPLANATIONS[condition] || `${condition} condition`,
    cleanliness: CLEANLINESS_EXPLANATIONS[cleanliness] || `${cleanliness} cleanliness`,
  };

  // Add subtype explanation if the material has subtypes
  if (material in SUBTYPE_EXPLANATIONS) {
    const subtypeExpl = SUBTYPE_EXPLANATIONS[material];
    if (subtypeExpl && subtypeExpl[subtype]) {
      explanation.subtype = subtypeExpl[subtype];
    }
  }

  return explanation;
}

/**
 * Phase 11 — Rich Explainability Engine
 *
 * Returns a structured explanation with:
 *   summary   — 1-line human-readable pricing rationale
 *   positives — factors that increased the final price
 *   negatives — factors that reduced the final price
 *   tips      — actionable steps the user can take to improve value
 *
 * @param {string} material
 * @param {string} condition
 * @param {string} subtype
 * @param {string} cleanliness
 * @param {Object} factors  — numeric factors used in calculation
 * @returns {{ summary: string, positives: string[], negatives: string[], tips: string[] }}
 */
function generateRichExplanation(material, condition, subtype, cleanliness, factors) {
  const { baseRate, subtypeFactor, cleanlinessFactor, conditionFactor, finalPrice, basePrice } = factors;

  const positives = [];
  const negatives = [];
  const tips = [];

  // ── Positives ──────────────────────────────────────────────────────────

  // High-value material
  if (baseRate >= 500) {
    positives.push(`${capitalize(material)} commands a premium base rate of ₹${baseRate}/kg`);
  } else if (baseRate >= 100) {
    positives.push(`${capitalize(material)} has a solid base rate of ₹${baseRate}/kg`);
  }

  // Excellent or good condition
  if (conditionFactor === 1.0) {
    positives.push("Excellent condition — no value reduction applied");
  } else if (conditionFactor >= 0.9) {
    positives.push("Good condition retains 90% of scrap value");
  }

  // Clean material
  if (cleanlinessFactor === 1.0) {
    positives.push("Clean material — no cleaning deduction applied");
  }

  // Favorable subtype
  if (subtypeFactor === 1.0 && material in SUBTYPE_FACTORS) {
    positives.push(`${capitalize(subtype)} subtype qualifies for full material rate`);
  }

  // Ensure at least one positive
  if (positives.length === 0) {
    positives.push(`${capitalize(material)} is accepted by scrap recyclers at ₹${baseRate}/kg base rate`);
  }

  // ── Negatives ──────────────────────────────────────────────────────────

  // Poor condition
  if (conditionFactor <= 0.4) {
    negatives.push(`Heavily damaged condition reduces price by 60% (factor: ×${conditionFactor})`);
  } else if (conditionFactor <= 0.6) {
    negatives.push(`Damaged condition reduces price by 40% (factor: ×${conditionFactor})`);
  } else if (conditionFactor <= 0.75) {
    negatives.push(`Worn condition reduces price by 25% (factor: ×${conditionFactor})`);
  } else if (conditionFactor < 1.0) {
    negatives.push(`Good-but-not-excellent condition reduces price by 10% (factor: ×${conditionFactor})`);
  }

  // Dirty material
  if (cleanlinessFactor < 1.0) {
    negatives.push(`Dirty material incurs a 25% recycling penalty (factor: ×${cleanlinessFactor})`);
  }

  // Unfavorable subtype
  if (subtypeFactor < 1.0) {
    const pct = Math.round((1 - subtypeFactor) * 100);
    negatives.push(`${capitalize(subtype)} subtype reduces effective rate by ${pct}% (factor: ×${subtypeFactor})`);
  }

  // Low-value base material
  if (baseRate < 50) {
    negatives.push(`${capitalize(material)} has a low base rate (₹${baseRate}/kg) — volume is essential for meaningful returns`);
  }

  // ── Tips ───────────────────────────────────────────────────────────────

  // Condition tips
  const conditionTips = IMPROVEMENT_TIPS.condition[condition] || [];
  tips.push(...conditionTips);

  // Cleanliness tips
  const cleanlinessTips = IMPROVEMENT_TIPS.cleanliness[cleanliness] || [];
  tips.push(...cleanlinessTips);

  // Subtype tips
  const subtypeTips = IMPROVEMENT_TIPS.subtype[subtype] || [];
  tips.push(...subtypeTips);

  // Generic timing tip if value is meaningful
  if (finalPrice > 200) {
    tips.push("Check current scrap market rates — copper and aluminum prices fluctuate with commodity markets");
  }

  // De-duplicate tips
  const uniqueTips = [...new Set(tips)];

  // ── Summary ────────────────────────────────────────────────────────────

  const summary = buildSummary(material, condition, cleanliness, subtype, finalPrice, basePrice);

  return {
    summary,
    positives,
    negatives,
    tips: uniqueTips,
  };
}

/**
 * Build a 1-line summary for the pricing result.
 */
function buildSummary(material, condition, cleanliness, subtype, finalPrice, basePrice) {
  const materialName = capitalize(material);
  const conditionLabel = condition.replace("_", " ");

  if (finalPrice >= basePrice * 0.9) {
    return `${materialName} in ${conditionLabel} condition — near full value retained at ₹${finalPrice}`;
  }

  if (finalPrice >= basePrice * 0.6) {
    return `${materialName} in ${conditionLabel} condition — moderate value at ₹${finalPrice} due to condition/cleanliness factors`;
  }

  return `${materialName} in ${conditionLabel} condition — significantly reduced value at ₹${finalPrice}; improvements possible`;
}

/**
 * Capitalize first letter of a string.
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Value Improvement Engine ─────────────────────────────────────────────────

/**
 * Simulate best-case improvements and return realistic gain estimates.
 *
 * Strategy:
 *   1. Walk the condition ladder up by one step (e.g. worn → good → excellent).
 *   2. If cleanliness is "dirty", simulate "clean".
 *   3. If subtype is degraded (insulated/mixed/light/soft), simulate the best
 *      subtype available for that material.
 *   4. Calculate the improved price using the same deterministic formula.
 *   5. Return delta + plain-English suggestions.
 *
 * @param {Object} input
 * @param {Object} input.data            - Resolved item data (material, weight, condition).
 * @param {string} input.category        - Detected category string.
 * @param {Object} input.categoryData    - Current subtype + cleanliness.
 *
 * @returns {{ improvedPrice: number, delta: number, suggestions: string[] }}
 */
function getImprovementSuggestions(input) {
  if (!input || !input.data || !input.categoryData) {
    return { improvedPrice: 0, delta: 0, suggestions: [] };
  }

  const { data, categoryData } = input;
  const material   = (data.material   || "").toLowerCase();
  const condition  = (data.condition  || "").toLowerCase();
  const subtype    = (categoryData.subtype    || "").toLowerCase();
  const cleanliness = (categoryData.cleanliness || "").toLowerCase();

  // Guard — must be valid inputs
  if (!(material in MATERIAL_RATES) || !data.weight || data.weight <= 0) {
    return { improvedPrice: 0, delta: 0, suggestions: [] };
  }

  // ── 1. Calculate current price ─────────────────────────────────────────
  const currentConditionFactor  = CONDITION_FACTOR[condition] ?? 1.0;
  const currentSubtypeFactor    = (material in SUBTYPE_FACTORS && subtype in SUBTYPE_FACTORS[material])
    ? SUBTYPE_FACTORS[material][subtype]
    : 1.0;
  const currentCleanlinessFactor = CLEANLINESS_FACTOR[cleanliness] ?? 1.0;
  const baseRate = MATERIAL_RATES[material];

  const currentPrice = round(
    data.weight * baseRate * currentSubtypeFactor * currentCleanlinessFactor * currentConditionFactor
  );

  // ── 2. Build best-case simulation ─────────────────────────────────────
  const suggestions = [];

  // Condition ladder (ordered worst → best)
  const conditionLadder = ["heavily_damaged", "damaged", "worn", "good", "excellent"];
  const conditionIdx = conditionLadder.indexOf(condition);
  let bestCondition = condition;
  if (conditionIdx !== -1 && conditionIdx < conditionLadder.length - 1) {
    // Jump one step up the ladder
    bestCondition = conditionLadder[conditionIdx + 1];
    const delta1 = CONDITION_FACTOR[bestCondition] - currentConditionFactor;
    const pctGain = Math.round(delta1 * 100);
    suggestions.push(
      `Improving condition from "${condition.replace("_", " ")}" to "${bestCondition.replace("_", " ")}" ` +
      `can recover ~${pctGain}% of value`
    );
  }

  // Cleanliness upgrade
  let bestCleanliness = cleanliness;
  if (cleanliness === "dirty") {
    bestCleanliness = "clean";
    suggestions.push("Cleaning the material can recover the 25% dirty-material penalty");
  }

  // Subtype upgrade to the best available
  let bestSubtype = subtype;
  if (material in SUBTYPE_FACTORS) {
    // Find the subtype with the highest factor
    const subtypeMap = SUBTYPE_FACTORS[material];
    const bestSubtypeEntry = Object.entries(subtypeMap).reduce(
      (acc, [k, v]) => (v > acc[1] ? [k, v] : acc),
      ["", -Infinity]
    );
    if (bestSubtypeEntry[0] && bestSubtypeEntry[0] !== subtype) {
      bestSubtype = bestSubtypeEntry[0];
      const pctGain = Math.round((bestSubtypeEntry[1] - currentSubtypeFactor) * 100);
      suggestions.push(
        `Upgrading subtype from "${subtype}" to "${bestSubtype}" can add ~${pctGain}% to effective rate`
      );
    }
  }

  // ── 3. Calculate improved price ────────────────────────────────────────
  const bestConditionFactor    = CONDITION_FACTOR[bestCondition] ?? currentConditionFactor;
  const bestSubtypeFactor      = (material in SUBTYPE_FACTORS && bestSubtype in SUBTYPE_FACTORS[material])
    ? SUBTYPE_FACTORS[material][bestSubtype]
    : currentSubtypeFactor;
  const bestCleanlinessFactor  = CLEANLINESS_FACTOR[bestCleanliness] ?? currentCleanlinessFactor;

  const improvedPrice = round(
    data.weight * baseRate * bestSubtypeFactor * bestCleanlinessFactor * bestConditionFactor
  );

  const delta = round(improvedPrice - currentPrice);

  // If no improvements were found, state that
  if (suggestions.length === 0) {
    suggestions.push("Material is already at optimal condition — no further improvements possible");
  }

  return { improvedPrice, delta, suggestions };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  calculatePrice,
  validateInput,
  generateExplanation,
  generateRichExplanation,
  getImprovementSuggestions,
  // Exported for transparency and testing
  MATERIAL_RATES,
  SUBTYPE_FACTORS,
  CLEANLINESS_FACTOR,
  CONDITION_FACTOR,
  VALID_CONDITIONS,
  MATERIAL_EXPLANATIONS,
  CONDITION_EXPLANATIONS,
  SUBTYPE_EXPLANATIONS,
  CLEANLINESS_EXPLANATIONS,
};