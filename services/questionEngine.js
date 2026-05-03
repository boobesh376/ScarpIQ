/**
 * ScrapIQ Question Engine (Context-Aware)
 * ========================================
 * Deterministic, category-aware question system.
 *
 * PRINCIPLE: Ask ONE question at a time, in priority order.
 * Only ask questions that directly affect pricing.
 * Never guess. Never batch. Never skip re-processing.
 *
 * Categories: metal | plastic | unknown
 * Each category has tailored questions for subtype + cleanliness.
 */

const { processInput } = require("./coreEngine");

// ─── Constants ───────────────────────────────────────────────────────────────

const METAL_MATERIALS = ["copper", "iron", "steel", "aluminum"];

const VALID_FIELDS = [
  "weight", "material", "condition",
  "subtype", "cleanliness",
];

// ─── Category Detection ─────────────────────────────────────────────────────

function detectCategory(processedData, description) {
  const material = (processedData && processedData.data && processedData.data.material)
    ? processedData.data.material.toLowerCase()
    : "";

  if (METAL_MATERIALS.includes(material)) return "metal";
  if (material === "plastic") return "plastic";
  return "unknown";
}

// ─── Category Question Registry ─────────────────────────────────────────────

function getQuestionsForCategory(category, material) {
  // PRIORITY: material is always asked first.
  // Knowing the material determines which category-specific sub-questions
  // follow. Without it we cannot ask the right subtype/cleanliness questions,
  // so it takes precedence over weight and condition.
  const questions = [
    { field: "material", question: "What material is this item made of? (e.g., copper, iron, aluminum, plastic, steel)", isCore: true },
    { field: "weight", question: "What is the approximate weight (in kg)?", isCore: true },
    { field: "condition", question: "What is the condition? (excellent / good / worn / damaged / heavily_damaged)", isCore: true },
  ];

  const mat = (material || "").toLowerCase();

  switch (category) {
    case "metal":
      if (mat === "copper") {
        questions.push({ field: "subtype", question: "Is it bare copper or insulated wire?", isCore: false });
      } else if (mat === "iron") {
        questions.push({ field: "subtype", question: "Is the iron heavy or light?", isCore: false });
      } else {
        questions.push({ field: "subtype", question: "What is the subtype of this metal?", isCore: false });
      }
      questions.push({ field: "cleanliness", question: "Is the metal clean or dirty?", isCore: false });
      break;

    case "plastic":
      questions.push({ field: "subtype", question: "Is it hard plastic or soft plastic?", isCore: false });
      questions.push({ field: "cleanliness", question: "Is it clean or contaminated?", isCore: false });
      break;

    default:
      questions.push({ field: "subtype", question: "What is the subtype of this material?", isCore: false });
      questions.push({ field: "cleanliness", question: "Is it clean or dirty?", isCore: false });
      break;
  }

  return questions;
}

// ─── generateNextQuestion ────────────────────────────────────────────────────

function generateNextQuestion(processedData, state) {
  if (!processedData || !Array.isArray(processedData.missingFields)) {
    return null;
  }

  const description = (state && state.description) || "";
  const userInputs = (state && state.userInputs) || {};
  const category = detectCategory(processedData, description);

  const material = (processedData.data && processedData.data.material)
    ? processedData.data.material.toLowerCase()
    : "";

  const questions = getQuestionsForCategory(category, material);

  for (const q of questions) {
    if (q.isCore) {
      // TASK 3: Do NOT ask material if it is already resolved (not in missingFields)
      if (q.field === "material" && !processedData.missingFields.includes("material")) {
        continue;
      }
      if (processedData.missingFields.includes(q.field)) {
        return { type: q.field, question: q.question, category };
      }
    } else {
      if (userInputs[q.field] === undefined || userInputs[q.field] === null) {
        return { type: q.field, question: q.question, category };
      }
    }
  }

  return null;
}

// ─── applyUserAnswer ─────────────────────────────────────────────────────────

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
    description: (state && state.description) || "",
    imageAnalysis: (state && state.imageAnalysis) || null,
    userInputs: {
      ...currentInputs,
      [answer.type]: answer.value,
    },
  };
}

// ─── runQuestionLoop ─────────────────────────────────────────────────────────

async function runQuestionLoop(initialInput, answerProvider, options = {}) {
  const maxIterations = options.maxIterations || 10;

  if (typeof answerProvider !== "function") {
    throw new Error("runQuestionLoop: answerProvider must be a function");
  }

  let state = { ...initialInput };
  let iterations = 0;
  const questionsAsked = [];

  while (iterations < maxIterations) {
    iterations++;

    const result = processInput(state);
    const question = generateNextQuestion(result, state);

    if (!question) {
      const category = detectCategory(result, state.description);
      const categoryData = extractCategoryData(state.userInputs, category);
      return { ...result, category, categoryData, questionsAsked };
    }

    const answerValue = await answerProvider(question);

    questionsAsked.push({
      question: question.question,
      type: question.type,
      category: question.category,
      answer: answerValue,
    });

    state = applyUserAnswer(state, { type: question.type, value: answerValue });
  }

  throw new Error(
    `runQuestionLoop: exceeded ${maxIterations} iterations — possible infinite loop`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractCategoryData(userInputs, category) {
  const inputs = userInputs || {};
  const data = {};

  if (inputs.subtype !== undefined && inputs.subtype !== null) {
    data.subtype = inputs.subtype;
  }
  if (inputs.cleanliness !== undefined && inputs.cleanliness !== null) {
    data.cleanliness = inputs.cleanliness;
  }

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