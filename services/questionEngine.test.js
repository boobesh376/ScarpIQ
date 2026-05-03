/**
 * ScrapIQ Question Engine (Context-Aware) — Test Suite
 * =====================================================
 * Run: node services/questionEngine.test.js
 *
 * Tests the upgraded question engine with subtype + cleanliness fields.
 */

const { processInput } = require("./coreEngine");
const {
  detectCategory,
  getQuestionsForCategory,
  generateNextQuestion,
  applyUserAnswer,
  runQuestionLoop,
  extractCategoryData,
} = require("./questionEngine");

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    failures.push(testName);
    console.log(`  ❌ ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Actual:   ${JSON.stringify(actual)}`);
  }
  assert(ok, testName);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(60 - title.length)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// detectCategory
// ═══════════════════════════════════════════════════════════════════════════════

section("detectCategory");

// Metal materials
{
  const pd = { data: { material: "copper" } };
  assertEqual(detectCategory(pd, "some copper wire"), "metal", "copper → metal");
}
{
  const pd = { data: { material: "iron" } };
  assertEqual(detectCategory(pd, "iron pipe"), "metal", "iron → metal");
}
{
  const pd = { data: { material: "steel" } };
  assertEqual(detectCategory(pd, "steel beam"), "metal", "steel → metal");
}
{
  const pd = { data: { material: "aluminum" } };
  assertEqual(detectCategory(pd, "aluminum can"), "metal", "aluminum → metal");
}

// Plastic
{
  const pd = { data: { material: "plastic" } };
  assertEqual(detectCategory(pd, "plastic bottle"), "plastic", "plastic → plastic");
}

// Unknown
{
  assertEqual(detectCategory({ data: {} }, "some random thing"), "unknown", "no match → unknown");
}
{
  assertEqual(detectCategory(null, ""), "unknown", "null data → unknown");
}

// ═══════════════════════════════════════════════════════════════════════════════
// getQuestionsForCategory
// ═══════════════════════════════════════════════════════════════════════════════

section("getQuestionsForCategory");

// Metal — copper: specific question about bare/insulated
{
  const qs = getQuestionsForCategory("metal", "copper");
  const fields = qs.map((q) => q.field);
  // material is now index 0 — it must be asked before weight so the engine
  // can route to the right category-specific questions
  assertEqual(fields, ["material", "weight", "condition", "subtype", "cleanliness"], "metal copper: 5 questions with subtype + cleanliness");
  assertEqual(qs[3].question, "Is it bare copper or insulated wire?", "copper subtype question text");
  assertEqual(qs[4].question, "Is the metal clean or dirty?", "metal cleanliness question text");
}

// Metal — iron: specific question about heavy/light
{
  const qs = getQuestionsForCategory("metal", "iron");
  assertEqual(qs[3].question, "Is the iron heavy or light?", "iron subtype question text");
}

// Plastic: specific questions
{
  const qs = getQuestionsForCategory("plastic", "plastic");
  const fields = qs.map((q) => q.field);
  assertEqual(fields, ["material", "weight", "condition", "subtype", "cleanliness"], "plastic: 5 questions");
  assertEqual(qs[3].question, "Is it hard plastic or soft plastic?", "plastic subtype question text");
  assertEqual(qs[4].question, "Is it clean or contaminated?", "plastic cleanliness question text");
}

// Unknown: still has subtype + cleanliness
{
  const qs = getQuestionsForCategory("unknown");
  assertEqual(qs.length, 5, "unknown: 5 questions (core + subtype + cleanliness)");
}

// ═══════════════════════════════════════════════════════════════════════════════
// generateNextQuestion — context-aware
// ═══════════════════════════════════════════════════════════════════════════════

section("generateNextQuestion — Context-Aware");

// REQUIRED: Copper item → asks copper-specific subtype question
{
  const result = processInput({ description: "2kg copper wire", userInputs: {} });
  const q = generateNextQuestion(result, { description: "2kg copper wire", userInputs: {} });
  assertEqual(q.category, "metal", "copper → metal category");
  assertEqual(q.type, "condition", "copper: asks condition (first missing core field)");
}

// After condition → asks copper-specific subtype
{
  const state = { description: "2kg copper wire", userInputs: { condition: "good" } };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assertEqual(q.type, "subtype", "copper: asks subtype after condition resolved");
  assertEqual(q.question, "Is it bare copper or insulated wire?", "copper: uses copper-specific subtype question");
}

