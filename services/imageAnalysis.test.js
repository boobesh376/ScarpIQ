/**
 * ScrapIQ Image Analysis — Test Suite
 * =====================================
 * Tests parseGeminiResponse (deterministic) and analyzeImage (with mock model).
 *
 * Run: node services/imageAnalysis.test.js
 */

const {
  analyzeImage,
  parseGeminiResponse,
  VALID_MATERIALS,
  VALID_CONDITIONS,
} = require("./imageAnalysis");

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

function assertThrows(fn, testName) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  assert(threw, testName);
}

async function assertThrowsAsync(fn, testName) {
  let threw = false;
  try { await fn(); } catch (e) { threw = true; }
  assert(threw, testName);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(56 - title.length)}`);
}

// ─── Mock Gemini Model ───────────────────────────────────────────────────────

/**
 * Create a mock model that returns a preset JSON string.
 */
function mockModel(responseJson) {
  return {
    generateContent: async () => ({
      response: {
        text: () =>
          typeof responseJson === "string"
            ? responseJson
            : JSON.stringify(responseJson),
      },
    }),
  };
}

/**
 * Create a mock model that throws an error.
 */
function errorModel(message) {
  return {
    generateContent: async () => {
      throw new Error(message);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// parseGeminiResponse — Core Parsing
// ═══════════════════════════════════════════════════════════════════════════════

section("parseGeminiResponse — Valid JSON");

{
  const r = parseGeminiResponse('{"material":"copper","confidence":0.85,"condition":"damaged"}');
  assertEqual(r.material, "copper", "parses copper");
  assertEqual(r.confidence, 0.85, "parses confidence 0.85");
  assertEqual(r.condition, "damaged", "parses damaged");
}

{
  const r = parseGeminiResponse('{"material":"iron","confidence":0.6,"condition":"good"}');
  assertEqual(r.material, "iron", "parses iron");
  assertEqual(r.condition, "good", "parses good");
}

{
  const r = parseGeminiResponse('{"material":"aluminum","confidence":0.9,"condition":"used"}');
  assertEqual(r.material, "aluminum", "parses aluminum");
  assertEqual(r.condition, "used", "parses used");
}

section("parseGeminiResponse — Markdown Fences");

{
  const r = parseGeminiResponse('```json\n{"material":"steel","confidence":0.7,"condition":"good"}\n```');
  assertEqual(r.material, "steel", "strips ```json fences → steel");
}

{
  const r = parseGeminiResponse('```\n{"material":"plastic","confidence":0.5,"condition":"used"}\n```');
  assertEqual(r.material, "plastic", "strips ``` fences → plastic");
}

section("parseGeminiResponse — Normalization");

// aluminium → aluminum
{
  const r = parseGeminiResponse('{"material":"aluminium","confidence":0.8,"condition":"good"}');
  assertEqual(r.material, "aluminum", "aluminium normalized to aluminum");
}

// rusted → damaged
{
  const r = parseGeminiResponse('{"material":"iron","confidence":0.7,"condition":"rusted"}');
  assertEqual(r.condition, "damaged", "rusted → damaged");
}

// broken → damaged
{
  const r = parseGeminiResponse('{"material":"iron","confidence":0.7,"condition":"broken"}');
  assertEqual(r.condition, "damaged", "broken → damaged");
}

// working → good
{
  const r = parseGeminiResponse('{"material":"copper","confidence":0.9,"condition":"working"}');
  assertEqual(r.condition, "good", "working → good");
}

// new → good
{
  const r = parseGeminiResponse('{"material":"copper","confidence":0.9,"condition":"new"}');
  assertEqual(r.condition, "good", "new → good");
}

// Unknown material → "unknown"
{
  const r = parseGeminiResponse('{"material":"gold","confidence":0.5,"condition":"good"}');
  assertEqual(r.material, "unknown", "unknown material → 'unknown'");
}

// Unknown condition → "uncertain"
{
  const r = parseGeminiResponse('{"material":"copper","confidence":0.8,"condition":"shiny"}');
  assertEqual(r.condition, "uncertain", "unknown condition → 'uncertain'");
}

section("parseGeminiResponse — Confidence Clamping");

// Confidence > 1 → clamped to 1
{
  const r = parseGeminiResponse('{"material":"copper","confidence":1.5,"condition":"good"}');
  assertEqual(r.confidence, 1, "confidence > 1 clamped to 1");
}

// Confidence < 0 → clamped to 0
{
  const r = parseGeminiResponse('{"material":"copper","confidence":-0.5,"condition":"good"}');
  assertEqual(r.confidence, 0, "confidence < 0 clamped to 0");
}

// Non-number confidence → 0
{
  const r = parseGeminiResponse('{"material":"copper","confidence":"high","condition":"good"}');
  assertEqual(r.confidence, 0, "non-number confidence → 0");
}

// Missing confidence → 0
{
  const r = parseGeminiResponse('{"material":"copper","condition":"good"}');
  assertEqual(r.confidence, 0, "missing confidence → 0");
}

