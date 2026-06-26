/**
 * ScrapIQ REST API Server
 * ========================
 * Exposes the ScrapIQ pipeline via HTTP endpoints.
 *
 * Endpoints:
 *   POST /analyze  — Start analysis (JSON or multipart/form-data with image) [optionally authed]
 *   POST /answer   — Answer a question (returns next question or final result)
 *   GET  /session/:id — Check session status
 *   DELETE /session/:id — Discard a session
 *   GET  /history  — Previous analyses (REQUIRES valid JWT)
 *   POST /feedback — Submit accuracy feedback (REQUIRES valid JWT)
 *   GET  /health   — Health check
 *
 * Auth:
 *   All auth is done via Supabase JWT.
 *   Frontend must send:  Authorization: Bearer <supabase_access_token>
 *   x-user-id header is IGNORED — user identity comes only from verified token.
 *
 * Protection Layer (middleware/protection.js):
 *   - Session TTL:   10 minutes (expired → SESSION_EXPIRED)
 *   - Rate limit:    10 req/min per IP (exceeded → 429)
 *   - Sanitization:  trim + strip dangerous chars, validate numerics
 *
 * Auth Layer (middleware/authMiddleware.js):
 *   - requireAuth: enforces valid JWT — returns 401 if missing/invalid
 *   - optionalAuth: attaches user if token present, continues if not
 *
 * Stability Layer (utils/logger.js):
 *   - Structured logging via logEvent()
 *   - Standardized errors via errorResponse() / ERROR_CODES
 *   - Safe fallbacks: AI failure → question flow, DB failure → skip, pricing failure → error response
 *
 * AI FIELD POLICY (v2):
 *   - Material:   AI auto-detects (mandatory, used directly if confident)
 *   - Condition:  AI estimates only — presented to user for confirmation/edit
 *   - Weight:     NEVER auto-filled from AI — always requested from user
 */
require('dotenv').config();

// ─── STARTUP ENV VALIDATION ──────────────────────────────────────────────────
// Critical: Fail fast if core environment variables are missing.

const REQUIRED_ENV_VARS = ["SUPABASE_URL", "SUPABASE_KEY"];
const missingEnv = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  const errorMsg = `FATAL: Missing required environment variables: ${missingEnv.join(", ")}. Server cannot start.`;
  console.error(`\n❌ ${errorMsg}\n`);
  process.exit(1);
}

const express = require("express");
const crypto  = require("crypto");
const multer  = require("multer");

const { processInput }                              = require("./services/coreEngine");
const { generateNextQuestion, applyUserAnswer,
        detectCategory, extractCategoryData }       = require("./services/questionEngine");
const { calculatePrice, getImprovementSuggestions } = require("./services/pricingEngine");
const { analyzeImage }                              = require("./services/imageAnalysis");
const { calculateValuation }                        = require("./services/valuationService");
const { mapConfidenceScore }                        = require("./services/confidenceMapper");
const db                                            = require("./services/db");

// ─── Protection Layer ─────────────────────────────────────────────────────────

const {
  pruneExpiredSessions,
  startSessionCleanupInterval,
  sessionExpiryMiddleware,
  rateLimitMiddleware,
  sanitizeAnalyzeInput,
  sanitizeAnswerInput,
  isSessionExpired,
} = require("./middleware/protection");

// ─── Auth Layer ───────────────────────────────────────────────────────────────

const { requireAuth, optionalAuth } = require("./middleware/authMiddleware");

// ─── Stability Layer ──────────────────────────────────────────────────────────

const { logEvent, errorResponse } = require("./utils/logger");

// ─── App Setup ───────────────────────────────────────────────────────────────

const app = express();

// ─── Multer Setup (in-memory image upload) ───────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image type: ${file.mimetype}`));
    }
  },
});

// CORS — allow frontend origin (env var in prod, wildcard in dev)
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "*";
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, PATCH, OPTIONS");
  // Authorization header required for JWT; x-user-id removed
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

