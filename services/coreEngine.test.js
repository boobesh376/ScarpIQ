/**
 * ScrapIQ Core Engine — Test Suite
 * =================================
 * Run: node services/coreEngine.test.js
 *
 * No external dependencies required.
 */

const {
  parseWeight,
  parseMaterial,
  parseCondition,
  normalizeCondition,
  resolveField,
  processInput,
  VALID_CONDITIONS,
  CONDITION_NORMALIZATION_MAP,
} = require("./coreEngine");

// ─── Minimal test runner ─────────────────────────────────────────────────────

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

// ─── parseWeight tests ───────────────────────────────────────────────────────

section("parseWeight");

assertEqual(parseWeight("2kg copper wire"), 2, "parses '2kg'");
assertEqual(parseWeight("2 kg copper wire"), 2, "parses '2 kg'");
assertEqual(parseWeight("2.5kg item"), 2.5, "parses '2.5kg'");
assertEqual(parseWeight("2 kilograms of scrap"), 2, "parses '2 kilograms'");
assertEqual(parseWeight("0.75 kg of copper"), 0.75, "parses '0.75 kg'");
assertEqual(parseWeight(".5kg"), 0.5, "parses '.5kg'");
assertEqual(parseWeight("no weight here"), null, "returns null when no weight");
assertEqual(parseWeight(""), null, "returns null for empty string");
assertEqual(parseWeight(null), null, "returns null for null input");
assertEqual(parseWeight(undefined), null, "returns null for undefined input");
assertEqual(parseWeight(123), null, "returns null for non-string input");
assertEqual(parseWeight("weighs about 10kgs"), 10, "parses '10kgs'");
assertEqual(parseWeight("heavy 15 kilogram piece"), 15, "parses '15 kilogram'");

// ─── parseMaterial tests ─────────────────────────────────────────────────────

section("parseMaterial");

assertEqual(parseMaterial("2kg copper wire"), "copper", "detects copper");
assertEqual(parseMaterial("old iron pipe"), "iron", "detects iron");
assertEqual(parseMaterial("aluminum can"), "aluminum", "detects aluminum");
assertEqual(parseMaterial("aluminium sheet"), "aluminum", "normalizes aluminium → aluminum");
assertEqual(parseMaterial("plastic bottle"), "plastic", "detects plastic");
assertEqual(parseMaterial("steel beam"), "steel", "detects steel");
assertEqual(parseMaterial("some random item"), null, "returns null for unknown material");
assertEqual(parseMaterial(""), null, "returns null for empty string");
assertEqual(parseMaterial(null), null, "returns null for null");
assertEqual(parseMaterial("ironing board"), null, "does not match 'iron' in 'ironing'");

// ─── parseCondition tests ────────────────────────────────────────────────────

section("parseCondition");

assertEqual(parseCondition("slightly rusted item"), "damaged", "rusted → damaged");
assertEqual(parseCondition("broken motor"), "damaged", "broken → damaged");
assertEqual(parseCondition("working machine"), "good", "working → good");
assertEqual(parseCondition("clean copper pipe"), "good", "clean → good");
assertEqual(parseCondition("cracked casing"), "damaged", "cracked → damaged");
assertEqual(parseCondition("some item"), null, "returns null for unknown condition");
assertEqual(parseCondition(""), null, "returns null for empty string");
assertEqual(parseCondition(null), null, "returns null for null");

// ─── resolveField tests ─────────────────────────────────────────────────────

section("resolveField");

assertEqual(
  resolveField([
    { value: 3, source: "userInputs" },
    { value: 2, source: "description" },
  ]),
  { value: 3, source: "userInputs" },
  "picks first valid value"
);

assertEqual(
  resolveField([
    { value: null, source: "userInputs" },
    { value: 2, source: "description" },
  ]),
  { value: 2, source: "description" },
  "skips null, picks next"
);

assertEqual(
  resolveField([
    { value: null, source: "a" },
    { value: null, source: "b" },
  ]),
  null,
  "returns null when all are null"
);

assertEqual(
  resolveField([
    { value: "", source: "a" },
    { value: "copper", source: "b" },
  ]),
  { value: "copper", source: "b" },
  "skips empty string"
);

