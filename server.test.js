/**
 * ScrapIQ API — Integration Test
 * ================================
 * Starts the server, runs HTTP requests through the full Q&A flow,
 * and verifies responses at every step.
 *
 * Run: node server.test.js
 */

const http = require("http");
const { app, server: existingServer, sessions } = require("./server");

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
  console.log(`\n── ${title} ${"─".repeat(56 - title.length)}`);
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3001";

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function post(path, body) { return request("POST", path, body); }
function get(path) { return request("GET", path); }
function del(path) { return request("DELETE", path); }

// ─── Tests ───────────────────────────────────────────────────────────────────

async function runTests() {
  // Start on a different port for testing
  const testServer = app.listen(3001);

  // Close the default server started by require
  existingServer.close();

  try {
    // ══════════════════════════════════════════════════════════════════════
    // Health Check
    // ══════════════════════════════════════════════════════════════════════

    section("GET /health");
    {
      const res = await get("/health");
      assertEqual(res.status, 200, "health returns 200");
      assertEqual(res.body.status, "ok", "health status = ok");
      assertEqual(res.body.service, "ScrapIQ", "health service = ScrapIQ");
    }

    // ══════════════════════════════════════════════════════════════════════
    // CASE 1: Complete input → direct pricing (no session)
    // ══════════════════════════════════════════════════════════════════════

    section("CASE 1 — Complete Input → Direct Result");
    {
      const res = await post("/analyze", {
        description: "2kg copper wire rusted",
        userInputs: { purity: "pure" },
      });

      assertEqual(res.status, 200, "returns 200");
      assertEqual(res.body.status, "COMPLETE", "status = COMPLETE");
      assertEqual(res.body.data.weight, 2, "weight = 2");
      assertEqual(res.body.data.material, "copper", "material = copper");
      assertEqual(res.body.data.condition, "damaged", "condition = damaged");
      assertEqual(res.body.category, "metal", "category = metal");
      assertEqual(res.body.pricing.finalPrice, 720, "finalPrice = 720");
      assert(!res.body.sessionId, "no sessionId (resolved immediately)");
    }

    // ══════════════════════════════════════════════════════════════════════
    // CASE 2: Missing weight → session → answer → complete
    // ══════════════════════════════════════════════════════════════════════

    section("CASE 2 — Missing Weight → Q&A Flow");
    {
      // Step 1: Analyze
      const r1 = await post("/analyze", {
        description: "copper wire rusted",
        userInputs: {},
      });

      assertEqual(r1.status, 200, "analyze returns 200");
      assertEqual(r1.body.status, "NEEDS_INPUT", "status = NEEDS_INPUT");
      assert(typeof r1.body.sessionId === "string", "returns sessionId");
      assertEqual(r1.body.question.type, "weight", "first question = weight");

      const sid = r1.body.sessionId;

      // Step 2: Check session
      const rSession = await get(`/session/${sid}`);
      assertEqual(rSession.status, 200, "session check returns 200");
      assert(rSession.body.missingFields.includes("weight"), "session shows weight missing");

      // Step 3: Answer weight
      const r2 = await post("/answer", {
        sessionId: sid,
        answer: { type: "weight", value: 4 },
      });

      assertEqual(r2.status, 200, "answer returns 200");
      // After weight → metal category → needs purity next
      assertEqual(r2.body.question.type, "purity", "next question = purity");

      // Step 4: Answer purity
      const r3 = await post("/answer", {
        sessionId: sid,
        answer: { type: "purity", value: "pure" },
      });

      // Now condition is still missing (rusted → damaged from description, so should be resolved)
      // Check if complete or needs condition
      if (r3.body.status === "COMPLETE") {
        assertEqual(r3.body.data.weight, 4, "weight = 4 from answer");
        assertEqual(r3.body.data.material, "copper", "material from description");
        assert(typeof r3.body.pricing.finalPrice === "number", "has finalPrice");
        // 4 × 600 × 0.6 × 1.0 = 1440
        assertEqual(r3.body.pricing.finalPrice, 1440, "finalPrice = 1440");
      } else {
        // If condition question comes, answer it
        const r4 = await post("/answer", {
          sessionId: sid,
          answer: { type: "condition", value: "damaged" },
        });
        assertEqual(r4.body.status, "COMPLETE", "complete after condition answer");
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // CASE 3: Multiple missing → full loop
    // ══════════════════════════════════════════════════════════════════════

    section("CASE 3 — Multiple Missing → Full Q&A Loop");
    {
      const r1 = await post("/analyze", {
        description: "",
        userInputs: {},
      });

      assertEqual(r1.body.status, "NEEDS_INPUT", "status = NEEDS_INPUT");
      assertEqual(r1.body.question.type, "weight", "asks weight first");

      const sid = r1.body.sessionId;

      // Answer weight
      const r2 = await post("/answer", {
        sessionId: sid,
        answer: { type: "weight", value: 5 },
      });
      assertEqual(r2.body.question.type, "material", "asks material second");

      // Answer material
      const r3 = await post("/answer", {
        sessionId: sid,
        answer: { type: "material", value: "iron" },
      });

      // After material = iron → category = metal → asks purity or condition
      assert(
        r3.body.question.type === "purity" || r3.body.question.type === "condition",
        "asks purity or condition next"
      );

      // Answer remaining questions until complete
      let current = r3;
      const answerMap = { purity: "mixed", condition: "used" };
      let safety = 5;

      while (current.body.status === "NEEDS_INPUT" && safety-- > 0) {
        const qType = current.body.question.type;
        current = await post("/answer", {
          sessionId: sid,
          answer: { type: qType, value: answerMap[qType] || "good" },
        });
      }

      assertEqual(current.body.status, "COMPLETE", "eventually completes");
      assertEqual(current.body.data.weight, 5, "weight = 5");
      assertEqual(current.body.data.material, "iron", "material = iron");
      assert(typeof current.body.pricing.finalPrice === "number", "has finalPrice");
      assert(current.body.pricing.finalPrice > 0, "finalPrice > 0");
    }

    // ══════════════════════════════════════════════════════════════════════
    // CASE 4: Electronics item (fan)
    // ══════════════════════════════════════════════════════════════════════

    section("CASE 4 — Electronics (Fan)");
    {
      const r1 = await post("/analyze", {
        description: "5kg old fan",
        userInputs: {},
      });

      assertEqual(r1.body.status, "NEEDS_INPUT", "needs input");
      const sid = r1.body.sessionId;

      // Answer all questions in sequence
      let current = r1;
      const answerMap = { material: "iron", condition: "good", partsMissing: "no" };
      let safety = 5;

      while (current.body.status === "NEEDS_INPUT" && safety-- > 0) {
        const qType = current.body.question.type;
        current = await post("/answer", {
          sessionId: sid,
          answer: { type: qType, value: answerMap[qType] },
        });
      }

      assertEqual(current.body.status, "COMPLETE", "completes");
      assertEqual(current.body.category, "electronics", "category = electronics");
      assertEqual(current.body.pricing.finalPrice, 150, "5kg iron good no missing = 150");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Validation Tests
    // ══════════════════════════════════════════════════════════════════════

    section("Validation");
    {
      // Empty body
      const r1 = await post("/analyze", {});
      assertEqual(r1.status, 400, "/analyze rejects empty body");

      // Invalid sessionId
      const r2 = await post("/answer", {
        sessionId: "fake-id-does-not-exist",
        answer: { type: "weight", value: 1 },
      });
      assertEqual(r2.status, 404, "/answer rejects invalid sessionId");

      // Missing answer
      const r3 = await post("/answer", { sessionId: "abc" });
      assertEqual(r3.status, 400, "/answer rejects missing answer");

      // Missing answer.type
      const r4 = await post("/answer", {
        sessionId: "abc",
        answer: { value: 1 },
      });
      assertEqual(r4.status, 400, "/answer rejects missing answer.type");

      // Null answer.value
      const r5 = await post("/answer", {
        sessionId: "abc",
        answer: { type: "weight", value: null },
      });
      assertEqual(r5.status, 400, "/answer rejects null value");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Session Management
    // ══════════════════════════════════════════════════════════════════════

    section("Session Management");
    {
      // Create a session
      const r1 = await post("/analyze", {
        description: "some item",
        userInputs: {},
      });
      const sid = r1.body.sessionId;
      assert(typeof sid === "string", "session created");

      // Check it exists
      const r2 = await get(`/session/${sid}`);
      assertEqual(r2.status, 200, "session exists");

      // Delete it
      const r3 = await del(`/session/${sid}`);
      assertEqual(r3.status, 200, "session deleted");

      // Confirm gone
      const r4 = await get(`/session/${sid}`);
      assertEqual(r4.status, 404, "session gone after delete");

      // Delete non-existent
      const r5 = await del("/session/non-existent");
      assertEqual(r5.status, 404, "delete non-existent returns 404");
    }

    // ══════════════════════════════════════════════════════════════════════
    // Session cleanup after completion
    // ══════════════════════════════════════════════════════════════════════

    section("Session Cleanup on Completion");
    {
      const r1 = await post("/analyze", {
        description: "copper wire",
        userInputs: {},
      });
      const sid = r1.body.sessionId;

      // Answer all fields until complete
      let current = r1;
      const answerMap = { weight: 1, purity: "pure", condition: "good" };
      let safety = 5;

      while (current.body.status === "NEEDS_INPUT" && safety-- > 0) {
        current = await post("/answer", {
          sessionId: sid,
          answer: { type: current.body.question.type, value: answerMap[current.body.question.type] },
        });
      }

      assertEqual(current.body.status, "COMPLETE", "completes");

      // Session should be cleaned up
      const r2 = await get(`/session/${sid}`);
      assertEqual(r2.status, 404, "session auto-deleted after completion");
    }

  } finally {
    testServer.close();
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
    console.log("\n🎉 ALL TESTS PASSED — API is working end-to-end.\n");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