// ─── Global Middleware: Rate Limiting ────────────────────────────────────────

app.use(rateLimitMiddleware);

// ─── In-Memory Session Store ─────────────────────────────────────────────────

const sessions = {};

function createSessionId() {
  return crypto.randomUUID();
}

startSessionCleanupInterval(sessions);

// ─── Safe Wrappers ────────────────────────────────────────────────────────────

/**
 * Run AI image analysis with a safe fallback.
 * On failure: logs AI_ERROR and returns null so the question flow continues.
 */
async function safeAnalyzeImage(buffer, opts) {
  try {
    return await analyzeImage(buffer, opts);
  } catch (err) {
    logEvent("AI_ERROR", { error: err, details: { mimeType: opts.mimeType } });
    return null;
  }
}

/**
 * Persist analysis to DB with a safe fallback.
 * On failure: logs DB_ERROR silently — never surfaces to client.
 * @param {Object} result   - The result object from resolveState()
 * @param {string} context  - Route name for logging
 * @param {string|null} userId - Verified Supabase user UUID
 */
async function safeInsertAnalysis(result, context, userId) {
  try {
    const id = await db.insertAnalysis(result, userId);
    if (id) logEvent("COMPLETION", { details: { savedId: id, context } });
  } catch (err) {
    logEvent("DB_ERROR", { error: err, details: { context } });
  }
}

/**
 * Run pricing + improvement with a safe fallback.
 * On failure: logs PRICING_ERROR and re-throws so the caller returns a clean error response.
 */
function safePricing(params) {
  try {
    const pricing     = calculatePrice(params);
    const improvement = getImprovementSuggestions(params);
    return { pricing, improvement };
  } catch (err) {
    logEvent("PRICING_ERROR", { error: err, details: { category: params.category } });
    throw err;
  }
}

// ─── Core Resolution Helper ───────────────────────────────────────────────────

/**
 * Run processInput, check for next question.
 * If complete → run valuationService and return final result.
 * If incomplete → return next question.
 * @throws if pricing fails (caller must catch and return errorResponse)
 */
function resolveState(state) {
  const processed = processInput(state);
  const question  = generateNextQuestion(processed, state);

  if (question) {
    return { done: false, processed, question };
  }

  const category     = detectCategory(processed, state.description);
  const categoryData = extractCategoryData(state.userInputs, category);
  const imageAnalysis = state.imageAnalysis || null;

  // Use valuationService which cleanly wraps pricingEngine
  const { pricing, improvement, error: pricingError } = calculateValuation({
    data:          processed.data,
    category,
    categoryData,
    imageAnalysis, // provides cleanliness fallback
  });

  if (pricingError || !pricing) {
    throw new Error(pricingError || "Valuation failed");
  }

  // Build AI analysis summary for the frontend (explainability layer)
  const aiAnalysis = buildAiAnalysisSummary(imageAnalysis);

  return {
    done: true,
    result: {
      status: "COMPLETE",
      data:            processed.data,
      source:          processed.source,
      category,
      categoryData,
      pricing,
      improvement,
      confidenceLevel: processed.confidenceLevel,
      aiAnalysis,      // reasoning + confidence from Gemini
    },
  };
}

/**
 * Build a safe AI analysis summary to include in the final result.
 * Extracts the explainability fields from imageAnalysis output.
 * Returns null if no imageAnalysis was available.
 *
 * @param {Object|null} imageAnalysis
 * @returns {Object|null}
 */