assertEqual(resolveField([]), null, "returns null for empty list");
assertEqual(resolveField(null), null, "returns null for null input");

// ─── processInput — REQUIRED TEST CASES ─────────────────────────────────────

section("processInput — REQUIRED TEST CASES");

// CASE 1: description = "2kg copper wire" → weight = 2, material = copper
{
  const result = processInput({
    imageAnalysis: null,
    description: "2kg copper wire",
    userInputs: {},
  });
  assertEqual(result.data.weight, 2, "CASE 1: weight = 2 (NOT 5)");
  assertEqual(result.data.material, "copper", "CASE 1: material = copper");
  assertEqual(result.source.weight, "description", "CASE 1: weight source = description");
  assertEqual(result.source.material, "description", "CASE 1: material source = description");
}

// CASE 2: no weight anywhere → NEEDS_INPUT, missingFields includes "weight"
{
  const result = processInput({
    imageAnalysis: { material: "copper", confidence: 0.9 },
    description: "copper wire",
    userInputs: {},
  });
  assertEqual(result.status, "NEEDS_INPUT", "CASE 2: status = NEEDS_INPUT");
  assert(result.missingFields.includes("weight"), "CASE 2: missingFields includes 'weight'");
}

// CASE 3: userInputs.weight = 3, description = "2kg copper" → weight = 3 (user wins)
{
  const result = processInput({
    imageAnalysis: null,
    description: "2kg copper",
    userInputs: { weight: 3 },
  });
  assertEqual(result.data.weight, 3, "CASE 3: weight = 3 (user wins over description)");
  assertEqual(result.source.weight, "userInputs", "CASE 3: weight source = userInputs");
}

// CASE 4: AI says material but confidence = 0.6 → IGNORE AI → material missing
{
  const result = processInput({
    imageAnalysis: { material: "copper", confidence: 0.6 },
    description: "some item, 1kg",
    userInputs: {},
  });
  assert(
    result.missingFields.includes("material"),
    "CASE 4: AI confidence 0.6 → material is MISSING"
  );
  assertEqual(result.data.material, undefined, "CASE 4: material is NOT set");
}

// ─── processInput — Additional edge cases ────────────────────────────────────

section("processInput — Edge Cases");

// Fully populated → READY
{
  const result = processInput({
    imageAnalysis: { material: "iron", confidence: 0.95, condition: "rusted" },
    description: "2kg copper item slightly rusted",
    userInputs: { weight: null },
  });
  assertEqual(result.status, "READY", "fully populated → READY");
  assertEqual(result.data.weight, 2, "weight from description");
  assertEqual(result.data.material, "copper", "material from description (over AI)");
  assertEqual(result.data.condition, "damaged", "condition from description");
  assertEqual(result.source.material, "description", "material source = description");
}

// Completely empty input → all missing
{
  const result = processInput({});
  assertEqual(result.status, "NEEDS_INPUT", "empty input → NEEDS_INPUT");
  assertEqual(result.missingFields.length, 3, "all 3 fields missing");
}

// null input → all missing
{
  const result = processInput(null);
  assertEqual(result.status, "NEEDS_INPUT", "null input → NEEDS_INPUT");
  assertEqual(result.missingFields.length, 3, "all 3 fields missing");
}

// AI high confidence fills material when description has none
{
  const result = processInput({
    imageAnalysis: { material: "steel", confidence: 0.95 },
    description: "5kg item",
    userInputs: {},
  });
  assertEqual(result.data.material, "steel", "AI fills material at high confidence");
  assertEqual(result.source.material, "imageAnalysis", "material source = imageAnalysis");
}

// AI at exactly threshold (0.8) should NOT be used (must be > 0.8)
{
  const result = processInput({
    imageAnalysis: { material: "steel", confidence: 0.8 },
    description: "5kg item",
    userInputs: {},
  });
  assert(
    result.missingFields.includes("material"),
    "AI at exactly 0.8 → material MISSING (threshold is >0.8, not >=)"
  );
}

