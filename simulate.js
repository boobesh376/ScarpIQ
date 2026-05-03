/**
 * ScrapIQ — Full System Simulation
 * ==================================
 * Runs multiple real-world scenarios through the entire pipeline:
 *   coreEngine → questionEngine → pricingEngine → orchestrator
 *
 * Run: node simulate.js
 */

const { runFullAnalysis } = require("./services/orchestrator");

// ─── Styling Helpers ─────────────────────────────────────────────────────────

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function header(text) {
  const line = "═".repeat(64);
  console.log(`\n${CYAN}${line}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`);
  console.log(`${CYAN}${line}${RESET}\n`);
}

function subheader(text) {
  console.log(`${YELLOW}  ── ${text} ${"─".repeat(50 - text.length)}${RESET}`);
}

function logQuestion(question) {
  console.log(`${MAGENTA}  ❓ QUESTION [${question.category}/${question.type}]: ${question.question}${RESET}`);
}

function logAnswer(type, value) {
  console.log(`${GREEN}  ✏️  ANSWER: ${type} = ${JSON.stringify(value)}${RESET}`);
}

function logResult(result) {
  subheader("Resolved Data");
  console.log(`     Material:  ${BOLD}${result.data.material}${RESET}`);
  console.log(`     Weight:    ${BOLD}${result.data.weight} kg${RESET}`);
  console.log(`     Condition: ${BOLD}${result.data.condition}${RESET}`);

  subheader("Category");
  console.log(`     Category:     ${BOLD}${result.category}${RESET}`);
  if (Object.keys(result.categoryData).length > 0) {
    for (const [k, v] of Object.entries(result.categoryData)) {
      console.log(`     ${k}: ${BOLD}${v}${RESET}`);
    }
  }

  subheader("Source Tracing");
  for (const [field, src] of Object.entries(result.source)) {
    console.log(`     ${field} ← ${DIM}${src}${RESET}`);
  }

  subheader("Pricing Breakdown");
  const p = result.pricing;
  console.log(`     Material Rate:     ₹${p.breakdown.materialRate}/kg`);
  console.log(`     Weight:            ${p.breakdown.weight} kg`);
  console.log(`     Condition Factor:  ${p.breakdown.conditionFactor}`);
  console.log(`     Adjustment Factor: ${p.breakdown.adjustmentFactor}`);
  console.log(`     Base Price:        ₹${p.basePrice}`);
  console.log(`     ${BOLD}${GREEN}Final Price:       ₹${p.finalPrice}${RESET}`);

  subheader("Questions Asked");
  if (result.questionsAsked.length === 0) {
    console.log(`     ${DIM}(none — all data resolved from input)${RESET}`);
  } else {
    result.questionsAsked.forEach((q, i) => {
      console.log(`     ${i + 1}. [${q.type}] "${q.question}" → ${JSON.stringify(q.answer)}`);
    });
  }
}

// ─── Answer Provider Factory ─────────────────────────────────────────────────

/**
 * Creates an answerProvider that logs Q&A and looks up answers from a map.
 */