function buildAiAnalysisSummary(imageAnalysis) {
  if (!imageAnalysis || imageAnalysis.error || imageAnalysis.source === "mock") {
    return null;
  }

  const confidenceInfo = mapConfidenceScore(imageAnalysis.confidenceScore ?? imageAnalysis.confidence);

  return {
    detectedMaterial:  imageAnalysis.material   || null,
    detectedCategory:  imageAnalysis.category   || null,
    detectedCondition: imageAnalysis.condition  || null,
    cleanliness:       imageAnalysis.cleanliness || null,
    // estimatedWeightKg is exposed as a SUGGESTION only — never auto-applied to valuation.
    // The frontend must display it as a hint and require explicit user confirmation.
    estimatedWeightKg: imageAnalysis.estimatedWeightKg || null,
    confidence: {
      level:       confidenceInfo.level,
      score:       confidenceInfo.score,
      label:       confidenceInfo.label,
      description: confidenceInfo.description,
    },
    reasoning: Array.isArray(imageAnalysis.reasoning)
      ? imageAnalysis.reasoning
      : [],
  };
}

// ─── POST /analyze ───────────────────────────────────────────────────────────
// Public route with optional auth — user identity attached if token provided.

app.post(
  "/analyze",
  upload.single("image"),
  optionalAuth,
  sanitizeAnalyzeInput,
  async (req, res) => {
    pruneExpiredSessions(sessions);
    const startedAt = Date.now();

    try {
      const description = req.body.description || "";
      // Use verified user from JWT only — never trust frontend-supplied user_id
      const userId = req.user?.id ?? null;

      let userInputs      = req.body.userInputs;
      const hasUserInputs = userInputs !== undefined && userInputs !== null;

      if (typeof userInputs === "string") {
        try {
          userInputs = JSON.parse(userInputs);
        } catch {
          return errorResponse(res, "INVALID_INPUT", "userInputs must be valid JSON");
        }
      }
      userInputs = userInputs || {};

      let imageAnalysis = req.body.imageAnalysis || null;
      if (typeof imageAnalysis === "string") {
        try {
          imageAnalysis = JSON.parse(imageAnalysis);
        } catch {
          return errorResponse(res, "INVALID_INPUT", "imageAnalysis must be valid JSON");
        }
      }

      // AI image analysis — safe fallback to null on failure
      if (req.file) {
        imageAnalysis = await safeAnalyzeImage(req.file.buffer, { mimeType: req.file.mimetype });
      }

      if (!imageAnalysis && !description && !hasUserInputs) {
        return errorResponse(
          res, "INVALID_INPUT",
          "At least one input is required: image, imageAnalysis, description, or userInputs"
        );
      }

      // ── AI Field Pre-fill Policy ────────────────────────────────────────
      //
      // MATERIAL:   Auto-detected from AI when confidence is sufficient.
      //             coreEngine handles this via its priority chain.
      //
      // CONDITION:  NOT pre-filled. AI condition estimate is surfaced to the
      //             frontend via aiAnalysis.detectedCondition as a display hint
      //             only. The user must always confirm condition — it directly
      //             affects valuation and AI must not be the final authority.
      //
      // WEIGHT:     NEVER pre-filled from AI estimation under any circumstances.
      //             AI weight is exposed via aiAnalysis.estimatedWeightKg as a
      //             display hint only. The weight question is always asked.
      //
      // CLEANLINESS: NOT pre-filled. The user must always answer the clean/dirty
      //              question. AI cleanliness was previously pre-filled here which
      //              caused the cleanliness question to be silently skipped.
      //              Removed so the question flow always asks the user.
      //
      // No AI-to-userInputs pre-filling occurs here for any field.

      logEvent("ANALYZE_START", {
        details: {
          hasImage:          !!imageAnalysis,
          hasDescription:    !!description,
          hasUserInputs,
          userId:            userId ?? "anonymous",
          aiMaterial:        imageAnalysis?.material        ?? null,
          aiConfidenceScore: imageAnalysis?.confidenceScore ?? null,
          aiCleanliness:     imageAnalysis?.cleanliness     ?? null,
          aiWeightEstimate:  imageAnalysis?.estimatedWeightKg ?? null,
        },
      });

      const state = {
        imageAnalysis: imageAnalysis || null,
        description:   description || "",
        userInputs:    userInputs || {},
      };

      console.log("[POST /analyze] imageAnalysis material:", imageAnalysis?.material ?? "none");
      console.log("[POST /analyze] imageAnalysis source:", imageAnalysis?.source ?? "none");

      let resolution;
      try {
        resolution = resolveState(state);
      } catch (err) {
        return errorResponse(res, "PRICING_ERROR");
      }

      if (resolution.done) {
        safeInsertAnalysis(resolution.result, "POST /analyze", userId);
        logEvent("COMPLETION", { details: { source: "analyze_direct", durationMs: Date.now() - startedAt } });
        return res.json(resolution.result);
      }

      const sessionId = createSessionId();
      // Store verified userId in session — /answer will use it, never re-read from headers
      sessions[sessionId] = { state, questionsAsked: [], createdAt: Date.now(), userId };

      logEvent("ANALYZE_START", {
        sessionId,
        details: { event: "session_created", firstQuestion: resolution.question.type },
      });

      // Build AI analysis to include in NEEDS_INPUT response
      const aiAnalysis = buildAiAnalysisSummary(state.imageAnalysis);
      console.log("[POST /analyze NEEDS_INPUT] aiAnalysis:", aiAnalysis);

      return res.json({
        status: "NEEDS_INPUT",
        sessionId,
        question: {
          type:     resolution.question.type,
          question: resolution.question.question,
          category: resolution.question.category,
        },
        aiAnalysis,  // Include AI detection data for frontend visualization
      });
    } catch (err) {
      logEvent("ERROR", { error: err, details: { route: "POST /analyze" } });
      return errorResponse(res, "INTERNAL_ERROR");
    }
  }
);

