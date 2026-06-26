/**
 * ScrapIQ Question Engine (Context-Aware)
 * ========================================
 * Deterministic, category-aware, material-specific question sequencer.
 *
 * PRINCIPLE: Ask ONE question at a time, in priority order.
 * Only ask questions that directly affect pricing.
 * Never guess. Never batch. Never skip re-processing.
 *
 * ── Field Resolution Policy ──────────────────────────────────────────────────
 *
 *   Material  : AI auto-detects. Asked only if AI fails AND description has no signal.
 *   Weight    : Always required. Asked if not in userInputs or description.
 *   Condition : Resolved from description keywords when possible (e.g. "rusty" → damaged,
 *               "excellent condition" → excellent). Asked only if description has no signal
 *               and AI has no estimate. User can always override.
 *   Subtype   : Material-specific. Asked when the material has subtypes that affect pricing.
 *   Cleanliness: Asked when it affects valuation (most materials).
 *   RustSeverity: Iron-specific.
 *   Quantity  : Only asked when quantityApplicable = true for the resolved material+subtype.
 *               NEVER asked for copper wire, most metals where weight is sufficient.
 *
 * ── Quantity Applicability Rules ─────────────────────────────────────────────
 *
 *   Quantity is meaningful when items are discrete/countable and quantity affects
 *   negotiation or sorting effort (e.g. rods vs wire vs sheets).
 *
 *   quantityApplicable = true:
 *     iron (rods, bars, heavy iron)
 *     cardboard / paper bundles (plastic category treated as bundles)
 *     mixed scrap (unknown category)
 *
 *   quantityApplicable = false (weight is sufficient):
 *     copper (wire — weight tells the full story)
 *     aluminum (sheets, cans — weight is the metric)
 *     steel (structural — weight-based)
 *     plastic (weight-based for hard/soft)
 *
 * ── Question Order Per Material ──────────────────────────────────────────────
 *
 *   Aluminium  : weight → subtype → cleanliness → [condition if needed]
 *   Copper     : weight → subtype (bare/insulated) → cleanliness → [condition]
 *   Iron       : weight → rustSeverity → subtype → cleanliness → quantity → [condition]
 *   Steel      : weight → subtype → cleanliness → [condition]
 *   Plastic    : weight → subtype (hard/soft) → cleanliness → [condition]
 *   Mixed/Unk  : [material] → weight → subtype → cleanliness → quantity → [condition]
 *
 * Categories: metal | plastic | unknown
 */

const { processInput } = require("./coreEngine");

// ─── Constants ───────────────────────────────────────────────────────────────

const METAL_MATERIALS = ["copper", "iron", "steel", "aluminum", "brass"];

const VALID_FIELDS = [
  "weight",
  "material",
  "condition",
  "subtype",
  "cleanliness",
  "rustSeverity",
  "quantity",
];

// ─── Quantity: Removed ───────────────────────────────────────────────────────
//
// Audited against pricingEngine.js (calculatePrice, validateInput,
// getImprovementSuggestions) — quantity does not appear in any formula.
// Removed from question flow: was adding UX friction for zero pricing impact.

// ─── Category Detection ─────────────────────────────────────────────────────

function detectCategory(processedData, description) {
  const material = (processedData && processedData.data && processedData.data.material)
    ? processedData.data.material.toLowerCase()
    : "";

  if (METAL_MATERIALS.includes(material)) return "metal";
  if (material === "plastic") return "plastic";
  return "unknown";
}

// ─── Question Registry ───────────────────────────────────────────────────────

/**
 * Returns the ordered question list for a given category + material.
 *
 * Each entry:
 *   field    — the userInputs key this question fills
 *   question — human-readable prompt
 *   isCore   — true: must be in processedData.missingFields to be asked
 *              false: asked when userInputs[field] is absent (regardless of missingFields)
 *
 * isCore: true fields:
 *   material  — only if AI/description could not resolve it
 *   weight    — always (unless description provides it)
 *   condition — only if description AND AI could not resolve it
 *
 * isCore: false fields (material-specific, always asked in order):
 *   subtype, cleanliness, rustSeverity, quantity
 *
 * @param {string} category  - "metal" | "plastic" | "unknown"
 * @param {string} material  - resolved material (lowercase), may be ""
 * @returns {Array<{field: string, question: string, isCore: boolean}>}
 */
