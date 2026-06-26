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
 *
 * Auth:
 *   Both tables have an optional user_id (uuid) column.
 *   When user_id is provided it is written to the row.
 *   fetchAnalyses filters by user_id when one is supplied.
 *
 * Required SQL (run once in Supabase SQL editor):
 *   ALTER TABLE analyses ADD COLUMN IF NOT EXISTS user_id uuid;
 *   ALTER TABLE feedback ADD COLUMN IF NOT EXISTS user_id uuid;
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
 * @param {Object} result   - The COMPLETE result object from resolveState().
 * @param {string|null} userId - Supabase user UUID (optional).
 * @returns {Promise<string|null>}  The inserted row's UUID, or null on failure.
 */
async function insertAnalysis(result, userId) {
  const client = getClient();
  if (!client) return null;

  try {
    const row = {
      material:         result.data?.material        ?? null,
      weight:           result.data?.weight          ?? null,
      condition:        result.data?.condition       ?? null,
      category:         result.category              ?? null,
      subtype:          result.categoryData?.subtype ?? null,
      cleanliness:      result.categoryData?.cleanliness ?? null,
      final_price:      result.pricing?.finalPrice   ?? null,
      confidence_level: result.confidenceLevel       ?? null,
      summary:          result.pricing?.richExplanation?.summary ?? null,
      user_id:          userId ?? null,
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
 * Fetch analyses, sorted by created_at DESC.
 * When userId is provided, only returns rows belonging to that user.
 * When userId is null/undefined, returns ALL analyses (backward compat).
 *
 * @param {string|null} userId - Filter by Supabase user UUID (optional).
 * @returns {Promise<Array>}  Array of analysis rows (may be empty).
 */
async function fetchAnalyses(userId) {
  const client = getClient();
  if (!client) return [];

  try {
    let query = client
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

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
 * @param {string}       payload.analysis_id  - UUID of the analysis being rated.
 * @param {boolean}      payload.is_accurate  - Whether the price was accurate.
 * @param {string}       [payload.note]       - Optional free-text note.
 * @param {string|null}  [payload.user_id]    - Supabase user UUID (optional).
 * @returns {Promise<string|null>}  The inserted row's UUID, or null on failure.
 */
async function insertFeedback({ analysis_id, is_accurate, note, user_id }) {
  const client = getClient();
  if (!client) return null;

  try {
    const row = {
      analysis_id: analysis_id ?? null,
      is_accurate: Boolean(is_accurate),
      note:        note ?? null,
      user_id:     user_id ?? null,
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

// ─── deleteAnalysis ───────────────────────────────────────────────────────────

/**
 * Soft-delete an analysis row by ID.
 * Only deletes if the row belongs to the given userId (ownership check).
 *
 * @param {string} analysisId - UUID of the analysis to delete.
 * @param {string} userId     - Supabase user UUID (ownership guard).
 * @returns {Promise<boolean>} true on success, false if not found/not owned.
 */
async function deleteAnalysis(analysisId, userId) {
  const client = getClient();
  if (!client) return false;

  try {
    const { error, count } = await client
      .from("analyses")
      .delete({ count: "exact" })
      .eq("id", analysisId)
      .eq("user_id", userId);

    if (error) {
      console.error("[db] deleteAnalysis error:", error.message);
      return false;
    }

    return (count ?? 0) > 0;
  } catch (err) {
    console.error("[db] deleteAnalysis threw:", err.message);
    return false;
  }
}

// ─── togglePinAnalysis ────────────────────────────────────────────────────────

/**
 * Toggle the is_pinned flag on an analysis row.
 * Requires: ALTER TABLE analyses ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
 *
 * @param {string}  analysisId - UUID of the analysis.
 * @param {string}  userId     - Supabase user UUID (ownership guard).
 * @param {boolean} isPinned   - Desired pin state.
 * @returns {Promise<boolean>} true on success.
 */
async function togglePinAnalysis(analysisId, userId, isPinned) {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from("analyses")
      .update({ is_pinned: Boolean(isPinned) })
      .eq("id", analysisId)
      .eq("user_id", userId);

    if (error) {
      console.error("[db] togglePinAnalysis error:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[db] togglePinAnalysis threw:", err.message);
    return false;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  insertAnalysis,
  fetchAnalyses,
  insertFeedback,
  deleteAnalysis,
  togglePinAnalysis,
};