// ─── POST /answer ────────────────────────────────────────────────────────────
// Session-bound — userId comes from session only (set during /analyze).

app.post(
  "/answer",
  sanitizeAnswerInput,
  sessionExpiryMiddleware(sessions),
  async (req, res) => {
    pruneExpiredSessions(sessions);

    try {
      const { sessionId, answer } = req.body;

      if (!sessionId || typeof sessionId !== "string") {
        return errorResponse(res, "INVALID_INPUT", "sessionId is required");
      }
      if (!answer || typeof answer !== "object") {
        return errorResponse(res, "INVALID_INPUT", "answer is required as { type, value }");
      }
      if (!answer.type || typeof answer.type !== "string") {
        return errorResponse(res, "INVALID_INPUT", "answer.type is required");
      }
      if (answer.value === null || answer.value === undefined) {
        return errorResponse(res, "INVALID_INPUT", "answer.value is required — do not send null");
      }

      const session = sessions[sessionId];
      if (!session) {
        logEvent("ERROR", { sessionId, details: { event: "session_not_found", route: "POST /answer" } });
        return errorResponse(res, "SESSION_NOT_FOUND");
      }

      // userId is always sourced from the session (which was set from verified JWT during /analyze).
      // Never read x-user-id or any user identity from this request.
      const userId = session.userId ?? null;

      logEvent("ANSWER_STEP", {
        sessionId,
        details: {
          answerType:        answer.type,
          questionsAnswered: session.questionsAsked.length + 1,
        },
      });

      session.state = applyUserAnswer(session.state, answer);
      session.questionsAsked.push({ type: answer.type, value: answer.value });

      let resolution;
      try {
        resolution = resolveState(session.state);
      } catch (err) {
        logEvent("PRICING_ERROR", { sessionId, error: err });
        return errorResponse(res, "PRICING_ERROR");
      }

      if (resolution.done) {
        resolution.result.questionsAsked = session.questionsAsked;
        delete sessions[sessionId];

        safeInsertAnalysis(resolution.result, "POST /answer", userId);

        logEvent("COMPLETION", {
          sessionId,
          details: {
            totalAnswers: resolution.result.questionsAsked.length,
            category:     resolution.result.category,
          },
        });

        return res.json(resolution.result);
      }

      // Build AI analysis to include in NEEDS_INPUT response
      const aiAnalysis = buildAiAnalysisSummary(session.state.imageAnalysis);
      console.log("[POST /answer NEEDS_INPUT] aiAnalysis:", aiAnalysis);

      return res.json({
        status: "NEEDS_INPUT",
        sessionId,
        question: {
          type:     resolution.question.type,
          question: resolution.question.question,
          category: resolution.question.category,
        },
        answeredSoFar: session.questionsAsked.length,
        aiAnalysis,  // Include AI detection data for frontend visualization
      });
    } catch (err) {
      logEvent("ERROR", { error: err, details: { route: "POST /answer" } });
      return errorResponse(res, "INTERNAL_ERROR");
    }
  }
);

