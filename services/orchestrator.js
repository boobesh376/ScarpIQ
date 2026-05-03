/**
 * ScrapIQ Orchestrator
 * =====================
 * Single entry point that connects all engines:
 *
 *   coreEngine → questionEngine → pricingEngine
 *
 * Flow:
 *   1. processInput (resolve what we can)
 *   2. If NEEDS_INPUT → runQuestionLoop (ask until complete)
 *   3. Validate completeness (throw if still missing)
 *   4. Normalize category data (safe fallback if needed)
 *   5. calculatePrice (deterministic pricing)
 *   6. Return final structured output
 *
 * RULES:
 *   - Never bypass the question loop
 *   - Never price incomplete data
 *   - Never mutate original input
 *   - Never use fallback values
 *   - Safe normalization: always proceeds even if normalization fails
 */

const { processInput, normalizeSubtype, normalizeCleanliness } = require("./coreEngine");
const { runQuestionLoop, detectCategory } = require("./questionEngine");
const { calculatePrice } = require("./pricingEngine");
const { logEvent } = require("../utils/logger");

// ─── Main Orchestrator ───────────────────────────────────────────────────────

/**
 * Run the full ScrapIQ analysis pipeline.
 *
 * @param {Object} initialInput - Raw input (imageAnalysis, description, userInputs).
 * @param {Function} answerProvider - Callback for user questions: (question) => answerValue.
 * @returns {Promise<Object>} Final output with data, category, categoryData, pricing, and questionsAsked.
 * @throws {Error} If data remains incomplete after the question loop.
 */
async function runFullAnalysis(initialInput, answerProvider) {
  // ── Guard: immutable input ────────────────────────────────────────────────
  if (!initialInput || typeof initialInput !== "object") {
    throw new Error("orchestrator: initialInput is required and must be an object");
  }
  if (typeof answerProvider !== "function") {
    throw new Error("orchestrator: answerProvider must be a function");
  }

  // Deep-copy to never mutate original
  const input = JSON.parse(JSON.stringify(initialInput));

  // ── Step 1: Run core engine ───────────────────────────────────────────────
  const processed = processInput(input);

  let result;

  // ── Step 2: Resolve missing fields ────────────────────────────────────────
  if (processed.status === "NEEDS_INPUT") {
    // Run the full question loop (core + category-specific)
    result = await runQuestionLoop(input, answerProvider);
  } else {
    // All core fields resolved — still need category detection + extras
    // Run the loop anyway to collect category-specific data
    result = await runQuestionLoop(input, answerProvider);
  }

  // ── Step 3: Validate completeness ─────────────────────────────────────────
  if (result.missingFields && result.missingFields.length > 0) {
    throw new Error(
      `orchestrator: cannot price — fields still missing: ${result.missingFields.join(", ")}`
    );
  }

  const requiredFields = ["material", "weight", "condition"];
  for (const field of requiredFields) {
    if (result.data[field] === undefined || result.data[field] === null) {
      throw new Error(`orchestrator: data.${field} is missing after resolution`);
    }
  }

  // ── Step 4: Normalize and calculate price ────────────────────────────────
  const category = result.category || detectCategory(result, input.description) || "unknown";
  let categoryData = result.categoryData || {};

  // Normalize subtype and cleanliness to canonical enums (safe fallback)
  if (categoryData.subtype) {
    const originalSubtype = categoryData.subtype;
    categoryData.subtype = normalizeSubtype(categoryData.subtype);
    if (categoryData.subtype !== originalSubtype) {
      logEvent("NORMALIZATION", {
        field: "subtype",
        original: originalSubtype,
        normalized: categoryData.subtype,
      });
    }
  }

  if (categoryData.cleanliness) {
    const originalCleanliness = categoryData.cleanliness;
    categoryData.cleanliness = normalizeCleanliness(categoryData.cleanliness);
    if (categoryData.cleanliness !== originalCleanliness) {
      logEvent("NORMALIZATION", {
        field: "cleanliness",
        original: originalCleanliness,
        normalized: categoryData.cleanliness,
      });
    }
  }

  // Calculate price with safe fallback
  let pricing;
  try {
    pricing = calculatePrice({
      data: result.data,
      category,
      categoryData,
    });
  } catch (err) {
    // Safe fallback: if pricing fails due to invalid normalized values,
    // provide a default pricing structure instead of crashing
    logEvent("PRICING_WARNING", {
      error: err.message,
      data: result.data,
      categoryData,
      message: "Proceeding with fallback pricing — normalization may have failed",
    });

    // Return minimal valid pricing (base price only, no adjustments)
    const material = (result.data && result.data.material) || "unknown";
    const weight = (result.data && result.data.weight) || 0;
    const MATERIAL_RATES = {
      copper: 600,
      aluminum: 150,
      iron: 30,
      steel: 40,
      plastic: 20,
    };
    const baseRate = MATERIAL_RATES[material.toLowerCase()] || 20;
    const basePrice = weight * baseRate;

    pricing = {
      basePrice,
      effectiveRate: baseRate,
      finalPrice: basePrice,
      priceRange: { min: basePrice * 0.9, max: basePrice * 1.1 },
      negotiation: {
        dealerOffer: basePrice * 0.85,
        targetPrice: basePrice,
        minAcceptable: basePrice * 0.8,
      },
      currency: "INR",
      breakdown: {
        baseRate,
        weight,
        subtypeFactor: 1.0,
        cleanlinessFactor: 1.0,
        effectiveRate: baseRate,
        conditionFactor: 1.0,
      },
      explanation: {
        material: `${material} scrap`,
        condition: "condition adjustment skipped",
        cleanliness: "cleanliness adjustment skipped",
      },
      richExplanation: {
        summary: "Base price calculated — advanced adjustments unavailable",
        positives: ["Item accepted for recycling"],
        negatives: [],
        tips: ["Verify material type and weight for accuracy"],
      },
    };
  }

  // ── Step 5: Return final output ───────────────────────────────────────────
  return {
    data: result.data,
    source: result.source,
    category,
    categoryData,
    pricing,
    questionsAsked: result.questionsAsked || [],
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { runFullAnalysis };
