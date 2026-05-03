"use strict";

/**
 * ScrapIQ Core Protection Layer
 */

// ─── ENV MODE ─────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV !== "production";

// ─── 1. SESSION EXPIRY ───────────────────────────────────

// DEV: 1 hour
// PROD: 10 minutes
const SESSION_TTL_MS = IS_DEV
  ? 60 * 60 * 1000
  : 10 * 60 * 1000;

function isSessionExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL_MS;
}

function pruneExpiredSessions(sessions) {
  const now = Date.now();
  for (const id of Object.keys(sessions)) {
    if (now - sessions[id].createdAt > SESSION_TTL_MS) {
      delete sessions[id];
    }
  }
}

function startSessionCleanupInterval(sessions) {
  return setInterval(() => pruneExpiredSessions(sessions), 5 * 60 * 1000);
}

function sessionExpiryMiddleware(sessions) {
  return (req, res, next) => {
    const sessionId = req.body && req.body.sessionId;
    if (!sessionId) return next();

    const session = sessions[sessionId];
    if (!session) return next();

    if (isSessionExpired(session)) {
      delete sessions[sessionId];
      return res.status(410).json({
        error: "SESSION_EXPIRED",
        message: "Session expired. Start again.",
      });
    }

    req.session = session;
    next();
  };
}

// ─── 2. RATE LIMITING ───────────────────────────────────

// DEV: 1000 req/min
// PROD: 10 req/min
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = IS_DEV ? 1000 : 10;

const _rateLimitStore = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection.remoteAddress || "unknown";
}

function rateLimitMiddleware(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let timestamps = _rateLimitStore.get(ip) || [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests",
    });
  }

  timestamps.push(now);
  _rateLimitStore.set(ip, timestamps);

  if (Math.random() < 0.01) {
    for (const [key, ts] of _rateLimitStore.entries()) {
      if (ts.every((t) => t <= windowStart)) {
        _rateLimitStore.delete(key);
      }
    }
  }

  next();
}

// ─── 3. INPUT SANITIZATION ───────────────────────────────

function stripDangerousChars(str) {
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]*/gi, "");
}

function sanitizeString(value) {
  if (typeof value !== "string") return value;
  return stripDangerousChars(value.trim());
}

function sanitizeDeep(input) {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return sanitizeString(input);
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (Array.isArray(input)) return input.map(sanitizeDeep);
  if (typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = sanitizeDeep(v);
    }
    return out;
  }
  return input;
}

function isPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function isValidNumber(value) {
  return Number.isFinite(Number(value));
}

function sanitizeAnalyzeInput(req, res, next) {
  try {
    if (req.body.description !== undefined) {
      req.body.description = sanitizeString(String(req.body.description));
    }

    if (req.body.userInputs !== undefined && req.body.userInputs !== null) {
      if (typeof req.body.userInputs !== "object" || Array.isArray(req.body.userInputs)) {
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Invalid input",
        });
      }

      req.body.userInputs = sanitizeDeep(req.body.userInputs);

      const { weight } = req.body.userInputs;
      if (weight !== undefined && !isPositiveNumber(weight)) {
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Invalid weight",
        });
      }
    }

    next();
  } catch {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "Invalid input",
    });
  }
}

function sanitizeAnswerInput(req, res, next) {
  try {
    const { sessionId, answer } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Invalid session",
      });
    }

    if (!answer || typeof answer !== "object") {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Invalid answer",
      });
    }

    if (typeof answer.value === "string") {
      req.body.answer.value = sanitizeString(answer.value);
    }

    next();
  } catch {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "Invalid input",
    });
  }
}

module.exports = {
  SESSION_TTL_MS,
  isSessionExpired,
  pruneExpiredSessions,
  startSessionCleanupInterval,
  sessionExpiryMiddleware,
  rateLimitMiddleware,
  getClientIp,
  sanitizeString,
  sanitizeDeep,
  stripDangerousChars,
  isPositiveNumber,
  isValidNumber,
  sanitizeAnalyzeInput,
  sanitizeAnswerInput,
};