function getQuestionsForCategory(category, material) {
  const mat = (material || "").toLowerCase();

  const questions = [
    // Material: asked only when AI+description both failed
    { field: "material",  question: "What material is this item made of?", isCore: true },
    // Weight: asked when not in userInputs and not parseable from description
    { field: "weight",    question: "What is the weight? (in kg)",          isCore: true },
  ];

  // ── Material-specific questions (non-core, always asked in sequence) ────
  switch (category) {
    case "metal":
      if (mat === "copper") {
        questions.push({
          field: "subtype",
          question: "Is it bare copper or insulated wire?",
          isCore: false,
        });
      } else if (mat === "aluminum") {
        questions.push({
          field: "subtype",
          question: "Is it pure aluminum, mixed aluminum, or aluminum cans?",
          isCore: false,
        });
      } else if (mat === "iron") {
        // Iron: rustSeverity comes before subtype because it directly affects condition assessment
        questions.push({
          field: "rustSeverity",
          question: "How severe is the rust? (minimal / moderate / severe)",
          isCore: false,
        });
        questions.push({
          field: "subtype",
          question: "Is it heavy iron or light iron?",
          isCore: false,
        });
      } else if (mat === "brass") {
        questions.push({
          field: "subtype",
          question: "Is it pure brass or mixed with other materials?",
          isCore: false,
        });
      } else if (mat === "steel") {
        questions.push({
          field: "subtype",
          question: "Is it stainless steel or mild steel?",
          isCore: false,
        });
      } else {
        // Unknown metal subtype
        questions.push({
          field: "subtype",
          question: "What is the subtype of this metal?",
          isCore: false,
        });
      }
      questions.push({
        field: "cleanliness",
        question: "Is the metal clean or dirty?",
        isCore: false,
      });
      break;

    case "plastic":
      questions.push({
        field: "subtype",
        question: "Is it hard plastic or soft plastic?",
        isCore: false,
      });
      questions.push({
        field: "cleanliness",
        question: "Is it clean or contaminated?",
        isCore: false,
      });
      break;

    default:
      // Mixed / unknown
      questions.push({
        field: "subtype",
        question: "What is the primary material or material mix?",
        isCore: false,
      });
      questions.push({
        field: "cleanliness",
        question: "Is it clean or dirty?",
        isCore: false,
      });
      break;
  }

  // Condition: only asked if not resolved from description or AI
  // isCore: true — skipped automatically when processedData.missingFields excludes it
  questions.push({
    field: "condition",
    question: "What is the overall condition of the material?",
    isCore: true,
  });

  return questions;
}

// ─── generateNextQuestion ────────────────────────────────────────────────────

/**
 * Determine the next question to ask given the current resolved state.
 *
 * Algorithm:
 *   1. First, walk through ALL isCore questions in order
 *      - For each isCore question: ask if the field is still in missingFields
 *      - RETURN immediately when found (don't check non-core questions yet)
 *   2. Only after all core questions are resolved, walk non-core questions
 *      - For each non-core question: ask if userInputs[field] is not yet set
 *      - BUT only after material is resolved (so the right subtype options show)
 *   3. Return null when all questions are satisfied → valuation can proceed.
 *
 * This ensures a deterministic order:
 *   material → weight → condition → [material-specific questions] → cleanliness → quantity
 *
 * @param {Object} processedData - Output of processInput()
 * @param {Object} state         - Current { description, userInputs, imageAnalysis }
 * @returns {{ type, question, category } | null}
 */
function generateNextQuestion(processedData, state) {
  if (!processedData || !Array.isArray(processedData.missingFields)) {
    return null;
  }

  const description = (state && state.description) || "";
  const userInputs  = (state && state.userInputs)  || {};
  const category    = detectCategory(processedData, description);

  const material = (processedData.data && processedData.data.material)
    ? processedData.data.material.toLowerCase()
    : "";

  const questions = getQuestionsForCategory(category, material);

  // ── PHASE 1: Check all CORE questions first ────────────────────────────
  // Walk the entire list looking for isCore questions that are still unresolved
  for (const q of questions) {
    if (q.isCore) {
      // Skip material question when already resolved
      if (q.field === "material" && !processedData.missingFields.includes("material")) {
        continue;
      }
      // Ask this core question only if the field is still unresolved
      if (processedData.missingFields.includes(q.field)) {
        return { type: q.field, question: q.question, category };
      }
    }
  }

  // ── PHASE 2: Only after all core questions, check NON-CORE questions ──
  // Non-core questions should only be asked after material is resolved
  // (otherwise we'd ask iron-specific subtype before knowing it's iron)
  if (!processedData.missingFields.includes("material")) {
    for (const q of questions) {
      if (!q.isCore) {
        // Ask if the user hasn't answered this field yet.
        // Guard against undefined, null, AND empty string — an empty string
        // is not a valid answer and would cause pricing to fail silently.
        const val = userInputs[q.field];
        const isMissing =
          val === undefined ||
          val === null ||
          (typeof val === "string" && val.trim() === "");
        if (isMissing) {
          return { type: q.field, question: q.question, category };
        }
      }
    }
  }

  return null;
}

