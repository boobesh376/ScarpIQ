/**
 * ScrapIQ Orchestrator — Test Suite
 * ===================================
 * Run: node services/orchestrator.test.js
 */

const { runFullAnalysis } = require("./orchestrator");

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

async function assertThrowsAsync(fn, testName) {
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = true;
  }
  assert(threw, testName);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(60 - title.length)}`);
}

function mockProvider(answers) {
  return (q) => {
    const v = answers[q.type];
    if (v === undefined) throw new Error(`Unexpected question: ${q.type}`);
    return v;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════

(async () => {

  // ─────────────────────────────────────────────────────────────────────────
  // CASE 1: Full input → no core questions → category questions → pricing
  // ─────────────────────────────────────────────────────────────────────────

  section("CASE 1 — Full Input → Direct to Pricing");

  {
    const input = {
      description: "2kg copper wire rusted",
      imageAnalysis: null,
      userInputs: {},
    };

    // Core fields all resolved from description (weight=2, material=copper, condition=damaged)
    // Category = metal → needs purity
    const provider = mockProvider({ purity: "pure" });

    const result = await runFullAnalysis(input, provider);

    assertEqual(result.data.weight, 2, "CASE 1: weight = 2");
    assertEqual(result.data.material, "copper", "CASE 1: material = copper");
    assertEqual(result.data.condition, "damaged", "CASE 1: condition = damaged");
    assertEqual(result.category, "metal", "CASE 1: category = metal");
    assertEqual(result.categoryData.purity, "pure", "CASE 1: purity = pure");

    // Pricing: 2 × 600 × 0.6 × 1.0 = 720
    assertEqual(result.pricing.finalPrice, 720, "CASE 1: finalPrice = 720");
    assertEqual(result.pricing.basePrice, 1200, "CASE 1: basePrice = 1200");
    assertEqual(result.pricing.breakdown.materialRate, 600, "CASE 1: materialRate = 600");
    assertEqual(result.pricing.breakdown.conditionFactor, 0.6, "CASE 1: conditionFactor = 0.6");

    assert(result.questionsAsked.length >= 0, "CASE 1: questionsAsked is present");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASE 2: Missing weight → asks → completes → pricing
  // ─────────────────────────────────────────────────────────────────────────

  section("CASE 2 — Missing Weight → Question → Pricing");

  {
    const input = {
      description: "copper wire rusted",
      imageAnalysis: null,
      userInputs: {},
    };

    // Missing: weight. Category=metal → also needs purity. Condition from description.
    const asked = [];
    const provider = (q) => {
      asked.push(q.type);
      return { weight: 3, purity: "mixed" }[q.type];
    };

    const result = await runFullAnalysis(input, provider);

    assertEqual(result.data.weight, 3, "CASE 2: weight = 3 (from answer)");
    assertEqual(result.data.material, "copper", "CASE 2: material = copper");
    assertEqual(result.data.condition, "damaged", "CASE 2: condition = damaged");
    assert(asked.includes("weight"), "CASE 2: asked weight");

    // Pricing: 3 × 600 × 0.6 × 0.8 = 864
    assertEqual(result.pricing.finalPrice, 864, "CASE 2: finalPrice = 3 × 600 × 0.6 × 0.8 = 864");
    assert(result.questionsAsked.length >= 1, "CASE 2: at least 1 question asked");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASE 3: Missing weight + material → multiple questions → pricing
  // ─────────────────────────────────────────────────────────────────────────

  section("CASE 3 — Multiple Missing → Loop → Pricing");

  {
    const input = {
      description: "old broken item",
      imageAnalysis: null,
      userInputs: {},
    };

    const asked = [];
    const provider = (q) => {
      asked.push(q.type);
      return { weight: 5, material: "iron", condition: "damaged", purity: "pure" }[q.type];
    };

    const result = await runFullAnalysis(input, provider);

    assertEqual(result.data.weight, 5, "CASE 3: weight = 5");
    assertEqual(result.data.material, "iron", "CASE 3: material = iron");
    assert(asked.includes("weight"), "CASE 3: asked weight");
    assert(asked.includes("material"), "CASE 3: asked material");

    // weight asked first (priority)
    const weightIdx = asked.indexOf("weight");
    const materialIdx = asked.indexOf("material");
    assert(weightIdx < materialIdx, "CASE 3: weight asked before material (priority)");

    // Pricing: 5 × 30 × 0.6 × 1.0 = 90
    assertEqual(result.pricing.finalPrice, 90, "CASE 3: finalPrice = 5 × 30 × 0.6 × 1.0 = 90");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASE 4: Final output structure is complete
  // ─────────────────────────────────────────────────────────────────────────

  section("CASE 4 — Final Output Structure");

  {
    const input = {
      description: "3kg plastic bottle broken",
      imageAnalysis: null,
      userInputs: {},
    };

    const provider = mockProvider({ plasticType: "hard", cleanliness: "dirty" });
    const result = await runFullAnalysis(input, provider);

    // data
    assert(result.data !== undefined, "CASE 4: has data");
    assert(typeof result.data.weight === "number", "CASE 4: data.weight is number");
    assert(typeof result.data.material === "string", "CASE 4: data.material is string");
    assert(typeof result.data.condition === "string", "CASE 4: data.condition is string");

    // category
    assertEqual(result.category, "plastic", "CASE 4: has category");

    // categoryData
    assert(result.categoryData !== undefined, "CASE 4: has categoryData");
    assertEqual(result.categoryData.plasticType, "hard", "CASE 4: categoryData.plasticType");
    assertEqual(result.categoryData.cleanliness, "dirty", "CASE 4: categoryData.cleanliness");

    // pricing
    assert(result.pricing !== undefined, "CASE 4: has pricing");
    assert(typeof result.pricing.finalPrice === "number", "CASE 4: pricing.finalPrice is number");
    assert(typeof result.pricing.basePrice === "number", "CASE 4: pricing.basePrice is number");
    assert(result.pricing.breakdown !== undefined, "CASE 4: pricing has breakdown");
    assertEqual(result.pricing.currency, "INR", "CASE 4: pricing.currency = INR");

    // questionsAsked
    assert(Array.isArray(result.questionsAsked), "CASE 4: has questionsAsked array");

    // source
    assert(result.source !== undefined, "CASE 4: has source tracing");

    // Verify price: 3 × 20 × 0.6 × 0.7 = 25.2
    assertEqual(result.pricing.finalPrice, 25.2, "CASE 4: 3kg plastic broken dirty = 25.2");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Electronics end-to-end
  // ─────────────────────────────────────────────────────────────────────────

  section("Electronics End-to-End");

  {
    const input = {
      description: "5kg old fan",
      imageAnalysis: null,
      userInputs: {},
    };

    const asked = [];
    const provider = (q) => {
      asked.push(q.type);
      return { material: "iron", condition: "good", partsMissing: "no" }[q.type];
    };

    const result = await runFullAnalysis(input, provider);

    assertEqual(result.category, "electronics", "electronics: category detected");
    assertEqual(result.data.weight, 5, "electronics: weight = 5");
    assertEqual(result.data.material, "iron", "electronics: material from answer");
    assertEqual(result.categoryData.partsMissing, "no", "electronics: partsMissing = no");

    // 5 × 30 × 1.0 × 1.0 = 150
    assertEqual(result.pricing.finalPrice, 150, "electronics: 5kg iron good no missing = 150");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Immutability check
  // ─────────────────────────────────────────────────────────────────────────

  section("Immutability");

  {
    const input = {
      description: "2kg copper wire rusted",
      imageAnalysis: null,
      userInputs: {},
    };

    const inputCopy = JSON.stringify(input);
    const provider = mockProvider({ purity: "pure" });
    await runFullAnalysis(input, provider);

    assertEqual(JSON.stringify(input), inputCopy, "original input NOT mutated");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validation — errors
  // ─────────────────────────────────────────────────────────────────────────

  section("Validation");

  await assertThrowsAsync(
    () => runFullAnalysis(null, () => {}),
    "throws on null input"
  );
  await assertThrowsAsync(
    () => runFullAnalysis({}, "not a function"),
    "throws on non-function answerProvider"
  );

  // ─────────────────────────────────────────────────────────────────────────
  // User inputs override description
  // ─────────────────────────────────────────────────────────────────────────

  section("User Inputs Win");

  {
    const input = {
      description: "2kg copper wire rusted",
      imageAnalysis: null,
      userInputs: { weight: 10 },
    };

    const provider = mockProvider({ purity: "pure" });
    const result = await runFullAnalysis(input, provider);

    assertEqual(result.data.weight, 10, "userInputs.weight = 10 wins over description 2kg");
    // 10 × 600 × 0.6 × 1.0 = 3600
    assertEqual(result.pricing.finalPrice, 3600, "price uses user weight: 3600");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AI-assisted material (high confidence)
  // ─────────────────────────────────────────────────────────────────────────

  section("AI Assisted (High Confidence)");

  {
    const input = {
      description: "5kg item rusted",
      imageAnalysis: { material: "steel", confidence: 0.95 },
      userInputs: {},
    };

    const provider = mockProvider({ purity: "mixed" });
    const result = await runFullAnalysis(input, provider);

    assertEqual(result.data.material, "steel", "AI material used at 0.95 confidence");
    assertEqual(result.category, "metal", "AI-detected steel → metal category");
    // 5 × 40 × 0.6 × 0.8 = 96
    assertEqual(result.pricing.finalPrice, 96, "5kg steel rusted mixed = 96");
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

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
      "\n🎉 ALL TESTS PASSED — Orchestrator connects everything correctly.\n"
    );
    process.exit(0);
  }
})();