function createProvider(answers) {
  return (question) => {
    logQuestion(question);
    const value = answers[question.type];
    if (value === undefined) {
      throw new Error(`No mock answer for question type: ${question.type}`);
    }
    logAnswer(question.type, value);
    return value;
  };
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

const scenarios = [
  {
    name: "SCENARIO 1 — Complete Input (No Questions Expected for Core)",
    description: "All core fields from description + AI. Only category questions asked.",
    input: {
      imageAnalysis: { material: "copper", confidence: 0.85, condition: "rusted" },
      description: "2kg copper item slightly rusted",
      userInputs: {},
    },
    answers: { purity: "pure" },
  },
  {
    name: "SCENARIO 2 — Missing Weight",
    description: "Description has material/condition, but no weight. System must ask.",
    input: {
      imageAnalysis: null,
      description: "copper wire broken",
      userInputs: {},
    },
    answers: { weight: 4, purity: "mixed" },
  },
  {
    name: "SCENARIO 3 — Missing Material",
    description: "Weight in description, but material unknown. AI confidence too low.",
    input: {
      imageAnalysis: { material: "steel", confidence: 0.5 },
      description: "3kg broken item",
      userInputs: {},
    },
    answers: { material: "aluminum", purity: "pure" },
  },
  {
    name: "SCENARIO 4 — Electronics Item (Fan)",
    description: "Fan detected from description → electronics category → specific questions.",
    input: {
      imageAnalysis: null,
      description: "5kg old ceiling fan",
      userInputs: {},
    },
    answers: { material: "iron", condition: "good", partsMissing: "no" },
  },
  {
    name: "SCENARIO 5 — Plastic Item (Dirty)",
    description: "Plastic bottle with all data, only category extras needed.",
    input: {
      imageAnalysis: null,
      description: "2kg plastic bottle broken",
      userInputs: {},
    },
    answers: { plasticType: "hard", cleanliness: "dirty" },
  },
  {
    name: "SCENARIO 6 — User Inputs Override Everything",
    description: "Description says 2kg copper, but user explicitly provides different values.",
    input: {
      imageAnalysis: { material: "iron", confidence: 0.99 },
      description: "2kg copper wire rusted",
      userInputs: { weight: 10, material: "steel", condition: "good" },
    },
    answers: { purity: "pure" },
  },
  {
    name: "SCENARIO 7 — Iron Box (Electronics, NOT Metal)",
    description: "'iron box' is a clothes pressing iron → electronics, not metal scrap.",
    input: {
      imageAnalysis: null,
      description: "3kg iron box",
      userInputs: {},
    },
    answers: { condition: "damaged", partsMissing: "yes" },
  },
  {
    name: "SCENARIO 8 — Everything Missing (Worst Case)",
    description: "No description, no AI, no user inputs. System must ask everything.",
    input: {
      imageAnalysis: null,
      description: "",
      userInputs: {},
    },
    answers: { weight: 1, material: "iron", condition: "used", purity: "mixed" },
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function runAllScenarios() {
  header("ScrapIQ — Full System Simulation");
  console.log(`  Running ${scenarios.length} scenarios through the complete pipeline:`);
  console.log(`  ${DIM}coreEngine → questionEngine → pricingEngine → orchestrator${RESET}\n`);

  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    header(scenario.name);
    console.log(`  ${DIM}${scenario.description}${RESET}\n`);

    subheader("Input");
    if (scenario.input.description) {
      console.log(`     Description: "${scenario.input.description}"`);
    } else {
      console.log(`     Description: ${DIM}(empty)${RESET}`);
    }
    if (scenario.input.imageAnalysis) {
      const ai = scenario.input.imageAnalysis;
      console.log(`     AI: material=${ai.material}, confidence=${ai.confidence}`);
    } else {
      console.log(`     AI: ${DIM}(none)${RESET}`);
    }
    if (Object.keys(scenario.input.userInputs || {}).length > 0) {
      console.log(`     UserInputs: ${JSON.stringify(scenario.input.userInputs)}`);
    }
    console.log();

    subheader("Q&A Flow");

    try {
      const provider = createProvider(scenario.answers);
      const result = await runFullAnalysis(scenario.input, provider);

      console.log();
      logResult(result);

      // Validate core invariants
      const valid =
        result.data.weight > 0 &&
        typeof result.data.material === "string" &&
        typeof result.data.condition === "string" &&
        typeof result.pricing.finalPrice === "number" &&
        result.pricing.finalPrice > 0;

      if (valid) {
        passCount++;
        console.log(`\n  ${GREEN}${BOLD}✅ SCENARIO PASSED${RESET}`);
      } else {
        failCount++;
        console.log(`\n  ${RED}${BOLD}❌ SCENARIO FAILED — invalid output${RESET}`);
      }
    } catch (err) {
      failCount++;
      console.log(`\n  ${RED}${BOLD}❌ SCENARIO FAILED — ${err.message}${RESET}`);
    }
  }

  // ── Final Summary ──────────────────────────────────────────────────────────
  header("Simulation Summary");
  console.log(`  Total Scenarios: ${scenarios.length}`);
  console.log(`  ${GREEN}✅ Passed: ${passCount}${RESET}`);
  if (failCount > 0) {
    console.log(`  ${RED}❌ Failed: ${failCount}${RESET}`);
  }
  console.log();

  if (failCount === 0) {
    console.log(`  ${GREEN}${BOLD}🎉 ALL SCENARIOS PASSED — ScrapIQ full pipeline is working!${RESET}\n`);
  } else {
    console.log(`  ${RED}${BOLD}⚠️  Some scenarios failed. Review output above.${RESET}\n`);
    process.exit(1);
  }
}

runAllScenarios();
