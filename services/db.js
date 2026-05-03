/**
 * ScrapIQ — Supabase Database Service
 * =====================================
 * Wraps all Supabase interactions with safe fallbacks.
 * If SUPABASE_URL / SUPABASE_KEY are not set, all operations
 * silently no-op and log a warning — the API continues working.
 *
 * Tables used:
 *   analyses  — one row per completed pricing session
 *   feedback  — user accuracy feedback per analysis
 */

"use strict";

// ─── Supabase client (lazy init) ─────────────────────────────────────────────

let _supabase = null;
let _initAttempted = false;

/**
 * Returns a ready Supabase client, or null if env vars are missing.
 * Initialization is attempted once; subsequent calls reuse the result.
 */
function getClient() {
  if (_initAttempted) return _supabase;
  _initAttempted = true;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    console.warn(
      "[db] SUPABASE_URL / SUPABASE_KEY not set — " +
      "database persistence is disabled. Analyses will not be saved."
    );
    return null;
  }

  try {
    // Dynamic require so the module loads even if @supabase/supabase-js is absent
    const { createClient } = require("@supabase/supabase-js");
    _supabase = createClient(url, key);
    console.log("[db] Supabase client initialized.");
  } catch (err) {
    console.error(
      "[db] Failed to initialise Supabase client:",
      err.message,
      "\nInstall with: npm install @supabase/supabase-js"
    );
    _supabase = null;
  }

  return _supabase;
}

// ─── analyses table ──────────────────────────────────────────────────────────

/**
 * Insert a completed analysis into the `analyses` table.
 *
 * @param {Object} result  - The COMPLETE result object from resolveState().
 * @returns {Promise<string|null>}  The inserted row's UUID, or null on failure.
 */
async function insertAnalysis(result) {
  const client = getClient();
  if (!client) return null;

  try {
    const row = {
      material:        result.data?.material        ?? null,
      weight:          result.data?.weight          ?? null,
      condition:       result.data?.condition       ?? null,
      category:        result.category              ?? null,
      subtype:         result.categoryData?.subtype ?? null,
      cleanliness:     result.categoryData?.cleanliness ?? null,
      final_price:     result.pricing?.finalPrice   ?? null,
      confidence_level: result.confidenceLevel      ?? null,
      summary:         result.pricing?.richExplanation?.summary ?? null,
    };

    const { data, error } = await client
      .from("analyses")
      .insert([row])
      .select("id")
      .single();

    if (error) {
      console.error("[db] insertAnalysis error:", error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error("[db] insertAnalysis threw:", err.message);
    return null;
  }
}

/**
 * Fetch all analyses, sorted by created_at DESC.
 *
 * @returns {Promise<Array>}  Array of analysis rows (may be empty).
 */
async function fetchAnalyses() {
  const client = getClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[db] fetchAnalyses error:", error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("[db] fetchAnalyses threw:", err.message);
    return [];
  }
}

// ─── feedback table ───────────────────────────────────────────────────────────

/**
 * Insert a feedback row into the `feedback` table.
 *
 * @param {Object} payload
 * @param {string}  payload.analysis_id  - UUID of the analysis being rated.
 * @param {boolean} payload.is_accurate  - Whether the price was accurate.
 * @param {string}  [payload.note]       - Optional free-text note.
 * @returns {Promise<string|null>}  The inserted row's UUID, or null on failure.
 */
async function insertFeedback({ analysis_id, is_accurate, note }) {
  const client = getClient();
  if (!client) return null;

  try {
    const row = {
      analysis_id: analysis_id ?? null,
      is_accurate: Boolean(is_accurate),
      note:        note ?? null,
    };

    const { data, error } = await client
      .from("feedback")
      .insert([row])
      .select("id")
      .single();

    if (error) {
      console.error("[db] insertFeedback error:", error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error("[db] insertFeedback threw:", err.message);
    return null;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  insertAnalysis,
  fetchAnalyses,
  insertFeedback,
};