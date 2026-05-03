/**
 * ScrapIQ Pricing Engine — Test Suite
 * =====================================
 * Run: node services/pricingEngine.test.js
 *
 * Formula:
 *   effectiveRate = baseRate × subtypeFactor × cleanlinessFactor
 *   finalPrice = weight × effectiveRate × conditionFactor
 */

const {
  calculatePrice,
  validateInput,
  generateExplanation,
  MATERIAL_RATES,
  SUBTYPE_FACTORS,
  CLEANLINESS_FACTOR,
  CONDITION_FACTOR,
  VALID_CONDITIONS,
  MATERIAL_EXPLANATIONS,
  CONDITION_EXPLANATIONS,
  SUBTYPE_EXPLANATIONS,
  CLEANLINESS_EXPLANATIONS,
} = require("./pricingEngine");

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
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  assert(threw, testName);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(60 - title.length)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIRED TEST CASES — NEW FORMULA
// ═══════════════════════════════════════════════════════════════════════════════

section("REQUIRED: Copper Insulated Dirty → Lower Price");

// copper insulated dirty good:
//   effectiveRate = 600 × 0.7 × 0.75 = 315
//   finalPrice = 2 × 315 × 0.9 = 567
{
  const result = calculatePrice({
    data: { material: "copper", weight: 2, condition: "good" },
    categoryData: { subtype: "insulated", cleanliness: "dirty" },
  });
  assertEqual(result.breakdown.baseRate, 600, "copper insulated dirty: baseRate = 600");
  assertEqual(result.breakdown.subtypeFactor, 0.7, "copper insulated dirty: subtypeFactor = 0.7");
  assertEqual(result.breakdown.cleanlinessFactor, 0.75, "copper insulated dirty: cleanlinessFactor = 0.75");
  assertEqual(result.breakdown.conditionFactor, 0.9, "copper insulated dirty: conditionFactor = 0.9 (good)");
  assertEqual(result.effectiveRate, 315, "copper insulated dirty: effectiveRate = 315");
  assertEqual(result.finalPrice, 567, "copper insulated dirty: finalPrice = 2 × 315 × 0.9 = 567");
}

section("REQUIRED: Copper Bare Clean → Higher Price");

// copper bare clean excellent:
//   effectiveRate = 600 × 1.0 × 1.0 = 600
//   finalPrice = 2 × 600 × 1.0 = 1200
{
  const result = calculatePrice({
    data: { material: "copper", weight: 2, condition: "excellent" },
    categoryData: { subtype: "bare", cleanliness: "clean" },
  });
  assertEqual(result.breakdown.baseRate, 600, "copper bare clean: baseRate = 600");
  assertEqual(result.breakdown.subtypeFactor, 1.0, "copper bare clean: subtypeFactor = 1.0");
  assertEqual(result.breakdown.cleanlinessFactor, 1.0, "copper bare clean: cleanlinessFactor = 1.0");
  assertEqual(result.breakdown.conditionFactor, 1.0, "copper bare clean: conditionFactor = 1.0 (excellent)");
  assertEqual(result.effectiveRate, 600, "copper bare clean: effectiveRate = 600");
  assertEqual(result.finalPrice, 1200, "copper bare clean: finalPrice = 2 × 600 × 1.0 = 1200");
}

section("REQUIRED: Missing Subtype → Throws");

{
  assertThrows(
    () => calculatePrice({
      data: { material: "copper", weight: 2, condition: "good" },
      categoryData: { cleanliness: "clean" },
    }),
    "throws on missing subtype"
  );
}

section("REQUIRED: Missing Cleanliness → Throws");