// User inputs override everything
{
  const result = processInput({
    imageAnalysis: { material: "iron", confidence: 0.99, condition: "working" },
    description: "2kg copper broken thing",
    userInputs: { weight: 10, material: "plastic", condition: "good" },
  });
  assertEqual(result.data.weight, 10, "user weight wins");
  assertEqual(result.data.material, "plastic", "user material wins");
  assertEqual(result.data.condition, "good", "user condition wins");
  assertEqual(result.source.weight, "userInputs", "weight source = userInputs");
  assertEqual(result.source.material, "userInputs", "material source = userInputs");
  assertEqual(result.source.condition, "userInputs", "condition source = userInputs");
}

// ─── normalizeCondition — Data Contract Fix ──────────────────────────────────

section("normalizeCondition — UI/AI alias → pricing enum");

// ── Identity: valid enums pass through unchanged
assertEqual(normalizeCondition("excellent"),       "excellent",       "identity: excellent → excellent");
assertEqual(normalizeCondition("good"),            "good",            "identity: good → good");
assertEqual(normalizeCondition("worn"),            "worn",            "identity: worn → worn");
assertEqual(normalizeCondition("damaged"),         "damaged",         "identity: damaged → damaged");
assertEqual(normalizeCondition("heavily_damaged"), "heavily_damaged", "identity: heavily_damaged → heavily_damaged");

// ── REQUIRED CASE 1: "used" → "worn"
assertEqual(normalizeCondition("used"), "worn", "REQUIRED CASE 1: 'used' → 'worn'");

// ── REQUIRED CASE 2: "working" → "good"
assertEqual(normalizeCondition("working"), "good", "REQUIRED CASE 2: 'working' → 'good'");

// ── Other aliases in the normalization map
assertEqual(normalizeCondition("old"),    "worn",    "alias: 'old' → 'worn'");
assertEqual(normalizeCondition("broken"), "damaged", "alias: 'broken' → 'damaged'");
assertEqual(normalizeCondition("rusted"), "damaged", "alias: 'rusted' → 'damaged'");
assertEqual(normalizeCondition("bad"),    "damaged", "alias: 'bad' → 'damaged'");

// ── Case-insensitive
assertEqual(normalizeCondition("USED"),    "worn",    "case-insensitive: 'USED' → 'worn'");
assertEqual(normalizeCondition("Working"), "good",    "case-insensitive: 'Working' → 'good'");
assertEqual(normalizeCondition("WORN"),    "worn",    "case-insensitive: 'WORN' → 'worn'");

// ── Whitespace trimming
assertEqual(normalizeCondition("  used  "), "worn", "trims whitespace: '  used  ' → 'worn'");

// ── REQUIRED CASE 3: unrecognised value → null (must trigger MISSING, not crash)
assertEqual(normalizeCondition("perfect"),   null, "REQUIRED CASE 3: unknown 'perfect' → null");
assertEqual(normalizeCondition("mint"),      null, "unknown 'mint' → null");
assertEqual(normalizeCondition("brand new"), null, "unknown 'brand new' → null");
assertEqual(normalizeCondition(""),          null, "empty string → null");
assertEqual(normalizeCondition(null),        null, "null input → null");
assertEqual(normalizeCondition(undefined),   null, "undefined input → null");
assertEqual(normalizeCondition(42),          null, "non-string input → null");

// ── VALID_CONDITIONS matches exactly the five enums
assertEqual(
  [...VALID_CONDITIONS].sort(),
  ["damaged", "excellent", "good", "heavily_damaged", "worn"],
  "VALID_CONDITIONS contains exactly the five canonical enums"
);

// ── Every identity entry in the normalization map IS a valid condition
{
  const identityKeys = VALID_CONDITIONS; // these should all map to themselves
  for (const key of identityKeys) {
    assert(
      normalizeCondition(key) === key,
      `normalization map: "${key}" is its own identity`
    );
  }
}

section("processInput — condition normalisation end-to-end");

// userInputs sends "used" → processInput must store "worn"
{
  const result = processInput({
    imageAnalysis: null,
    description: "3kg iron pipe",
    userInputs: { condition: "used" },
  });
  assertEqual(result.data.condition,   "worn",       "userInputs 'used' → normalised to 'worn'");
  assertEqual(result.source.condition, "userInputs", "source remains userInputs");
}