// ─── GET /session/:id ────────────────────────────────────────────────────────

app.get("/session/:id", (req, res) => {
  const session = sessions[req.params.id];
  if (!session) {
    return errorResponse(res, "SESSION_NOT_FOUND");
  }

  if (isSessionExpired(session)) {
    delete sessions[req.params.id];
    logEvent("SESSION_EXPIRED", { sessionId: req.params.id });
    return errorResponse(res, "SESSION_EXPIRED");
  }

  try {
    const processed = processInput(session.state);
    return res.json({
      sessionId:      req.params.id,
      resolvedData:   processed.data,
      missingFields:  processed.missingFields,
      questionsAsked: session.questionsAsked.length,
      ageSeconds:     Math.round((Date.now() - session.createdAt) / 1000),
    });
  } catch (err) {
    logEvent("ERROR", { sessionId: req.params.id, error: err, details: { route: "GET /session/:id" } });
    return errorResponse(res, "INTERNAL_ERROR");
  }
});

// ─── DELETE /session/:id ─────────────────────────────────────────────────────

app.delete("/session/:id", (req, res) => {
  if (sessions[req.params.id]) {
    delete sessions[req.params.id];
    return res.json({ message: "Session deleted" });
  }
  return errorResponse(res, "SESSION_NOT_FOUND");
});

// ─── GET /history ─────────────────────────────────────────────────────────────
// PROTECTED — requires valid Supabase JWT.
// User identity comes exclusively from the verified token (req.user.id).

app.get("/history", requireAuth, async (req, res) => {
  try {
    // req.user is guaranteed by requireAuth — no fallback needed
    const userId   = req.user.id;
    const analyses = await db.fetchAnalyses(userId);
    return res.json({ analyses });
  } catch (err) {
    logEvent("DB_ERROR", { error: err, details: { route: "GET /history" } });
    return errorResponse(res, "DB_ERROR");
  }
});

// ─── DELETE /analysis/:id ─────────────────────────────────────────────────────
// PROTECTED — requires valid Supabase JWT.
// Only deletes rows owned by the authenticated user.

app.delete("/analysis/:id", requireAuth, async (req, res) => {
  try {
    const userId     = req.user.id;
    const analysisId = req.params.id;

    if (!analysisId) {
      return res.status(400).json({ error: "MISSING_ID", message: "Analysis ID is required" });
    }

    const deleted = await db.deleteAnalysis(analysisId, userId);

    if (!deleted) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Analysis not found or not owned by user" });
    }

    return res.json({ success: true, message: "Analysis deleted" });
  } catch (err) {
    logEvent("DB_ERROR", { error: err, details: { route: "DELETE /analysis/:id" } });
    return errorResponse(res, "DB_ERROR");
  }
});

// ─── PATCH /analysis/:id/pin ──────────────────────────────────────────────────
// PROTECTED — requires valid Supabase JWT.
// Requires: ALTER TABLE analyses ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

app.patch("/analysis/:id/pin", requireAuth, async (req, res) => {
  try {
    const userId     = req.user.id;
    const analysisId = req.params.id;
    const isPinned   = Boolean(req.body?.is_pinned);

    if (!analysisId) {
      return res.status(400).json({ error: "MISSING_ID", message: "Analysis ID is required" });
    }

    const ok = await db.togglePinAnalysis(analysisId, userId, isPinned);

    if (!ok) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Analysis not found or update failed" });
    }

    return res.json({ success: true, is_pinned: isPinned });
  } catch (err) {
    logEvent("DB_ERROR", { error: err, details: { route: "PATCH /analysis/:id/pin" } });
    return errorResponse(res, "DB_ERROR");
  }
});

