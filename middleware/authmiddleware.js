"use strict";

/**
 * ScrapIQ Auth Middleware
 * =======================
 * Verifies Supabase JWT tokens from the Authorization header.
 * Replaces the insecure x-user-id header approach.
 */

const { createClient } = require("@supabase/supabase-js");
const { logEvent } = require("../utils/logger");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_KEY must be set in environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Extract the raw Bearer token from the Authorization header.
 * Returns null if absent or malformed.
 * @param {import("express").Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  const token = parts[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Verify a Supabase JWT and return the decoded user.
 * Returns null on any failure (expired, invalid signature, etc.).
 * @param {string} token
 * @returns {Promise<import("@supabase/supabase-js").User|null>}
 */
async function verifyToken(token) {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * requireAuth — hard auth guard.
 * Rejects with 401 if token is missing or invalid.
 * On success, sets req.user to the verified Supabase user object.
 *
 * Usage: app.get("/history", requireAuth, handler)
 *
 * @type {import("express").RequestHandler}
 */
async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  const route = `${req.method} ${req.path}`;

  if (!token) {
    logEvent("AUTH_FAILED", {
      route,
      details: { reason: "missing_token" },
    });
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Authorization header with Bearer token is required",
    });
  }

  const user = await verifyToken(token);

  if (!user) {
    logEvent("AUTH_FAILED", {
      route,
      userId: null,
      details: { reason: "invalid_or_expired_token" },
    });
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid or expired token",
    });
  }

  logEvent("AUTH_SUCCESS", {
    route,
    userId: user.id,
  });

  // Attach verified user — downstream handlers read req.user.id
  req.user = user;
  next();
}

/**
 * optionalAuth — soft auth.
 * If a valid Bearer token is present, sets req.user.
 * If absent or invalid, sets req.user = null and continues.
 * Never rejects — use for public routes that benefit from user context.
 *
 * Usage: app.post("/analyze", optionalAuth, handler)
 *
 * @type {import("express").RequestHandler}
 */
async function optionalAuth(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  const user = await verifyToken(token);
  if (user) {
    logEvent("AUTH_SUCCESS", {
      route: `${req.method} ${req.path}`,
      userId: user.id,
      details: { authType: "optional" },
    });
  }
  req.user = user ?? null;
  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  extractBearerToken,
  verifyToken,
};