// userInputs sends "working" → processInput must store "good"
{
  const result = processInput({
    imageAnalysis: null,
    description: "5kg copper",
    userInputs: { condition: "working" },
  });
  assertEqual(result.data.condition,   "good",       "userInputs 'working' → normalised to 'good'");
  assertEqual(result.source.condition, "userInputs", "source remains userInputs");
}

// userInputs sends a completely unknown value → condition must be MISSING, not passed through
{
  const result = processInput({
    imageAnalysis: null,
    description: "2kg steel",
    userInputs: { condition: "mint" },
  });
  assertEqual(result.data.condition, undefined, "unknown condition 'mint' → NOT set in data");
  assert(
    result.missingFields.includes("condition"),
    "unknown condition 'mint' → appears in missingFields"
  );
}

// AI sends "used" (informal) → normalised before use
{
  const result = processInput({
    imageAnalysis: { material: "iron", condition: "used", confidence: 0.9, source: "real" },
    description: "4kg item",
    userInputs: {},
  });
  assertEqual(result.data.condition,   "worn",          "AI 'used' → normalised to 'worn'");
  assertEqual(result.source.condition, "imageAnalysis", "source = imageAnalysis");
}

// AI sends a value not in map → falls through to description
{
  const result = processInput({
    imageAnalysis: { material: "copper", condition: "perfect", confidence: 0.95, source: "real" },
    description: "3kg rusted copper pipe",
    userInputs: {},
  });
  // "perfect" normalises to null, description "rusted" → "damaged"
  assertEqual(result.data.condition,   "damaged",     "AI 'perfect' → null → falls through to description 'rusted' → 'damaged'");
  assertEqual(result.source.condition, "description", "source = description (AI value discarded)");
}

// Description keywords still work end-to-end through the normalizer
{
  const result = processInput({
    imageAnalysis: null,
    description: "slightly rusted iron bar 2kg",
    userInputs: {},
  });
  assertEqual(result.data.condition,   "damaged",     "description 'rusted' → parseCondition → normalizeCondition → 'damaged'");
  assertEqual(result.source.condition, "description", "source = description");
}

// Valid enum from userInputs passes through unchanged
{
  const result = processInput({
    imageAnalysis: null,
    description: "5kg copper wire",
    userInputs: { condition: "heavily_damaged" },
  });
  assertEqual(result.data.condition,   "heavily_damaged", "valid enum 'heavily_damaged' passes through unchanged");
  assertEqual(result.source.condition, "userInputs",      "source = userInputs");
}

// ─── TRUST BOUNDARY — Required cases (MOCK + confidence gate) ───────────────
//
// These tests enforce the three AI-trust rules:
//   RULE A: source === "mock"  → never use imageAnalysis
//   RULE B: confidence < 0.8   → never use imageAnalysis
//   RULE C: priority order stays userInputs → description → AI → MISSING

section("Trust Boundary — RULE A: MOCK source is always ignored");

// CASE 1 — MOCK_IMAGE=true, no description → material must be MISSING
// Expected: asks "What material is this?" (not copper subtype questions)
{
  const result = processInput({
    imageAnalysis: { material: "copper", confidence: 0.9, source: "mock" },
    description: "",
    userInputs: {},
  });
  assert(
    result.missingFields.includes("material"),
    "CASE 1 [mock+no-desc]: mock source → material is MISSING"
  );
  assertEqual(result.data.material, undefined, "CASE 1 [mock+no-desc]: material not set in data");
  assertEqual(result.status, "NEEDS_INPUT",   "CASE 1 [mock+no-desc]: status = NEEDS_INPUT");
}

// CASE 1b — MOCK with high confidence still discarded even for condition
{
  const result = processInput({
    imageAnalysis: { material: "copper", condition: "good", confidence: 0.99, source: "mock" },
    description: "5kg item",
    userInputs: {},
  });
  assert(
    result.missingFields.includes("material"),
    "CASE 1b [mock+desc-no-material]: mock source → material MISSING despite high confidence"
  );
  // condition from mock must also be discarded
  assert(
    result.missingFields.includes("condition"),
    "CASE 1b [mock+desc-no-material]: mock source → condition also MISSING"
  );
}