{
  assertThrows(
    () => calculatePrice({
      data: { material: "copper", weight: 2, condition: "good" },
      categoryData: { subtype: "bare" },
    }),
    "throws on missing cleanliness"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Material Rate Tests
// ═══════════════════════════════════════════════════════════════════════════════

section("Material Rates");

{
  const r = calculatePrice({
    data: { material: "copper", weight: 1, condition: "excellent" },
    categoryData: { subtype: "bare", cleanliness: "clean" },
  });
  assertEqual(r.finalPrice, 600, "copper: 1kg × 600 × 1.0 × 1.0 × 1.0 = 600");
}
{
  const r = calculatePrice({
    data: { material: "iron", weight: 1, condition: "excellent" },
    categoryData: { subtype: "heavy", cleanliness: "clean" },
  });
  assertEqual(r.finalPrice, 30, "iron: 1kg × 30 × 1.0 × 1.0 × 1.0 = 30");
}
{
  const r = calculatePrice({
    data: { material: "aluminum", weight: 1, condition: "excellent" },
    categoryData: { subtype: "standard", cleanliness: "clean" },
  });
  assertEqual(r.finalPrice, 150, "aluminum: 1kg × 150 × 1.0 × 1.0 × 1.0 = 150");
}
{
  const r = calculatePrice({
    data: { material: "steel", weight: 1, condition: "excellent" },
    categoryData: { subtype: "standard", cleanliness: "clean" },
  });
  assertEqual(r.finalPrice, 40, "steel: 1kg × 40 × 1.0 × 1.0 × 1.0 = 40");
}
{
  const r = calculatePrice({
    data: { material: "plastic", weight: 1, condition: "excellent" },
    categoryData: { subtype: "hard", cleanliness: "clean" },
  });
  assertEqual(r.finalPrice, 20, "plastic: 1kg × 20 × 1.0 × 1.0 × 1.0 = 20");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Condition Factor Tests
// ═══════════════════════════════════════════════════════════════════════════════

section("Condition Factors");

{
  const base = { material: "copper", weight: 1 };
  const cd = { subtype: "bare", cleanliness: "clean" };

  const excellent = calculatePrice({ data: { ...base, condition: "excellent" }, categoryData: cd });
  assertEqual(excellent.breakdown.conditionFactor, 1.0, "excellent → 1.0");
  assertEqual(excellent.finalPrice, 600, "copper excellent: 600 × 1.0 = 600");

  const good = calculatePrice({ data: { ...base, condition: "good" }, categoryData: cd });
  assertEqual(good.breakdown.conditionFactor, 0.9, "good → 0.9");
  assertEqual(good.finalPrice, 540, "copper good: 600 × 0.9 = 540");

  const worn = calculatePrice({ data: { ...base, condition: "worn" }, categoryData: cd });
  assertEqual(worn.breakdown.conditionFactor, 0.75, "worn → 0.75");
  assertEqual(worn.finalPrice, 450, "copper worn: 600 × 0.75 = 450");

  const damaged = calculatePrice({ data: { ...base, condition: "damaged" }, categoryData: cd });
  assertEqual(damaged.breakdown.conditionFactor, 0.6, "damaged → 0.6");
  assertEqual(damaged.finalPrice, 360, "copper damaged: 600 × 0.6 = 360");

  const heavilyDamaged = calculatePrice({ data: { ...base, condition: "heavily_damaged" }, categoryData: cd });
  assertEqual(heavilyDamaged.breakdown.conditionFactor, 0.4, "heavily_damaged → 0.4");
  assertEqual(heavilyDamaged.finalPrice, 240, "copper heavily_damaged: 600 × 0.4 = 240");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subtype Factor Tests
// ═══════════════════════════════════════════════════════════════════════════════

section("Subtype Factors — Copper");

{
  const base = { data: { material: "copper", weight: 1, condition: "excellent" } };

  const bare = calculatePrice({ ...base, categoryData: { subtype: "bare", cleanliness: "clean" } });
  assertEqual(bare.breakdown.subtypeFactor, 1.0, "copper bare → 1.0");

  const insulated = calculatePrice({ ...base, categoryData: { subtype: "insulated", cleanliness: "clean" } });
  assertEqual(insulated.breakdown.subtypeFactor, 0.7, "copper insulated → 0.7");
  assertEqual(insulated.finalPrice, 420, "copper insulated: 600 × 0.7 = 420");

  const mixed = calculatePrice({ ...base, categoryData: { subtype: "mixed", cleanliness: "clean" } });
  assertEqual(mixed.breakdown.subtypeFactor, 0.8, "copper mixed → 0.8");
  assertEqual(mixed.finalPrice, 480, "copper mixed: 600 × 0.8 = 480");
}

section("Subtype Factors — Iron");

{
  const base = { data: { material: "iron", weight: 1, condition: "excellent" } };

  const heavy = calculatePrice({ ...base, categoryData: { subtype: "heavy", cleanliness: "clean" } });
  assertEqual(heavy.breakdown.subtypeFactor, 1.0, "iron heavy → 1.0");

  const light = calculatePrice({ ...base, categoryData: { subtype: "light", cleanliness: "clean" } });
  assertEqual(light.breakdown.subtypeFactor, 0.8, "iron light → 0.8");
  assertEqual(light.finalPrice, 24, "iron light: 30 × 0.8 = 24");
}

section("Subtype Factors — Plastic");

{
  const base = { data: { material: "plastic", weight: 1, condition: "excellent" } };

  const hard = calculatePrice({ ...base, categoryData: { subtype: "hard", cleanliness: "clean" } });
  assertEqual(hard.breakdown.subtypeFactor, 1.0, "plastic hard → 1.0");

  const soft = calculatePrice({ ...base, categoryData: { subtype: "soft", cleanliness: "clean" } });
  assertEqual(soft.breakdown.subtypeFactor, 0.7, "plastic soft → 0.7");
  assertEqual(soft.finalPrice, 14, "plastic soft: 20 × 0.7 = 14");
}

section("Subtype — No Subtypes Defined (aluminum, steel) → factor 1.0");

{
  const r = calculatePrice({
    data: { material: "aluminum", weight: 1, condition: "excellent" },
    categoryData: { subtype: "standard", cleanliness: "clean" },
  });
  assertEqual(r.breakdown.subtypeFactor, 1.0, "aluminum standard → 1.0 (no subtype table)");
  assertEqual(r.finalPrice, 150, "aluminum standard: 150");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cleanliness Factor Tests
// ═══════════════════════════════════════════════════════════════════════════════

section("Cleanliness Factors");

{
  const base = { data: { material: "copper", weight: 1, condition: "excellent" } };

  const clean = calculatePrice({ ...base, categoryData: { subtype: "bare", cleanliness: "clean" } });
  assertEqual(clean.breakdown.cleanlinessFactor, 1.0, "clean → 1.0");

  const dirty = calculatePrice({ ...base, categoryData: { subtype: "bare", cleanliness: "dirty" } });
  assertEqual(dirty.breakdown.cleanlinessFactor, 0.75, "dirty → 0.75");
  assertEqual(dirty.finalPrice, 450, "copper bare dirty: 600 × 1.0 × 0.75 = 450");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Combined Factor Tests
// ═══════════════════════════════════════════════════════════════════════════════

section("Combined Factors — All Stacked");

// copper insulated dirty damaged:
//   effectiveRate = 600 × 0.7 × 0.75 = 315
//   finalPrice = 2 × 315 × 0.6 = 378
{
  const r = calculatePrice({
    data: { material: "copper", weight: 2, condition: "damaged" },
    categoryData: { subtype: "insulated", cleanliness: "dirty" },
  });
  assertEqual(r.effectiveRate, 315, "stacked: effectiveRate = 315");
  assertEqual(r.finalPrice, 378, "stacked: 2 × 315 × 0.6 = 378");
}

// iron light dirty worn:
//   effectiveRate = 30 × 0.8 × 0.75 = 18
//   finalPrice = 5 × 18 × 0.75 = 67.5
{
  const r = calculatePrice({
    data: { material: "iron", weight: 5, condition: "worn" },
    categoryData: { subtype: "light", cleanliness: "dirty" },
  });
  assertEqual(r.effectiveRate, 18, "iron stacked: effectiveRate = 18");
  assertEqual(r.finalPrice, 67.5, "iron stacked: 5 × 18 × 0.75 = 67.5");
}

// plastic soft dirty heavily_damaged:
//   effectiveRate = 20 × 0.7 × 0.75 = 10.5
//   finalPrice = 3 × 10.5 × 0.4 = 12.6
{
  const r = calculatePrice({
    data: { material: "plastic", weight: 3, condition: "heavily_damaged" },
    categoryData: { subtype: "soft", cleanliness: "dirty" },
  });
  assertEqual(r.effectiveRate, 10.5, "plastic stacked: effectiveRate = 10.5");
  assertEqual(r.finalPrice, 12.6, "plastic stacked: 3 × 10.5 × 0.4 = 12.6");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Breakdown Structure
// ═══════════════════════════════════════════════════════════════════════════════

section("Breakdown Structure");

{
  const r = calculatePrice({
    data: { material: "copper", weight: 2, condition: "damaged" },
    categoryData: { subtype: "insulated", cleanliness: "dirty" },
  });

  assertEqual(r.breakdown.baseRate, 600, "breakdown has baseRate");
  assertEqual(r.breakdown.weight, 2, "breakdown has weight");
  assertEqual(r.breakdown.subtypeFactor, 0.7, "breakdown has subtypeFactor");
  assertEqual(r.breakdown.cleanlinessFactor, 0.75, "breakdown has cleanlinessFactor");
  assertEqual(r.breakdown.effectiveRate, 315, "breakdown has effectiveRate");
  assertEqual(r.breakdown.conditionFactor, 0.6, "breakdown has conditionFactor");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation — MUST THROW on missing data
// ═══════════════════════════════════════════════════════════════════════════════

section("Validation — Throws on Missing Data");

assertThrows(() => calculatePrice(null), "throws on null input");
assertThrows(() => calculatePrice({}), "throws on missing data");
assertThrows(
  () => calculatePrice({ data: { weight: 1, condition: "good" }, categoryData: { subtype: "bare", cleanliness: "clean" } }),
  "throws on missing material"
);
assertThrows(
  () => calculatePrice({ data: { material: "copper", condition: "good" }, categoryData: { subtype: "bare", cleanliness: "clean" } }),
  "throws on missing weight"
);
assertThrows(
  () => calculatePrice({ data: { material: "copper", weight: 2 }, categoryData: { subtype: "bare", cleanliness: "clean" } }),
  "throws on missing condition"
);
assertThrows(
  () => calculatePrice({ data: { material: "gold", weight: 1, condition: "good" }, categoryData: { subtype: "bare", cleanliness: "clean" } }),
  "throws on unknown material"
);
assertThrows(
  () => calculatePrice({ data: { material: "copper", weight: 1, condition: "mint" }, categoryData: { subtype: "bare", cleanliness: "clean" } }),
  "throws on unknown condition"
);
assertThrows(
  () => calculatePrice({ data: { material: "copper", weight: -1, condition: "good" }, categoryData: { subtype: "bare", cleanliness: "clean" } }),
  "throws on negative weight"
);
assertThrows(
  () => calculatePrice({ data: { material: "copper", weight: 0, condition: "good" }, categoryData: { subtype: "bare", cleanliness: "clean" } }),
  "throws on zero weight"
);
assertThrows(
  () => calculatePrice({
    data: { material: "copper", weight: 1, condition: "good" },
    categoryData: {},
  }),
  "throws on empty categoryData"
);
assertThrows(
  () => calculatePrice({
    data: { material: "copper", weight: 1, condition: "good" },
  }),
  "throws on missing categoryData entirely"
);
assertThrows(
  () => calculatePrice({
    data: { material: "copper", weight: 1, condition: "good" },
    categoryData: { subtype: "bare" },
  }),
  "throws on missing cleanliness in categoryData"
);
assertThrows(
  () => calculatePrice({
    data: { material: "copper", weight: 1, condition: "good" },
    categoryData: { cleanliness: "clean" },
  }),
  "throws on missing subtype in categoryData"
);
assertThrows(
  () => calculatePrice({
    data: { material: "copper", weight: 1, condition: "good" },
    categoryData: { subtype: "invalid_type", cleanliness: "clean" },
  }),
  "throws on invalid subtype for copper"
);
assertThrows(
  () => calculatePrice({
    data: { material: "copper", weight: 1, condition: "good" },
    categoryData: { subtype: "bare", cleanliness: "sparkly" },
  }),
  "throws on invalid cleanliness"
);

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

section("Edge Cases");

// Decimal weight
{
  const r = calculatePrice({
    data: { material: "copper", weight: 0.5, condition: "excellent" },
    categoryData: { subtype: "bare", cleanliness: "clean" },
  });
  assertEqual(r.finalPrice, 300, "0.5kg copper bare clean excellent = 300");
}

// Large weight
{
  const r = calculatePrice({
    data: { material: "iron", weight: 100, condition: "good" },
    categoryData: { subtype: "heavy", cleanliness: "dirty" },
  });
  // effectiveRate = 30 × 1.0 × 0.75 = 22.5
  // finalPrice = 100 × 22.5 × 0.9 = 2025
  assertEqual(r.finalPrice, 2025, "100kg iron heavy dirty good = 2025");
}

// Currency field present
{
  const r = calculatePrice({
    data: { material: "copper", weight: 1, condition: "excellent" },
    categoryData: { subtype: "bare", cleanliness: "clean" },
  });
  assertEqual(r.currency, "INR", "currency = INR");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Price Range
// ═══════════════════════════════════════════════════════════════════════════════

section("Price Range (±10%)");

// copper bare clean excellent → finalPrice = 600
{
  const r = calculatePrice({
    data: { material: "copper", weight: 1, condition: "excellent" },
    categoryData: { subtype: "bare", cleanliness: "clean" },
  });
  assertEqual(r.priceRange.min, 540, "range min = 600 × 0.9 = 540");
  assertEqual(r.priceRange.max, 660, "range max = 600 × 1.1 = 660");
}

// copper insulated dirty good → finalPrice = 567
// 567 × 0.9 = 510.3, 567 × 1.1 = 623.7
{
  const r = calculatePrice({
    data: { material: "copper", weight: 2, condition: "good" },
    categoryData: { subtype: "insulated", cleanliness: "dirty" },
  });
  assertEqual(r.priceRange.min, 510.3, "range min = 567 × 0.9 = 510.3");
  assertEqual(r.priceRange.max, 623.7, "range max = 567 × 1.1 = 623.7");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Negotiation Insights
// ═══════════════════════════════════════════════════════════════════════════════

section("Negotiation Insights");

// finalPrice = 600
{
  const r = calculatePrice({
    data: { material: "copper", weight: 1, condition: "excellent" },
    categoryData: { subtype: "bare", cleanliness: "clean" },
  });
  assertEqual(r.negotiation.dealerOffer, 510, "dealerOffer = 600 × 0.85 = 510");
  assertEqual(r.negotiation.targetPrice, 600, "targetPrice = finalPrice = 600");
  assertEqual(r.negotiation.minAcceptable, 480, "minAcceptable = 600 × 0.8 = 480");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Explanation
// ═══════════════════════════════════════════════════════════════════════════════

section("Explanation");

// Every material has an explanation
{
  for (const mat of ["copper", "iron", "aluminum", "steel", "plastic"]) {
    const subtypeMap = {
      copper: "bare", iron: "heavy", aluminum: "standard", steel: "standard", plastic: "hard",
    };
    const r = calculatePrice({
      data: { material: mat, weight: 1, condition: "excellent" },
      categoryData: { subtype: subtypeMap[mat], cleanliness: "clean" },
    });
    assert(
      typeof r.explanation.material === "string" && r.explanation.material.length > 0,
      `explanation.material present for ${mat}`
    );
  }
}

// Explanation includes condition, subtype, and cleanliness
{
  const r = calculatePrice({
    data: { material: "copper", weight: 1, condition: "damaged" },
    categoryData: { subtype: "insulated", cleanliness: "dirty" },
  });
  assert(typeof r.explanation.material === "string", "explanation has material");
  assert(typeof r.explanation.condition === "string", "explanation has condition");
  assert(typeof r.explanation.cleanliness === "string", "explanation has cleanliness");
  assert(typeof r.explanation.subtype === "string", "explanation has subtype");
  assert(r.explanation.condition.includes("40%"), "damaged explanation mentions 40%");
  assert(r.explanation.subtype.includes("30%"), "insulated explanation mentions 30%");
  assert(r.explanation.cleanliness.includes("25%"), "dirty explanation mentions 25%");
}

// ─── VALID_CONDITIONS export and condition guard (Task 4) ────────────────────

section("VALID_CONDITIONS — explicit enum guard");

// Confirm VALID_CONDITIONS is exported and matches CONDITION_FACTOR keys
{
  const { VALID_CONDITIONS } = require("./pricingEngine");
  assertEqual(
    [...VALID_CONDITIONS].sort(),
    ["damaged", "excellent", "good", "heavily_damaged", "worn"],
    "VALID_CONDITIONS exports exactly five canonical enums"
  );
  // Must be derived from CONDITION_FACTOR — no drift possible
  for (const v of VALID_CONDITIONS) {
    assert(v in CONDITION_FACTOR, `VALID_CONDITIONS["${v}"] exists in CONDITION_FACTOR`);
  }
}

// REQUIRED CASE 3: unnormalised alias "used" must throw at pricingEngine boundary
{
  let threw = false;
  let msg = "";
  try {
    calculatePrice({
      data: { material: "copper", weight: 2, condition: "used" },
      categoryData: { subtype: "bare", cleanliness: "clean" },
    });
  } catch (e) {
    threw = true;
    msg = e.message;
  }
  assert(threw, "CASE 3: unnormalised 'used' → pricingEngine throws");
  assert(msg.includes("invalid condition"), "CASE 3: error mentions 'invalid condition'");
}

// "working" also throws
{
  let threw = false;
  try {
    calculatePrice({
      data: { material: "iron", weight: 5, condition: "working" },
      categoryData: { subtype: "heavy", cleanliness: "clean" },
    });
  } catch (e) {
    threw = true;
  }
  assert(threw, "unnormalised 'working' → pricingEngine throws");
}

// After normalisation, valid values succeed
{
  const r = calculatePrice({
    data: { material: "copper", weight: 2, condition: "worn" },
    categoryData: { subtype: "bare", cleanliness: "clean" },
  });
  assert(r.finalPrice > 0, "normalised 'worn' → calculatePrice succeeds");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

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
  console.log("\n🎉 ALL TESTS PASSED — Pricing engine is accurate and deterministic.\n");
  process.exit(0);
}