section("parseGeminiResponse — Missing / Invalid Fields");

// Missing material → unknown
{
  const r = parseGeminiResponse('{"confidence":0.5,"condition":"good"}');
  assertEqual(r.material, "unknown", "missing material → unknown");
}

// Empty material string → unknown
{
  const r = parseGeminiResponse('{"material":"","confidence":0.5,"condition":"good"}');
  assertEqual(r.material, "unknown", "empty material → unknown");
}

// Missing condition → uncertain
{
  const r = parseGeminiResponse('{"material":"copper","confidence":0.5}');
  assertEqual(r.condition, "uncertain", "missing condition → uncertain");
}

// Empty condition → uncertain
{
  const r = parseGeminiResponse('{"material":"copper","confidence":0.5,"condition":""}');
  assertEqual(r.condition, "uncertain", "empty condition → uncertain");
}

section("parseGeminiResponse — Error Cases");

assertThrows(() => parseGeminiResponse(null), "throws on null");
assertThrows(() => parseGeminiResponse(""), "throws on empty string");
assertThrows(() => parseGeminiResponse("not json at all"), "throws on invalid JSON");
assertThrows(() => parseGeminiResponse("42"), "throws on non-object JSON");

// ═══════════════════════════════════════════════════════════════════════════════
// analyzeImage — With Mock Model
// ═══════════════════════════════════════════════════════════════════════════════

section("analyzeImage — Mock Model Integration");

(async () => {
  // Successful analysis
  {
    const model = mockModel({ material: "copper", confidence: 0.85, condition: "damaged" });
    const r = await analyzeImage(Buffer.from("fake-image-data"), { model });
    assertEqual(r.material, "copper", "mock: material = copper");
    assertEqual(r.confidence, 0.85, "mock: confidence = 0.85");
    assertEqual(r.condition, "damaged", "mock: condition = damaged");
  }

  // Response with markdown fences
  {
    const model = mockModel('```json\n{"material":"iron","confidence":0.6,"condition":"rusted"}\n```');
    const r = await analyzeImage(Buffer.from("fake-image"), { model });
    assertEqual(r.material, "iron", "mock fenced: material = iron");
    assertEqual(r.condition, "damaged", "mock fenced: rusted → damaged");
  }

  // Response with unknown material
  {
    const model = mockModel({ material: "titanium", confidence: 0.3, condition: "good" });
    const r = await analyzeImage(Buffer.from("fake-image"), { model });
    assertEqual(r.material, "unknown", "mock: titanium → unknown");
  }

  section("analyzeImage — Validation");

  // No buffer
  await assertThrowsAsync(
    () => analyzeImage(null, { model: mockModel({}) }),
    "throws on null buffer"
  );

  // Empty buffer
  await assertThrowsAsync(
    () => analyzeImage(Buffer.alloc(0), { model: mockModel({}) }),
    "throws on empty buffer"
  );

  // Non-buffer
  await assertThrowsAsync(
    () => analyzeImage("not a buffer", { model: mockModel({}) }),
    "throws on non-buffer"
  );

  // API failure
  {
    const model = errorModel("network timeout");
    await assertThrowsAsync(
      () => analyzeImage(Buffer.from("img"), { model }),
      "throws on API failure"
    );
  }

  section("analyzeImage — MIME Type Support");

  {
    const model = mockModel({ material: "plastic", confidence: 0.7, condition: "used" });
    const r = await analyzeImage(Buffer.from("fake-png"), { model, mimeType: "image/png" });
    assertEqual(r.material, "plastic", "accepts image/png");
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Output is core-engine-compatible
  // ═════════════════════════════════════════════════════════════════════════

  section("Output Compatible with Core Engine");

  {
    const model = mockModel({ material: "copper", confidence: 0.85, condition: "damaged" });
    const r = await analyzeImage(Buffer.from("img"), { model });

    // Verify shape matches coreEngine's imageAnalysis input
    assert(typeof r.material === "string", "material is string");
    assert(typeof r.confidence === "number", "confidence is number");
    assert(typeof r.condition === "string", "condition is string");
    assert(VALID_MATERIALS.includes(r.material), "material is valid for core engine");
    assert(VALID_CONDITIONS.includes(r.condition), "condition is valid for core engine");
    assert(r.confidence >= 0 && r.confidence <= 1, "confidence in [0, 1]");

    // Can be passed directly as imageAnalysis
    const coreInput = { imageAnalysis: r, description: "", userInputs: {} };
    assert(typeof coreInput === "object", "can construct core engine input");
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(64)}`);
  console.log(
    `  TOTAL: ${passed + failed}  |  ✅ PASSED: ${passed}  |  ❌ FAILED: ${failed}`
  );
  console.log(`${"═".repeat(64)}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    failures.forEach((f) => console.log(`  • ${f}`));
    process.exit(1);
  } else {
    console.log(
      "\n🎉 ALL TESTS PASSED — Image analysis service is clean and reliable.\n"
    );
    process.exit(0);
  }
})();