// After subtype → asks cleanliness
{
  const state = { description: "2kg copper wire", userInputs: { condition: "good", subtype: "bare" } };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assertEqual(q.type, "cleanliness", "copper: asks cleanliness after subtype");
  assertEqual(q.question, "Is the metal clean or dirty?", "copper: metal cleanliness question");
}

// After all answered → null
{
  const state = { description: "2kg copper wire", userInputs: { condition: "good", subtype: "bare", cleanliness: "clean" } };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assertEqual(q, null, "copper: all answered → null");
}

// REQUIRED: Missing subtype → triggers question
{
  const state = { description: "2kg copper wire", userInputs: { condition: "good" } };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assertEqual(q.type, "subtype", "REQUIRED: missing subtype triggers question");
  assert(q.question.includes("bare copper"), "REQUIRED: copper subtype question mentions bare copper");
}

// Plastic: asks subtype + cleanliness
{
  const state = { description: "2kg plastic bottle", userInputs: { condition: "good" } };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assertEqual(q.category, "plastic", "plastic bottle → plastic category");
  assertEqual(q.type, "subtype", "plastic: asks subtype");
  assertEqual(q.question, "Is it hard plastic or soft plastic?", "plastic subtype question text");
}

// After plastic subtype → cleanliness
{
  const state = { description: "2kg plastic bottle", userInputs: { condition: "good", subtype: "hard" } };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assertEqual(q.type, "cleanliness", "plastic: asks cleanliness after subtype");
  assertEqual(q.question, "Is it clean or contaminated?", "plastic cleanliness question text");
}

// After all plastic answers → null
{
  const state = { description: "2kg plastic bottle", userInputs: { condition: "good", subtype: "hard", cleanliness: "clean" } };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assertEqual(q, null, "plastic: all answered → null");
}

// Core priority still respected: weight before anything else
{
  const state = { description: "copper wire", userInputs: {} };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assertEqual(q.type, "weight", "metal: weight asked first when missing");
}

// No questions repeated (subtype already answered)
{
  const state = { description: "2kg copper wire", userInputs: { condition: "good", subtype: "bare" } };
  const result = processInput(state);
  const q = generateNextQuestion(result, state);
  assert(q.type !== "subtype", "does NOT re-ask subtype when already answered");
  assertEqual(q.type, "cleanliness", "moves to cleanliness after subtype answered");
}

// Backward compat: no state → works (unknown category, material asked first)
// UPDATED: material precedes weight so the engine can route correctly.
// When both weight and material are missing, knowing the material first is
// necessary to determine which category-specific sub-questions follow.
{
  const result = { missingFields: ["weight", "material"] };
  const q = generateNextQuestion(result);
  assertEqual(q.type, "material", "backward compat: asks material first (before weight) when both missing");
  assertEqual(q.category, "unknown", "backward compat: unknown category");
}

// ═══════════════════════════════════════════════════════════════════════════════
// applyUserAnswer — expanded fields
// ═══════════════════════════════════════════════════════════════════════════════

section("applyUserAnswer — Category Fields");

