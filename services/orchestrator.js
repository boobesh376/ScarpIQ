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
 *   4. calculatePrice (deterministic pricing)
 *   5. Return final structured output
 *
 * RULES:
 *   - Never bypass the question loop
 *   - Never price incomplete data
 *   - Never mutate original input
 *   - Never use fallback values
 */

const { processInput } = require("./coreEngine");
const { runQuestionLoop, detectCategory } = require("./questionEngine");
const { calculatePrice } = require("./pricingEngine");

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

  // ── Step 4: Calculate price ───────────────────────────────────────────────
  const category = result.category || detectCategory(result, input.description) || "unknown";
  const categoryData = result.categoryData || {};

  const pricing = calculatePrice({
    data: result.data,
    category,
    categoryData,
  });

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