// CASE 2 — description: "plastic chair" → resolves to plastic without AI
{
  const result = processInput({
    imageAnalysis: { material: "copper", confidence: 0.9, source: "mock" },
    description: "plastic chair",
    userInputs: {},
  });
  assertEqual(result.data.material, "plastic",      "CASE 2 [plastic-desc]: material = plastic (from description)");
  assertEqual(result.source.material, "description", "CASE 2 [plastic-desc]: source = description, NOT imageAnalysis");
  assert(!result.missingFields.includes("material"), "CASE 2 [plastic-desc]: material is NOT missing");
}

section("Trust Boundary — RULE B: Confidence gate (< 0.8 → ignore)");

// CASE 3 — Real AI, confidence ≥ 0.85 → AI material IS used
{
  const result = processInput({
    imageAnalysis: { material: "steel", confidence: 0.85, source: "real" },
    description: "5kg item",
    userInputs: {},
  });
  assertEqual(result.data.material, "steel",           "CASE 3 [real-AI-0.85]: material = steel from AI");
  assertEqual(result.source.material, "imageAnalysis", "CASE 3 [real-AI-0.85]: source = imageAnalysis");
  assert(!result.missingFields.includes("material"),   "CASE 3 [real-AI-0.85]: material is NOT missing");
}

// CASE 3b — Real AI without explicit source field, high confidence → still used
{
  const result = processInput({
    imageAnalysis: { material: "aluminum", confidence: 0.9 },
    description: "5kg item",
    userInputs: {},
  });
  assertEqual(result.data.material, "aluminum",        "CASE 3b [real-AI-no-source]: material = aluminum");
  assertEqual(result.source.material, "imageAnalysis", "CASE 3b [real-AI-no-source]: source = imageAnalysis");
}

// CASE 4 — Low confidence (0.6) → ignore AI → material MISSING
{
  const result = processInput({
    imageAnalysis: { material: "copper", confidence: 0.6 },
    description: "some item, 1kg",
    userInputs: {},
  });
  assert(
    result.missingFields.includes("material"),
    "CASE 4 [low-confidence-0.6]: confidence 0.6 → material MISSING"
  );
  assertEqual(result.data.material, undefined, "CASE 4 [low-confidence-0.6]: material not set");
}

// CASE 4b — Mock + low confidence (double reason to ignore) → still MISSING
{
  const result = processInput({
    imageAnalysis: { material: "iron", confidence: 0.5, source: "mock" },
    description: "3kg thing",
    userInputs: {},
  });
  assert(
    result.missingFields.includes("material"),
    "CASE 4b [mock+low-confidence]: both rules fire → material MISSING"
  );
}

section("Trust Boundary — RULE C: Priority order is always enforced");

// userInputs overrides even real high-confidence AI
{
  const result = processInput({
    imageAnalysis: { material: "iron", confidence: 0.99, source: "real" },
    description: "copper pipe",
    userInputs: { material: "aluminum" },
  });
  assertEqual(result.data.material,   "aluminum",    "RULE C: userInputs wins over real AI");
  assertEqual(result.source.material, "userInputs",  "RULE C: source = userInputs");
}

// description overrides real high-confidence AI
{
  const result = processInput({
    imageAnalysis: { material: "iron", confidence: 0.99, source: "real" },
    description: "5kg plastic chair",
    userInputs: {},
  });
  assertEqual(result.data.material,   "plastic",     "RULE C: description wins over real AI");
  assertEqual(result.source.material, "description", "RULE C: source = description");
}

// No default material ever — system must not invent copper or any fallback
{
  const result = processInput({
    imageAnalysis: null,
    description: "",
    userInputs: {},
  });
  assertEqual(result.data.material, undefined, "NO DEFAULT: material is never invented");
  assert(
    result.missingFields.includes("material"),
    "NO DEFAULT: material is in missingFields, not silently filled"
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(64)}`);
console.log(`  TOTAL: ${passed + failed}  |  ✅ PASSED: ${passed}  |  ❌ FAILED: ${failed}`);
console.log(`${"═".repeat(64)}`);

if (failed > 0) {
  console.log("\nFailed tests:");
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
} else {
  console.log("\n🎉 ALL TESTS PASSED — Engine is deterministic and strict.\n");
  process.exit(0);
}