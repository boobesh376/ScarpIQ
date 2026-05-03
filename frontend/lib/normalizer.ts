/**
 * ScrapIQ Answer Normalizer
 * ==========================
 * Central normalization layer between UI (human-readable) and backend (strict enums).
 *
 * PRINCIPLE: Safe, scalable, case-insensitive normalization.
 * Returns original value if no mapping found (fail-safe).
 */

// ─── Normalization Maps ─────────────────────────────────────────────────────

/**
 * Maps human-readable subtype values → canonical backend enums.
 *
 * Supports multiple phrasings of the same concept:
 *   "hard plastic" / "hard" → "hard"
 *   "soft plastic" / "soft" → "soft"
 *   "bare copper" / "bare" → "bare"
 *   "insulated wire" / "insulated" → "insulated"
 *   "mixed metal" / "mixed" → "mixed"
 *   "heavy iron" / "heavy" → "heavy"
 *   "light iron" / "light" → "light"
 */
const SUBTYPE_MAP: Record<string, string> = {
  // Plastic subtypes
  "hard plastic": "hard",
  "hard": "hard",
  "soft plastic": "soft",
  "soft": "soft",

  // Copper subtypes
  "bare copper": "bare",
  "bare": "bare",
  "insulated wire": "insulated",
  "insulated": "insulated",
  "mixed metal": "mixed",
  "mixed": "mixed",

  // Iron subtypes
  "heavy iron": "heavy",
  "heavy": "heavy",
  "light iron": "light",
  "light": "light",
};

/**
 * Maps human-readable cleanliness values → canonical backend enums.
 *
 * Supports:
 *   "clean" → "clean"
 *   "dirty" / "contaminated" / "grimy" / "rusty" → "dirty"
 */
const CLEANLINESS_MAP: Record<string, string> = {
  "clean": "clean",
  "dirty": "dirty",
  "contaminated": "dirty",
  "grimy": "dirty",
  "rusty": "dirty",
  "soiled": "dirty",
};

/**
 * Maps human-readable condition values → canonical backend enums.
 *
 * Supports:
 *   "used" → "worn"
 *   "working" / "functional" → "good"
 *   "like new" / "new" → "excellent"
 *   (Plus passthrough of canonical values)
 */
const CONDITION_MAP: Record<string, string> = {
  // Aliases
  "used": "worn",
  "working": "good",
  "functional": "good",
  "like new": "excellent",
  "new": "excellent",
  "pristine": "excellent",

  // Canonical values (passthrough)
  "excellent": "excellent",
  "good": "good",
  "worn": "worn",
  "damaged": "damaged",
  "heavily damaged": "heavily_damaged",
  "heavily_damaged": "heavily_damaged",
};

// ─── Main Normalizer ────────────────────────────────────────────────────────

/**
 * Normalize a user-provided answer value to a backend-compatible canonical enum.
 *
 * Rules:
 *   • Case-insensitive
 *   • Trims whitespace before and after
 *   • Returns original value if no mapping found (fail-safe)
 *   • Safe to call with non-string values (returns as-is)
 *
 * @param {string} type - Field type: "subtype" | "cleanliness" | "condition" (or any other)
 * @param {string | number} value - The value to normalize
 * @returns {string | number} Normalized canonical value, or original if unmapped
 */
export function normalizeAnswer(type: string, value: string | number): string | number {
  // Non-string values pass through unchanged (e.g., numeric weight)
  if (typeof value !== "string") {
    return value;
  }

  // Normalize: lowercase, trim whitespace
  const normalized = value.toLowerCase().trim();

  // Route to appropriate map based on field type
  let map: Record<string, string> | undefined;

  if (type === "subtype") {
    map = SUBTYPE_MAP;
  } else if (type === "cleanliness") {
    map = CLEANLINESS_MAP;
  } else if (type === "condition") {
    map = CONDITION_MAP;
  }

  // If we have a map and found a match, return the canonical value
  if (map && normalized in map) {
    return map[normalized];
  }

  // No mapping found — return original value (fail-safe)
  return value;
}

/**
 * Batch normalize multiple answer pairs.
 *
 * Useful for normalizing an entire answers object at once.
 *
 * @param {Object} answers - Object with keys as field types and values as user answers
 * @returns {Object} New object with all values normalized
 *
 * Example:
 *   const answers = { subtype: "soft plastic", cleanliness: "dirty" };
 *   const normalized = normalizeAnswers(answers);
 *   // { subtype: "soft", cleanliness: "dirty" }
 */
export function normalizeAnswers(
  answers: Record<string, string | number>
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(answers)) {
    result[key] = normalizeAnswer(key, value);
  }

  return result;
}

/**
 * Export the normalization maps for testing and transparency.
 */
export const NORMALIZATION_MAPS = {
  subtype: SUBTYPE_MAP,
  cleanliness: CLEANLINESS_MAP,
  condition: CONDITION_MAP,
};