// ─── POST /feedback ───────────────────────────────────────────────────────────
// PROTECTED — requires valid Supabase JWT.
// User identity comes exclusively from the verified token (req.user.id).

app.post("/feedback", requireAuth, async (req, res) => {
  try {
    const { analysis_id, is_accurate, note } = req.body;
    // req.user is guaranteed by requireAuth — never read from headers or body
    const userId = req.user.id;

    if (!analysis_id || typeof analysis_id !== "string") {
      return errorResponse(res, "INVALID_INPUT", "analysis_id is required (string)");
    }
    if (typeof is_accurate !== "boolean") {
      return errorResponse(res, "INVALID_INPUT", "is_accurate is required (boolean)");
    }
    if (note !== undefined && note !== null && typeof note !== "string") {
      return errorResponse(res, "INVALID_INPUT", "note must be a string or omitted");
    }

    let feedbackId = null;
    try {
      feedbackId = await db.insertFeedback({ analysis_id, is_accurate, note, user_id: userId });
    } catch (err) {
      logEvent("DB_ERROR", { error: err, details: { route: "POST /feedback" } });
      // safe fallback — still respond successfully
    }

    return res.json({
      success:    true,
      feedbackId: feedbackId ?? null,
      message:    feedbackId
        ? "Feedback saved — thank you!"
        : "Feedback received (DB unavailable — not persisted)",
    });
  } catch (err) {
    logEvent("ERROR", { error: err, details: { route: "POST /feedback" } });
    return errorResponse(res, "INTERNAL_ERROR");
  }
});

// ─── Market Data Endpoints ───────────────────────────────────────────────────

const { getEnrichedMarketData, getAllPrices, getCacheStats } = require("./services/marketData");

/**
 * GET /api/market/prices
 * Returns enriched market data with prices, trends, and insights
 * Query params:
 *   ?materials=copper,aluminum,steel (optional, defaults to all)
 */
app.get("/api/market/prices", async (req, res) => {
  try {
    // Allow optional material filtering
    const requestedMaterials = req.query.materials
      ? req.query.materials.split(",").map(m => m.trim().toLowerCase())
      : ["copper", "aluminum", "steel"];

    const enrichedData = await getEnrichedMarketData(requestedMaterials);

    res.json({
      success: true,
      data: enrichedData,
      timestamp: Date.now(),
      cacheStats: getCacheStats(),
    });

    logEvent("MARKET_DATA_SERVED", {
      details: { materials: requestedMaterials.length },
    });
  } catch (err) {
    logEvent("ERROR", {
      error: err,
      details: { route: "GET /api/market/prices" },
    });
    return errorResponse(res, "INTERNAL_ERROR");
  }
});

/**
 * GET /market-prices
 * Alias for /api/market/prices (for frontend compatibility)
 */
app.get("/market-prices", async (req, res) => {
  try {
    const requestedMaterials = req.query.materials
      ? req.query.materials.split(",").map(m => m.trim().toLowerCase())
      : ["copper", "aluminum", "steel"];

    const enrichedData = await getEnrichedMarketData(requestedMaterials);

    res.json({
      success: true,
      data: {
        materials: enrichedData,
      },
      timestamp: Date.now(),
      cacheStats: getCacheStats(),
    });

    logEvent("MARKET_DATA_SERVED", {
      details: { materials: requestedMaterials.length, route: "GET /market-prices" },
    });
  } catch (err) {
    logEvent("ERROR", {
      error: err,
      details: { route: "GET /market-prices" },
    });
    return errorResponse(res, "INTERNAL_ERROR");
  }
});

/**
 * GET /api/market/price/:material
 * Returns price data for a single material
 * Example: /api/market/price/copper
 */
