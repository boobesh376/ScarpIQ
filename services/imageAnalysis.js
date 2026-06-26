/**
 * ScrapIQ Image Analysis Service
 * ================================
 * Real Gemini Vision AI integration for structured scrap material analysis.
 *
 * Returns a RICH structured result:
 *   { material, category, condition, cleanliness, estimatedWeightKg,
 *     confidence, confidenceScore, reasoning[], source?, error? }
 *
 * Backward-compatible contract:
 *   - `confidence` is always 0-1 (for coreEngine threshold checks)
 *   - `confidenceScore` is 0-100 (for UI display)
 *   - `material` and `condition` remain normalised as before
 *
 * NON-THROWING: analyzeImage NEVER throws. It always returns a valid object.
 * MOCK MODE: Set MOCK_IMAGE=true in .env to bypass Gemini (dev/test only).
 *
 * FALLBACK SAFETY:
 *   - Timeout / quota / API error => returns fallback error object
 *   - Malformed JSON => cleaned and re-parsed; falls back on parse failure
 *   - Empty buffer => returns INVALID_IMAGE error immediately
 *   - No API key => returns NO_API_KEY error immediately
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { mapConfidenceScore, scoreToFloat } = require("./confidenceMapper");

// --- Constants ----------------------------------------------------------------

const USE_MOCK = process.env.MOCK_IMAGE === "true";

const GEMINI_MODEL   = "gemini-2.5-flash";
const TIMEOUT_MS     = 25000; // 25 seconds

const VALID_MATERIALS     = ["copper", "iron", "aluminum", "steel", "plastic", "unknown"];
const VALID_CONDITIONS    = ["good", "used", "damaged", "uncertain"];
const VALID_CATEGORIES    = ["metal", "plastic", "electronics", "unknown"];
const VALID_CLEANLINESSES = ["clean", "moderate", "dirty"];

// --- Gemini Prompt ------------------------------------------------------------

const ANALYSIS_PROMPT = `You are a scrap metal and recycling expert. Analyze this image and identify the scrap material.

Return ONLY a valid JSON object - no preamble, no explanation, no markdown code fences. Just raw JSON.

Required format:
{
  "material": "copper | iron | aluminum | steel | plastic | unknown",
  "category": "metal | plastic | electronics | unknown",
  "condition": "good | used | damaged | uncertain",
  "cleanliness": "clean | moderate | dirty",
  "estimatedWeightKg": <number or null>,
  "confidence": <integer 0 to 100>,
  "reasoning": [
    "<specific visual observation 1>",
    "<specific visual observation 2>",
    "<specific visual observation 3>"
  ]
}

Field rules - follow exactly:
- material: The dominant recyclable material. Use "unknown" if you cannot identify it with reasonable certainty.
- category: "metal" for copper/iron/aluminum/steel. "plastic" for plastic. "electronics" for circuit boards or electronic devices. "unknown" if unclear.
- condition: "good" = clean minimal wear. "used" = visible wear/use marks. "damaged" = rust cracks major deformation. "uncertain" = cannot determine.
- cleanliness: "clean" = no coatings or contamination. "moderate" = some oil light dirt minor contamination. "dirty" = heavy contamination paint mixed materials heavy rust.
- estimatedWeightKg: Use apparent size and material density to estimate. Must be a positive number (e.g. 1.5) or null if impossible to estimate.
- confidence: How certain are you? 90-100 = visually certain. 70-89 = reasonably confident. 50-69 = possible but uncertain. Below 50 = guessing.
- reasoning: 2 to 4 specific visual observations that led to your identification. Be specific. Example: "Reddish-orange metallic sheen consistent with copper".

Critical rules:
- Return ONLY the JSON object. No other text whatsoever.
- Do NOT wrap in markdown code fences.
- Do NOT add comments inside the JSON.
- Use "unknown" and low confidence when genuinely unsure - do not guess.`;

// --- Mock Response ------------------------------------------------------------

const MOCK_RESPONSE = {
  material:          "copper",
  category:          "metal",
  condition:         "used",
  cleanliness:       "moderate",
  estimatedWeightKg: 1.5,
  confidence:        0.9,
  confidenceScore:   90,
  reasoning: [
    "Reddish-orange coloration consistent with copper",
    "Visible wire strand texture",
    "Moderate surface oxidation present",
  ],
  source: "mock",
};

// --- Fallback Response --------------------------------------------------------

function buildErrorResponse(errorCode) {
  return {
    material:          null,
    category:          null,
    condition:         null,
    cleanliness:       null,
    estimatedWeightKg: null,
    confidence:        0,
    confidenceScore:   0,
    reasoning:         [],
    error:             errorCode,
  };
}

// --- Gemini Client ------------------------------------------------------------

function createModel(apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("imageAnalysis: GEMINI_API_KEY is required. Set it in .env");
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}

// --- Response Parsing ---------------------------------------------------------

function stripFences(raw) {
  // Defensive: ensure input is a string
  if (typeof raw !== "string") {
    return "";
  }
  
  let cleaned = raw.trim();
  
  // Remove markdown code fences (```json, ```, etc.)
  if (cleaned.startsWith("```")) {
    // Strip opening fence (supports ```json, ```, etc.)
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").trim();
    // Strip closing fence if present
    cleaned = cleaned.replace(/```\s*$/m, "").trim();
  }
  
  // Safety: truncate at the last closing brace to handle trailing text
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace !== -1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }
  
  return cleaned;
}

function parseGeminiResponse(rawText) {
  // Defensive: ensure input is valid
  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error("imageAnalysis: empty or invalid response from Gemini");
  }

  const cleaned = stripFences(rawText);
  
  // Defensive: ensure cleaned result is not empty
  if (!cleaned || cleaned.trim().length === 0) {
    throw new Error("imageAnalysis: response is empty after stripping fences");
  }
  
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    // Provide more helpful error message for debugging
    const preview = cleaned.slice(0, 150);
    throw new Error("imageAnalysis: invalid JSON from Gemini: " + preview);
  }

  // Defensive: verify parsed result is an object (not array or primitive)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("imageAnalysis: Gemini response is not a JSON object");
  }

  // --- material ---
  let material = typeof parsed.material === "string" && parsed.material.trim().length > 0
    ? parsed.material.toLowerCase().trim()
    : "unknown";
  if (material === "aluminium") material = "aluminum";
  if (!VALID_MATERIALS.includes(material)) material = "unknown";

  // --- category ---
  let category = typeof parsed.category === "string" && parsed.category.trim().length > 0
    ? parsed.category.toLowerCase().trim()
    : "unknown";
  if (!VALID_CATEGORIES.includes(category)) category = "unknown";

  // --- condition ---
  let condition = typeof parsed.condition === "string" && parsed.condition.trim().length > 0
    ? parsed.condition.toLowerCase().trim()
    : "uncertain";
  const conditionAliases = {
    rusted: "damaged", broken: "damaged", corroded: "damaged",
    cracked: "damaged", bent: "damaged", dented: "damaged",
    working: "good", clean: "good", intact: "good",
    new: "good", worn: "used", old: "used",
  };
  condition = conditionAliases[condition] ?? condition;
  if (!VALID_CONDITIONS.includes(condition)) condition = "uncertain";

  // --- cleanliness ---
  let cleanliness = typeof parsed.cleanliness === "string" && parsed.cleanliness.trim().length > 0
    ? parsed.cleanliness.toLowerCase().trim()
    : "moderate";
  if (!VALID_CLEANLINESSES.includes(cleanliness)) cleanliness = "moderate";

  // --- estimatedWeightKg ---
  let estimatedWeightKg = null;
  if (
    typeof parsed.estimatedWeightKg === "number" &&
    Number.isFinite(parsed.estimatedWeightKg) &&
    parsed.estimatedWeightKg > 0
  ) {
    estimatedWeightKg = Math.min(Math.round(parsed.estimatedWeightKg * 100) / 100, 500);
  }

  // --- confidence (0-1 scale, clamped to valid range) ---
  let confidence = parsed.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    confidence = 0;
  }
  // Clamp confidence to [0, 1] range
  confidence = Math.max(0, Math.min(1, confidence));
  
  // For UI: convert to 0-100 scale
  const confidenceScore = Math.round(confidence * 100);

  // --- reasoning ---
  let reasoning = [];
  if (Array.isArray(parsed.reasoning)) {
    reasoning = parsed.reasoning
      .filter(r => typeof r === "string" && r.trim().length > 0)
      .map(r => r.trim())
      .slice(0, 5);
  }
  if (reasoning.length === 0 && material !== "unknown") {
    reasoning = [material.charAt(0).toUpperCase() + material.slice(1) + " identified based on visual characteristics"];
  }

  return {
    material,
    category,
    condition,
    cleanliness,
    estimatedWeightKg,
    confidence,
    confidenceScore,
    reasoning,
  };
}

// --- Timeout Wrapper ----------------------------------------------------------

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini call timed out after " + ms + "ms")), ms)
    ),
  ]);
}

// --- Main analyzeImage Function -----------------------------------------------

/**
 * Analyze a scrap image using Gemini Vision API.
 *
 * NON-THROWING. Returns a safe error object on any failure.
 *
 * @param {Buffer}  imageBuffer
 * @param {Object}  [options]
 * @param {string}  [options.mimeType]  - MIME type (default: "image/jpeg")
 * @param {string}  [options.apiKey]   - Override GEMINI_API_KEY
 * @param {Object}  [options.model]    - Pre-built model (for DI/testing)
 * @returns {Promise<Object>}
 */
