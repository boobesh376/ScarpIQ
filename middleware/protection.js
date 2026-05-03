"use strict";

/**
 * ScrapIQ Core Protection Layer
 * ==============================
 * 1. Session Expiry   — TTL = 10 minutes, lazy cleanup + interval sweep
 * 2. Rate Limiting    — 10 requests / minute per IP (in-memory)
 * 3. Input Sanitization — trim, strip dangerous chars, validate numerics
 */

// ─── 1. SESSION EXPIRY ───────────────────────────────────────────────────────

const SESSION_TTL_MS = 10 * 1000; // 10 minutes

/**
 * Check whether a session has expired.
 * @param {object} session  Session object containing `createdAt` timestamp.
 * @returns {boolean}
 */
function isSessionExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL_MS;
}

/**
 * Lazy cleanup: remove all expired sessions from the store.
 * Call this at the top of every request handler.
 * @param {object} sessions  The shared sessions map.
 */
function pruneExpiredSessions(sessions) {
  const now = Date.now();
  for (const id of Object.keys(sessions)) {
    if (now - sessions[id].createdAt > SESSION_TTL_MS) {
      delete sessions[id];
    }
  }
}

/**
 * Start a background interval that sweeps expired sessions every 5 minutes.
 * @param {object} sessions  The shared sessions map.
 * @returns {NodeJS.Timeout}  The interval handle (call clearInterval to stop).
 */
function startSessionCleanupInterval(sessions) {
  return setInterval(() => pruneExpiredSessions(sessions), 5 * 60 * 1000);
}

/**
 * Express middleware: guard a route that requires a live session.
 * Reads `sessionId` from `req.body` and rejects if expired or missing.
 * Attaches `req.session` on success.
 * @param {object} sessions  The shared sessions map.
 */
function sessionExpiryMiddleware(sessions) {
  return (req, res, next) => {
    const sessionId = req.body && req.body.sessionId;
    if (!sessionId) return next(); // Let route handler emit its own "missing sessionId" error

    const session = sessions[sessionId];
    if (!session) return next(); // Let route handler emit "not found"

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

// ─── 2. RATE LIMITING ────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10;              // max requests per window

/** @type {Map<string, number[]>} IP → array of request timestamps */
const _rateLimitStore = new Map();

/**
 * Derive the best available client IP from an Express request.
 * Handles proxies (X-Forwarded-For) gracefully.
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection.remoteAddress || "unknown";
}

/**
 * Express middleware: reject requests that exceed RATE_LIMIT_MAX per minute.
 */
function rateLimitMiddleware(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Retrieve or initialise timestamp list for this IP
  let timestamps = _rateLimitStore.get(ip) || [];

  // Discard timestamps outside the current window
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests",
    });
  }

  timestamps.push(now);
  _rateLimitStore.set(ip, timestamps);

  // Periodic cleanup of stale IP entries (cheap — runs ~1% of requests)
  if (Math.random() < 0.01) {
    for (const [key, ts] of _rateLimitStore.entries()) {
      if (ts.every((t) => t <= windowStart)) {
        _rateLimitStore.delete(key);
      }
    }
  }

  next();
}

// ─── 3. INPUT SANITIZATION ───────────────────────────────────────────────────

/**
 * Remove script tags and common injection patterns from a string.
 * Strips: <script>…</script>, javascript: URIs, HTML event attributes (on*=).
 * @param {string} str
 * @returns {string}
 */
function stripDangerousChars(str) {
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]*/gi, "");
}

/**
 * Sanitize a single string value: trim + strip dangerous patterns.
 * @param {string} value
 * @returns {string}
 */
function sanitizeString(value) {
  if (typeof value !== "string") return value;
  return stripDangerousChars(value.trim());
}

/**
 * Recursively sanitize all string leaves in an object or array.
 * Non-string primitives (numbers, booleans, null) are passed through unchanged.
 * @param {*} input
 * @returns {*}
 */
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

/**
 * Validate that a value is a finite number greater than zero.
 * @param {*} value
 * @returns {boolean}
 */
function isPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

/**
 * Validate that a value is a finite number (zero and negatives allowed).
 * @param {*} value
 * @returns {boolean}
 */
function isValidNumber(value) {
  return Number.isFinite(Number(value));
}

/**
 * Validate and sanitize the body of POST /analyze.
 * Mutates req.body in-place with sanitized values.
 * Returns an error response object or null if valid.
 *
 * Rules:
 *  - description: optional, but if provided must not be empty after trim
 *  - userInputs: optional object; all string values sanitized
 *  - weight (if present in userInputs): must be > 0
 *  - Any numeric field in userInputs must be a valid finite number
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {Function} next
 */
function sanitizeAnalyzeInput(req, res, next) {
  try {
    // description
    if (req.body.description !== undefined) {
      req.body.description = sanitizeString(String(req.body.description));
    }

    // userInputs
    if (req.body.userInputs !== undefined && req.body.userInputs !== null) {
      if (typeof req.body.userInputs !== "object" || Array.isArray(req.body.userInputs)) {
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Invalid or unsafe input",
        });
      }
      req.body.userInputs = sanitizeDeep(req.body.userInputs);

      // weight must be > 0
      const { weight } = req.body.userInputs;
      if (weight !== undefined && weight !== null && weight !== "") {
        if (!isPositiveNumber(weight)) {
          return res.status(400).json({
            error: "INVALID_INPUT",
            message: "Invalid or unsafe input",
          });
        }
      }

      // All explicitly numeric fields must be valid numbers
      const numericFields = ["year", "mileage", "price", "pages", "runtime", "quantity"];
      for (const field of numericFields) {
        const val = req.body.userInputs[field];
        if (val !== undefined && val !== null && val !== "") {
          if (!isValidNumber(val)) {
            return res.status(400).json({
              error: "INVALID_INPUT",
              message: "Invalid or unsafe input",
            });
          }
        }
      }
    }

    // imageAnalysis — sanitize string fields if it's an object
    if (req.body.imageAnalysis && typeof req.body.imageAnalysis === "object") {
      req.body.imageAnalysis = sanitizeDeep(req.body.imageAnalysis);
    }

    next();
  } catch {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "Invalid or unsafe input",
    });
  }
}

/**
 * Validate and sanitize the body of POST /answer.
 *
 * Rules:
 *  - sessionId: required, non-empty string
 *  - answer: required object with non-empty `type` string
 *  - answer.value: must not be null/undefined; strings are sanitized
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {Function} next
 */
function sanitizeAnswerInput(req, res, next) {
  try {
    const { sessionId, answer } = req.body;

    // sessionId
    if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Invalid or unsafe input",
      });
    }
    req.body.sessionId = sessionId.trim();

    // answer object
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Invalid or unsafe input",
      });
    }

    // answer.type
    if (!answer.type || typeof answer.type !== "string" || answer.type.trim() === "") {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Invalid or unsafe input",
      });
    }
    req.body.answer.type = sanitizeString(answer.type);

    // answer.value — must exist; sanitize if string
    if (answer.value === null || answer.value === undefined) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Invalid or unsafe input",
      });
    }
    if (typeof answer.value === "string") {
      req.body.answer.value = sanitizeString(answer.value);
    }

    // weight-specific guard
    if (answer.type === "weight" || answer.type === "WEIGHT") {
      if (!isPositiveNumber(answer.value)) {
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Invalid or unsafe input",
        });
      }
    }

    next();
  } catch {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "Invalid or unsafe input",
    });
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Session expiry
  SESSION_TTL_MS,
  isSessionExpired,
  pruneExpiredSessions,
  startSessionCleanupInterval,
  sessionExpiryMiddleware,

  // Rate limiting
  rateLimitMiddleware,
  getClientIp,

  // Input sanitization
  sanitizeString,
  sanitizeDeep,
  stripDangerousChars,
  isPositiveNumber,
  isValidNumber,
  sanitizeAnalyzeInput,
  sanitizeAnswerInput,
};