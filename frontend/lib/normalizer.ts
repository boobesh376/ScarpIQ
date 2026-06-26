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
 * IMPORTANT: "mixed" is intentionally NOT mapped to "mixed_metals" here.
 * - For aluminum: the valid subtype is "mixed" (SUBTYPE_FACTORS["aluminum"]["mixed"] = 0.85)
 * - For brass:    the valid subtype is "mixed" (SUBTYPE_FACTORS["brass"]["mixed"] = 0.8)
 * - For copper:   the valid subtype is "mixed" (SUBTYPE_FACTORS["copper"]["mixed"] = 0.8)
 * - For the "mixed" MATERIAL (unknown category), the UI offers "mixed_metals" and
 *   "mixed_general" buttons directly, so no remapping of "mixed" is needed.
 *
 * Previously: "mixed": "mixed_metals" — this caused Pricing calculation failed for
 * aluminum and brass because "mixed_metals" is not in their SUBTYPE_FACTORS tables.
 */
const SUBTYPE_MAP: Record<string, string> = {
  // Plastic subtypes
  "hard plastic": "hard",
  "hard": "hard",
  "soft plastic": "soft",
  "soft": "soft",

  // Copper subtypes
  "bare copper": "bare",
  "bare_copper": "bare",
  "bare": "bare",
  "insulated wire": "insulated",
  "insulated_wire": "insulated",
  "insulated": "insulated",
  // "mixed" copper passes through as-is — valid in SUBTYPE_FACTORS["copper"]

  // Aluminum subtypes
  "pure aluminum": "pure",
  "pure_aluminum": "pure",
  "pure": "pure",
  "mixed aluminum": "mixed",
  "mixed_aluminum": "mixed",
  "aluminum cans": "cans",
  "aluminum_cans": "cans",
  "cans": "cans",
  // "mixed" aluminum passes through as-is — valid in SUBTYPE_FACTORS["aluminum"]

  // Iron subtypes
  "heavy iron": "heavy",
  "heavy_iron": "heavy",
  "heavy": "heavy",
  "light iron": "light",
  "light_iron": "light",
  "light": "light",
  "cast iron": "cast",
  "cast_iron": "cast",
  "cast": "cast",

  // Brass subtypes
  "pure brass": "pure",
  "pure_brass": "pure",
  "mixed brass": "mixed",
  "mixed_brass": "mixed",
  // "mixed" brass passes through as-is — valid in SUBTYPE_FACTORS["brass"]

  // Steel subtypes
  "stainless steel": "stainless",
  "stainless_steel": "stainless",
  "stainless": "stainless",
  "mild steel": "mild",
  "mild_steel": "mild",
  "mild": "mild",

  // Mixed/Unknown material subtypes (used when material itself is "mixed")
  "mixed metal": "mixed_metals",
  "mixed metals": "mixed_metals",
  "mixed_metal": "mixed_metals",
  "mixed_metals": "mixed_metals",     // passthrough
  "mixed general": "mixed_general",
  "mixed_general": "mixed_general",   // passthrough
  // NOTE: bare "mixed" is intentionally omitted here. For the mixed-material
  // subtype question, PostDetectionFlow offers "mixed_metals" / "mixed_general"
  // buttons directly (not "mixed"), so this catch-all is unnecessary and harmful.
};


/**
 * Maps human-readable cleanliness values → canonical backend enums.
 *
 * Supports:
 *   "clean" → "clean"
 *   "dirty" / "contaminated" / "grimy" / "rusty" → "dirty"
 *   "not_sure" / "not sure" → "dirty" (conservative — when unsure, assume dirty)
 */
const CLEANLINESS_MAP: Record<string, string> = {
  "clean": "clean",
  "dirty": "dirty",
  "contaminated": "dirty",
  "grimy": "dirty",
  "rusty": "dirty",
  "soiled": "dirty",
  // Uncertainty → conservative default
  "not_sure": "dirty",
  "not sure": "dirty",
  "unsure": "dirty",
  "unknown": "dirty",
};

/**
 * Maps human-readable condition values → canonical backend enums.
 *
 * Supports:
 *   "used" → "worn"
 *   "working" / "functional" → "good"
 *   "like new" / "new" → "excellent"
 *   "not_sure" / "not sure" → "worn" (conservative fallback — user unsure about condition)
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

  // Uncertainty → conservative default
  "not_sure": "worn",
  "not sure": "worn",
  "unsure": "worn",
  "unknown": "worn",

  // Canonical values (passthrough)
  "excellent": "excellent",
  "good": "good",
  "worn": "worn",
  "damaged": "damaged",
  "heavily damaged": "heavily_damaged",
  "heavily_damaged": "heavily_damaged",
};

/**
 * Maps human-readable rust severity values → canonical backend enums.
 *
 * Supports:
 *   "minimal" / "light" / "surface" → "minimal_rust"
 *   "moderate" / "some" / "medium" → "moderate_rust"
 *   "severe" / "heavy" / "extensive" → "severe_rust"
 */
const RUST_SEVERITY_MAP: Record<string, string> = {
  // Minimal rust
  "minimal rust": "minimal_rust",
  "minimal": "minimal_rust",
  "light": "minimal_rust",
  "light rust": "minimal_rust",
  "surface rust": "minimal_rust",
  "surface": "minimal_rust",

  // Moderate rust
  "moderate rust": "moderate_rust",
  "moderate": "moderate_rust",
  "some": "moderate_rust",
  "some rust": "moderate_rust",
  "medium": "moderate_rust",
  "medium rust": "moderate_rust",

  // Severe rust
  "severe rust": "severe_rust",
  "severe": "severe_rust",
  "heavy": "severe_rust",
  "heavy rust": "severe_rust",
  "extensive": "severe_rust",
  "extensive rust": "severe_rust",

  // Canonical values (passthrough)
  "minimal_rust": "minimal_rust",
  "moderate_rust": "moderate_rust",
  "severe_rust": "severe_rust",
};

/**
 * Maps human-readable material values → canonical backend enums.
 *
 * Supports standard materials and handles "not_sure" → "mixed" (a catch-all category).
 */
const MATERIAL_MAP: Record<string, string> = {
  // Standard materials (passthrough)
  "copper": "copper",
  "iron": "iron",
  "aluminum": "aluminum",
  "steel": "steel",
  "brass": "brass",
  "plastic": "plastic",
  "mixed": "mixed",
  
  // Uncertainty → mixed category (catch-all for unknown materials)
  "not_sure": "mixed",
  "not sure": "mixed",
  "unsure": "mixed",
  "unknown": "mixed",
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
 * @param {string} type - Field type: "subtype" | "cleanliness" | "condition" | "rustSeverity" | "material" (or any other)
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
  } else if (type === "rustSeverity") {
    map = RUST_SEVERITY_MAP;
  } else if (type === "material") {
    map = MATERIAL_MAP;
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
  rustSeverity: RUST_SEVERITY_MAP,
};