async function analyzeImage(imageBuffer, options = {}) {
  // --- MOCK MODE ---
  if (USE_MOCK) {
    console.log("WARNING: imageAnalysis: MOCK_IMAGE=true - using mock response (not real AI)");
    return { ...MOCK_RESPONSE };
  }

  // --- Input validation ---
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    console.error("imageAnalysis: received empty or non-Buffer image");
    return buildErrorResponse("INVALID_IMAGE");
  }

  const mimeType = options.mimeType || "image/jpeg";

  // --- Build model ---
  let model;
  try {
    model = options.model || createModel(options.apiKey);
  } catch (err) {
    console.error("imageAnalysis: Gemini init failed:", err.message);
    return buildErrorResponse("NO_API_KEY");
  }

  // --- Prepare image part ---
  const imagePart = {
    inlineData: {
      data:     imageBuffer.toString("base64"),
      mimeType,
    },
  };

  // --- Call Gemini with timeout ---
  try {
    const geminiCall = model.generateContent([ANALYSIS_PROMPT, imagePart]);
    const result     = await withTimeout(geminiCall, TIMEOUT_MS);
    const rawText    = result.response.text();

    if (!rawText || !rawText.trim()) {
      console.error("imageAnalysis: Gemini returned empty text");
      return buildErrorResponse("EMPTY_RESPONSE");
    }

    const parsed = parseGeminiResponse(rawText);

    console.log(
      "imageAnalysis: " + parsed.material + " detected" +
      " (confidence: " + parsed.confidenceScore + "%, cleanliness: " + parsed.cleanliness + ")"
    );

    return parsed;

  } catch (err) {
    const errMsg = err.message || "Unknown error";
    let errorCode = "IMAGE_ANALYSIS_FAILED";

    if (errMsg.includes("timed out"))          errorCode = "TIMEOUT";
    else if (errMsg.includes("quota"))         errorCode = "QUOTA_EXCEEDED";
    else if (errMsg.includes("invalid JSON"))  errorCode = "PARSE_ERROR";
    else if (errMsg.includes("API_KEY"))       errorCode = "INVALID_API_KEY";

    console.error("imageAnalysis: [" + errorCode + "] " + errMsg);
    return buildErrorResponse(errorCode);
  }
}

// --- Exports -----------------------------------------------------------------

module.exports = {
  analyzeImage,
  parseGeminiResponse,
  createModel,
  VALID_MATERIALS,
  VALID_CONDITIONS,
  VALID_CATEGORIES,
  VALID_CLEANLINESSES,
  ANALYSIS_PROMPT,
  GEMINI_MODEL,
};