// ─── applyUserAnswer ─────────────────────────────────────────────────────────

/**
 * Apply a user's answer to the current state, returning a new state.
 * Immutable — does not mutate the original state object.
 *
 * @param {Object} state   - Current state { description, imageAnalysis, userInputs }
 * @param {Object} answer  - { type: string, value: string|number }
 * @returns {Object} New state with the answer applied to userInputs.
 */
function applyUserAnswer(state, answer) {
  if (!answer || typeof answer !== "object") {
    throw new Error("applyUserAnswer: answer must be a non-null object");
  }
  if (!answer.type || typeof answer.type !== "string") {
    throw new Error("applyUserAnswer: answer.type is required and must be a string");
  }
  if (answer.value === null || answer.value === undefined) {
    throw new Error("applyUserAnswer: answer.value is required — do not pass null/undefined");
  }
  if (!VALID_FIELDS.includes(answer.type)) {
    throw new Error(
      `applyUserAnswer: unknown field "${answer.type}". Must be one of: ${VALID_FIELDS.join(", ")}`
    );
  }

  const currentInputs = (state && state.userInputs) || {};

  return {
    description:   (state && state.description)   || "",
    imageAnalysis: (state && state.imageAnalysis)  || null,
    userInputs: {
      ...currentInputs,
      [answer.type]: answer.value,
    },
  };
}

// ─── runQuestionLoop ─────────────────────────────────────────────────────────

/**
 * Run the full question loop programmatically (for testing / CLI flows).
 *
 * @param {Object}   initialInput   - { description, imageAnalysis, userInputs }
 * @param {Function} answerProvider - Async fn(question) → answer value
 * @param {Object}   [options]      - { maxIterations: number }
 */
async function runQuestionLoop(initialInput, answerProvider, options = {}) {
  const maxIterations = options.maxIterations || 12;

  if (typeof answerProvider !== "function") {
    throw new Error("runQuestionLoop: answerProvider must be a function");
  }

  let state      = { ...initialInput };
  let iterations = 0;
  const questionsAsked = [];

  while (iterations < maxIterations) {
    iterations++;

    const result   = processInput(state);
    const question = generateNextQuestion(result, state);

    if (!question) {
      const category     = detectCategory(result, state.description);
      const categoryData = extractCategoryData(state.userInputs, category);
      return { ...result, category, categoryData, questionsAsked };
    }

    const answerValue = await answerProvider(question);

    questionsAsked.push({
      question: question.question,
      type:     question.type,
      category: question.category,
      answer:   answerValue,
    });

    state = applyUserAnswer(state, { type: question.type, value: answerValue });
  }

  throw new Error(
    `runQuestionLoop: exceeded ${maxIterations} iterations — possible infinite loop`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract category-specific data from userInputs for the pricing engine.
 *
 * @param {Object} userInputs
 * @param {string} category
 * @returns {Object}
 */
function extractCategoryData(userInputs, category) {
  const inputs = userInputs || {};
  const data   = {};

  if (inputs.subtype      !== undefined && inputs.subtype      !== null) data.subtype      = inputs.subtype;
  if (inputs.cleanliness  !== undefined && inputs.cleanliness  !== null) data.cleanliness  = inputs.cleanliness;
  if (inputs.rustSeverity !== undefined && inputs.rustSeverity !== null) data.rustSeverity = inputs.rustSeverity;
  if (inputs.quantity     !== undefined && inputs.quantity     !== null) data.quantity     = inputs.quantity;

  return data;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  detectCategory,
  getQuestionsForCategory,
  generateNextQuestion,
  applyUserAnswer,
  runQuestionLoop,
  extractCategoryData,
  VALID_FIELDS,
  METAL_MATERIALS,
};