/**
 * ScrapIQ REST API Server
 * ========================
 * Exposes the ScrapIQ pipeline via HTTP endpoints.
 *
 * Endpoints:
 *   POST /analyze  — Start analysis (JSON or multipart/form-data with image)
 *   POST /answer   — Answer a question (returns next question or final result)
 *   GET  /session/:id — Check session status
 *   DELETE /session/:id — Discard a session
 *   GET  /history  — Previous analyses
 *   POST /feedback — Submit accuracy feedback
 *   GET  /health   — Health check
 *
 * Protection Layer (middleware/protection.js):
 *   - Session TTL:   10 minutes (expired → SESSION_EXPIRED)
 *   - Rate limit:    10 req/min per IP (exceeded → 429)
 *   - Sanitization:  trim + strip dangerous chars, validate numerics
 *
 * Stability Layer (utils/logger.js):
 *   - Structured logging via logEvent()
 *   - Standardized errors via errorResponse() / ERROR_CODES
 *   - Safe fallbacks: AI failure → question flow, DB failure → skip, pricing failure → error response
 */
require('dotenv').config();
const express = require("express");
const crypto  = require("crypto");
const multer  = require("multer");

const { processInput }                              = require("./services/coreEngine");
const { generateNextQuestion, applyUserAnswer,
        detectCategory, extractCategoryData }       = require("./services/questionEngine");
const { calculatePrice, getImprovementSuggestions } = require("./services/pricingEngine");
const { analyzeImage }                              = require("./services/imageAnalysis");
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
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
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
 */
async function safeInsertAnalysis(result, context) {
  try {
    const id = await db.insertAnalysis(result);
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
 * If complete → run safePricing and return final result.
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

  const { pricing, improvement } = safePricing({ data: processed.data, category, categoryData });

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
    },
  };
}

// ─── POST /analyze ───────────────────────────────────────────────────────────

app.post(
  "/analyze",
  upload.single("image"),
  sanitizeAnalyzeInput,
  async (req, res) => {
    pruneExpiredSessions(sessions);
    const startedAt = Date.now();

    try {
      const description = req.body.description || "";

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

      logEvent("ANALYZE_START", {
        details: {
          hasImage:       !!imageAnalysis,
          hasDescription: !!description,
          hasUserInputs,
        },
      });

      const state = {
        imageAnalysis: imageAnalysis || null,
        description:   description || "",
        userInputs:    userInputs || {},
      };

      let resolution;
      try {
        resolution = resolveState(state);
      } catch (err) {
        return errorResponse(res, "PRICING_ERROR");
      }

      if (resolution.done) {
        safeInsertAnalysis(resolution.result, "POST /analyze");
        logEvent("COMPLETION", { details: { source: "analyze_direct", durationMs: Date.now() - startedAt } });
        return res.json(resolution.result);
      }

      const sessionId = createSessionId();
      sessions[sessionId] = { state, questionsAsked: [], createdAt: Date.now() };

      logEvent("ANALYZE_START", {
        sessionId,
        details: { event: "session_created", firstQuestion: resolution.question.type },
      });

      return res.json({
        status: "NEEDS_INPUT",
        sessionId,
        question: {
          type:     resolution.question.type,
          question: resolution.question.question,
          category: resolution.question.category,
        },
      });
    } catch (err) {
      logEvent("ERROR", { error: err, details: { route: "POST /analyze" } });
      return errorResponse(res, "INTERNAL_ERROR");
    }
  }
);

// ─── POST /answer ────────────────────────────────────────────────────────────

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

      logEvent("ANSWER_STEP", {
        sessionId,
        details: {
          answerType:       answer.type,
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

        safeInsertAnalysis(resolution.result, "POST /answer");

        logEvent("COMPLETION", {
          sessionId,
          details: {
            totalAnswers: resolution.result.questionsAsked.length,
            category:     resolution.result.category,
          },
        });

        return res.json(resolution.result);
      }

      return res.json({
        status: "NEEDS_INPUT",
        sessionId,
        question: {
          type:     resolution.question.type,
          question: resolution.question.question,
          category: resolution.question.category,
        },
        answeredSoFar: session.questionsAsked.length,
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

app.get("/history", async (_req, res) => {
  try {
    const analyses = await db.fetchAnalyses();
    return res.json({ analyses });
  } catch (err) {
    logEvent("DB_ERROR", { error: err, details: { route: "GET /history" } });
    return errorResponse(res, "DB_ERROR");
  }
});

// ─── POST /feedback ───────────────────────────────────────────────────────────

app.post("/feedback", async (req, res) => {
  try {
    const { analysis_id, is_accurate, note } = req.body;

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
      feedbackId = await db.insertFeedback({ analysis_id, is_accurate, note });
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
  console.log(`\n   POST /analyze        — Start analysis`);
  console.log(`   POST /answer         — Answer a question`);
  console.log(`   GET  /session/:id    — Check session`);
  console.log(`   GET  /history        — Previous analyses`);
  console.log(`   POST /feedback       — Submit accuracy feedback`);
  console.log(`   GET  /health         — Health check\n`);
  console.log(`   🛡  Protection layer active:`);
  console.log(`       • Session TTL    : 10 minutes`);
  console.log(`       • Rate limit     : 10 req/min per IP`);
  console.log(`       • Sanitization   : strings trimmed + script-stripped`);
  console.log(`   📋  Stability layer active:`);
  console.log(`       • Structured logging via logEvent()`);
  console.log(`       • Standardized errors via errorResponse()`);
  console.log(`       • Safe fallbacks: AI / DB / pricing\n`);
});

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { app, server, sessions };