app.get("/api/market/price/:material", async (req, res) => {
  try {
    const { material } = req.params;

    if (!material || material.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Material parameter required",
      });
    }

    const enrichedData = await getEnrichedMarketData([material.toLowerCase()]);
    const priceData = enrichedData[material.toLowerCase()];

    if (!priceData) {
      return res.status(404).json({
        success: false,
        error: `Material not found: ${material}`,
      });
    }

    res.json({
      success: true,
      data: priceData,
      timestamp: Date.now(),
    });

    logEvent("MARKET_DATA_SINGLE", {
      details: { material: material.toLowerCase() },
    });
  } catch (err) {
    logEvent("ERROR", {
      error: err,
      details: { route: "GET /api/market/price/:material" },
    });
    return errorResponse(res, "INTERNAL_ERROR");
  }
});

/**
 * GET /api/market/cache-stats
 * Returns cache statistics (for debugging/monitoring)
 */
app.get("/api/market/cache-stats", (_req, res) => {
  try {
    const stats = getCacheStats();
    res.json({
      success: true,
      stats,
    });
  } catch (err) {
    logEvent("ERROR", {
      error: err,
      details: { route: "GET /api/market/cache-stats" },
    });
    return errorResponse(res, "INTERNAL_ERROR");
  }
});

// ─── Health Check ────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status:         "ok",
    service:        "ScrapIQ",
    activeSessions: Object.keys(sessions).length,
  });
});

// ─── Unhandled Rejection / Exception Guards ───────────────────────────────────

process.on("unhandledRejection", (reason) => {
  logEvent("ERROR", {
    error:   reason instanceof Error ? reason : new Error(String(reason)),
    details: { type: "unhandledRejection" },
  });
});

process.on("uncaughtException", (err) => {
  logEvent("ERROR", { error: err, details: { type: "uncaughtException" } });
  // intentionally do NOT call process.exit() — keep the server alive
});

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 ScrapIQ API running on http://localhost:${PORT}`);
  console.log(`\n   POST /analyze           — Start analysis (optional auth)`);
  console.log(`   POST /answer            — Answer a question`);
  console.log(`   GET  /session/:id       — Check session`);
  console.log(`   GET  /history           — Previous analyses 🔒 (JWT required)`);
  console.log(`   POST /feedback          — Submit accuracy feedback 🔒 (JWT required)`);
  console.log(`   GET  /api/market/prices — Enriched market data`);
  console.log(`   GET  /api/market/price/:material — Single material price`);
  console.log(`   GET  /api/market/cache-stats — Cache statistics`);
  console.log(`   GET  /health            — Health check\n`);
  console.log(`   🔑  Auth layer active:`);
  console.log(`       • JWT verified via Supabase on every protected request`);
  console.log(`       • x-user-id header IGNORED — identity from token only`);
  console.log(`       • /history and /feedback → 401 without valid Bearer token`);
  console.log(`   🛡  Protection layer active:`);
  console.log(`       • Session TTL    : 10 minutes`);
  console.log(`       • Rate limit     : 10 req/min per IP`);
  console.log(`       • Sanitization   : strings trimmed + script-stripped`);
  console.log(`   📋  Stability layer active:`);
  console.log(`       • Structured logging via logEvent()`);
  console.log(`       • Standardized errors via errorResponse()`);
  console.log(`       • Safe fallbacks: AI / DB / pricing`);
  console.log(`   💹 Market data service active:`);
  console.log(`       • Real-time commodity pricing`);
  console.log(`       • 5-minute cache with stale detection`);
  console.log(`       • Intelligent fallback system`);
  console.log(`   🤖 AI field policy:`);
  console.log(`       • Material  : auto-detected (mandatory)`);
  console.log(`       • Condition : AI estimate shown for user confirmation`);
  console.log(`       • Weight    : ALWAYS requested from user (never auto-filled)\n`);
});

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { app, server, sessions };