{
  const state = { description: "copper wire", userInputs: { weight: 2 } };
  const s2 = applyUserAnswer(state, { type: "subtype", value: "bare" });
  assertEqual(s2.userInputs.subtype, "bare", "subtype applied");
  assertEqual(s2.userInputs.weight, 2, "existing weight preserved");
}
{
  const s = applyUserAnswer({}, { type: "cleanliness", value: "clean" });
  assertEqual(s.userInputs.cleanliness, "clean", "cleanliness applied");
}
// Still rejects unknown fields
{
  let threw = false;
  try { applyUserAnswer({}, { type: "purity", value: "pure" }); } catch (e) { threw = true; }
  assert(threw, "rejects old field 'purity' (removed)");
}
{
  let threw = false;
  try { applyUserAnswer({}, { type: "color", value: "red" }); } catch (e) { threw = true; }
  assert(threw, "rejects unknown field 'color'");
}
// Immutability
{
  const state = { description: "x", userInputs: { weight: 1 } };
  applyUserAnswer(state, { type: "subtype", value: "bare" });
  assertEqual(state.userInputs.subtype, undefined, "original state NOT mutated");
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractCategoryData
// ═══════════════════════════════════════════════════════════════════════════════

section("extractCategoryData");

{
  const data = extractCategoryData({ subtype: "bare", cleanliness: "clean", weight: 2 }, "metal");
  assertEqual(data.subtype, "bare", "extractCategoryData includes subtype");
  assertEqual(data.cleanliness, "clean", "extractCategoryData includes cleanliness");
  assertEqual(data.weight, undefined, "extractCategoryData excludes non-category fields");
}
{
  const data = extractCategoryData({}, "metal");
  assertEqual(Object.keys(data).length, 0, "empty userInputs → empty categoryData");
}

// ═══════════════════════════════════════════════════════════════════════════════
// runQuestionLoop — Full Integration
// ═══════════════════════════════════════════════════════════════════════════════

section("runQuestionLoop — Metal Full Loop (copper)");

(async () => {
  // Copper: weight + material from description, needs condition + subtype + cleanliness
  {
    const order = [];
    const input = { description: "2kg copper wire", imageAnalysis: null, userInputs: {} };
    const provider = (q) => {
      order.push(q.type);
      return { condition: "good", subtype: "bare", cleanliness: "clean" }[q.type];
    };

    const result = await runQuestionLoop(input, provider);
    assertEqual(result.status, "READY", "metal loop → READY");
    assertEqual(result.category, "metal", "category = metal");
    assertEqual(result.data.weight, 2, "weight from description");
    assertEqual(result.data.material, "copper", "material from description");
    assertEqual(result.data.condition, "good", "condition from answer");
    assertEqual(result.categoryData.subtype, "bare", "categoryData.subtype = bare");
    assertEqual(result.categoryData.cleanliness, "clean", "categoryData.cleanliness = clean");
    assertEqual(order, ["condition", "subtype", "cleanliness"], "copper: asked condition → subtype → cleanliness");
    assertEqual(result.questionsAsked.length, 3, "3 questions asked");
  }

  section("runQuestionLoop — Plastic Full Loop");

  // Plastic: all core fields resolved from description, needs subtype + cleanliness
  {
    const order = [];
    const input = { description: "2kg plastic bottle", userInputs: { condition: "good" } };
    const provider = (q) => {
      order.push(q.type);
      return { subtype: "hard", cleanliness: "dirty" }[q.type];
    };

    const result = await runQuestionLoop(input, provider);
    assertEqual(result.status, "READY", "plastic loop → READY");
    assertEqual(result.category, "plastic", "category = plastic");
    assertEqual(result.categoryData.subtype, "hard", "categoryData.subtype = hard");
    assertEqual(result.categoryData.cleanliness, "dirty", "categoryData.cleanliness = dirty");
    assertEqual(order, ["subtype", "cleanliness"], "plastic: subtype → cleanliness");
  }

  section("runQuestionLoop — Already Complete");

  // All fields resolved → no questions
  {
    const input = {
      description: "2kg copper wire",
      imageAnalysis: null,
      userInputs: { condition: "good", subtype: "bare", cleanliness: "clean" },
    };
    const provider = () => { throw new Error("Should not be called"); };
    const result = await runQuestionLoop(input, provider);
    assertEqual(result.status, "READY", "already complete → READY");
    assertEqual(result.questionsAsked.length, 0, "no questions asked");
  }

  section("runQuestionLoop — Iron with subtype");

  // Iron: needs condition + subtype + cleanliness
  {
    const order = [];
    const input = { description: "5kg iron pipe", imageAnalysis: null, userInputs: {} };
    const provider = (q) => {
      order.push(q.type);
      return { condition: "worn", subtype: "heavy", cleanliness: "dirty" }[q.type];
    };

    const result = await runQuestionLoop(input, provider);
    assertEqual(result.status, "READY", "iron loop → READY");
    assertEqual(result.category, "metal", "category = metal");
    assertEqual(result.data.material, "iron", "material = iron");
    assertEqual(result.categoryData.subtype, "heavy", "categoryData.subtype = heavy");
    assertEqual(result.categoryData.cleanliness, "dirty", "categoryData.cleanliness = dirty");
    assert(order.includes("subtype"), "iron: asked subtype");
    assert(order.includes("cleanliness"), "iron: asked cleanliness");
  }

  section("runQuestionLoop — Question History Tracks Category");

  {
    const input = { description: "2kg copper wire", imageAnalysis: null, userInputs: {} };
    const provider = (q) => ({ condition: "damaged", subtype: "insulated", cleanliness: "dirty" }[q.type]);
    const result = await runQuestionLoop(input, provider);
    result.questionsAsked.forEach((q, i) => {
      assertEqual(q.category, "metal", `history[${i}].category = metal`);
    });
  }

  section("runQuestionLoop — No Generic Pure/Mixed Questions");

  // Verify copper does NOT ask "is it pure or mixed" — asks copper-specific question
  {
    const input = { description: "2kg copper wire", imageAnalysis: null, userInputs: {} };
    const askedQuestions = [];
    const provider = (q) => {
      askedQuestions.push(q.question);
      return { condition: "good", subtype: "bare", cleanliness: "clean" }[q.type];
    };
    await runQuestionLoop(input, provider);
    const hasGenericPurity = askedQuestions.some(q => q.toLowerCase().includes("pure or mixed"));
    assert(!hasGenericPurity, "does NOT ask generic 'pure or mixed' question");
  }

  // ── Trust Boundary — material is ALWAYS the first question when missing ──

  section("Material-First — mock source triggers material first");

  // CASE 1: MOCK_IMAGE=true, no description → very first question must be material
  {
    const input = {
      imageAnalysis: { material: "copper", confidence: 0.9, source: "mock" },
      description: "",
      userInputs: {},
    };
    const processedData = require("./coreEngine").processInput(input);
    const question = generateNextQuestion(processedData, input);
    assert(
      question !== null,
      "MOCK/no-desc: generateNextQuestion returns a question (not null)"
    );
    assertEqual(
      question && question.type,
      "material",
      "MOCK/no-desc: first question type is 'material' — NOT weight or subtype"
    );
  }

  // CASE 1 via runQuestionLoop: first question string matches material prompt
  {
    const input = {
      imageAnalysis: { material: "copper", confidence: 0.9, source: "mock" },
      description: "",
      userInputs: {},
    };
    let firstQuestionType = null;
    const provider = (q) => {
      if (firstQuestionType === null) firstQuestionType = q.type;
      // Provide minimal answers to satisfy the loop
      if (q.type === "material")  return "iron";
      if (q.type === "weight")    return 3;
      if (q.type === "condition") return "good";
      if (q.type === "subtype")   return "heavy";
      if (q.type === "cleanliness") return "clean";
    };
    await runQuestionLoop(input, provider);
    assertEqual(
      firstQuestionType,
      "material",
      "MOCK loop: very first question asked is 'material'"
    );
  }

  // CASE 2: description = "plastic chair" (mock ignored) → material resolved, no material question
  {
    const input = {
      imageAnalysis: { material: "copper", confidence: 0.9, source: "mock" },
      description: "plastic chair",
      userInputs: {},
    };
    const processedData = require("./coreEngine").processInput(input);
    assert(
      !processedData.missingFields.includes("material"),
      "CASE 2 [plastic-desc]: material NOT missing after description parsing"
    );
    const askedTypes = [];
    const provider = (q) => {
      askedTypes.push(q.type);
      if (q.type === "weight")    return 2;
      if (q.type === "condition") return "good";
      if (q.type === "subtype")   return "hard";
      if (q.type === "cleanliness") return "clean";
    };
    await runQuestionLoop(input, provider);
    assert(
      !askedTypes.includes("material"),
      "CASE 2 [plastic-desc]: material question is NOT asked (already resolved)"
    );
  }

  // When both weight and material are missing, material question still comes first
  {
    const input = {
      imageAnalysis: null,
      description: "",
      userInputs: {},
    };
    let firstType = null;
    const provider = (q) => {
      if (firstType === null) firstType = q.type;
      if (q.type === "material")    return "steel";
      if (q.type === "weight")      return 5;
      if (q.type === "condition")   return "good";
      if (q.type === "subtype")     return "beam";
      if (q.type === "cleanliness") return "clean";
    };
    await runQuestionLoop(input, provider);
    assertEqual(
      firstType,
      "material",
      "No-input loop: material is asked BEFORE weight even when both are missing"
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(64)}`);
  console.log(`  TOTAL: ${passed + failed}  |  ✅ PASSED: ${passed}  |  ❌ FAILED: ${failed}`);
  console.log(`${"═".repeat(64)}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    failures.forEach((f) => console.log(`  • ${f}`));
    process.exit(1);
  } else {
    console.log("\n🎉 ALL TESTS PASSED — Context-aware question engine is strict and smart.\n");
    process.exit(0);
  }
})();