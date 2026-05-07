"use strict";

/**
 * ScrapIQ Centralized Logger & Error Utilities
 * =============================================
 * Provides:
 *   logEvent(type, data)  — structured console logging
 *   AppError              — typed error class
 *   ERROR_CODES           — canonical error code registry
 *   errorResponse(res, code, message, status) — standardized HTTP error sender
 */

// ─── Error Code Registry ─────────────────────────────────────────────────────

const ERROR_CODES = Object.freeze({
  INVALID_INPUT:        { status: 400, message: "Invalid or unsafe input" },
  SESSION_NOT_FOUND:    { status: 404, message: "Session not found or expired" },
  SESSION_EXPIRED:      { status: 410, message: "Session expired. Start again." },
  RATE_LIMIT_EXCEEDED:  { status: 429, message: "Too many requests" },
  PRICING_ERROR:        { status: 500, message: "Pricing calculation failed" },
  DB_ERROR:             { status: 500, message: "Database operation failed" },
  INTERNAL_ERROR:       { status: 500, message: "An internal error occurred" },
});

// ─── AppError ─────────────────────────────────────────────────────────────────

class AppError extends Error {
  /**
   * @param {keyof typeof ERROR_CODES} code
   * @param {string} [detail]  Extra detail appended to the default message (not sent to client).
   */
  constructor(code, detail) {
    const entry = ERROR_CODES[code];
    super(detail || (entry ? entry.message : code));
    this.name = "AppError";
    this.code = code;
    this.status = entry ? entry.status : 500;
  }
}

// ─── logEvent ─────────────────────────────────────────────────────────────────

/**
 * Emit a structured log line to stdout/stderr.
 *
 * @param {"ANALYZE_START"|"ANSWER_STEP"|"COMPLETION"|"ERROR"|"DB_ERROR"|"PRICING_ERROR"|"AI_ERROR"|"SESSION_EXPIRED"|"RATE_LIMIT_HIT"|"AUTH_SUCCESS"|"AUTH_FAILED"|string} type
 * @param {{
 *   sessionId?: string,
 *   userId?: string,
 *   ip?: string,
 *   route?: string,
 *   details?: *,
 *   error?: Error|string,
 * }} data
 */
function logEvent(type, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    sessionId: data.sessionId || null,
    userId: data.userId || null,
    route: data.route || null,
    details: data.details || null,
  };

  if (data.ip)      entry.ip      = data.ip;
  if (data.error)   entry.error   = data.error instanceof Error
                                      ? { message: data.error.message, stack: data.error.stack }
                                      : String(data.error);

  const isError = type === "ERROR" || type.endsWith("_ERROR");
  const line = JSON.stringify(entry);

  if (isError) {
    console.error(line);
  } else {
    console.log(line);
  }
}

// ─── errorResponse ────────────────────────────────────────────────────────────

/**
 * Send a standardized error JSON response.
 *
 * @param {import('express').Response} res
 * @param {keyof typeof ERROR_CODES | string} code   One of the ERROR_CODES keys.
 * @param {string}  [messageOverride]                 Human-readable override.
 * @param {number}  [statusOverride]                  HTTP status override.
 */
function errorResponse(res, code, messageOverride, statusOverride) {
  const entry = ERROR_CODES[code];
  const status  = statusOverride  ?? (entry ? entry.status  : 500);
  const message = messageOverride ?? (entry ? entry.message : "An internal error occurred");

  return res.status(status).json({ error: code, message });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { logEvent, AppError, ERROR_CODES, errorResponse };