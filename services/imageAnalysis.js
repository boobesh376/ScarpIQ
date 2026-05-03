/**
 * ScrapIQ Image Analysis Service
 * ================================
 * Uses Google Gemini Vision API to extract structured scrap data from images.
 *
 * Returns ONLY: { material, confidence, condition }
 * Never guesses. Returns "unknown" / "uncertain" when unsure.
 *
 * NON-THROWING: analyzeImage NEVER throws. It always returns a valid object.
 * MOCK MODE: Set MOCK_IMAGE=true in .env to bypass Gemini entirely.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ─── Constants ───────────────────────────────────────────────────────────────

const USE_MOCK = process.env.MOCK_IMAGE === "true";

const VALID_MATERIALS = ["copper", "iron", "aluminum", "steel", "plastic", "unknown"];
const VALID_CONDITIONS = ["good", "used", "damaged", "uncertain"];

const GEMINI_MODEL = "gemini-1.5-flash";

/**
 * The prompt sent to Gemini. Strict — demands JSON only, no guessing.
 */
const ANALYSIS_PROMPT = `Analyze this image of a scrap item.

Return ONLY JSON in this format:

{
  "material": "copper | iron | aluminum | steel | plastic | unknown",
  "confidence": number (0 to 1),
  "condition": "good | used | damaged | uncertain"
}

Rules:
- Do NOT guess if unsure → return "unknown" for material, "uncertain" for condition
- confidence must reflect how sure you are (0 = no idea, 1 = certain)
- Do NOT include explanation
- Do NOT include extra text
- Return ONLY the JSON object, nothing else`;

// ─── Gemini Client ───────────────────────────────────────────────────────────

/**
 * Create a Gemini GenerativeModel instance.
 *
 * @param {string} [apiKey] - Gemini API key. Falls back to GEMINI_API_KEY env var.
 * @returns {GenerativeModel}
 * @throws {Error} If no API key is available.
 */
function createModel(apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "imageAnalysis: GEMINI_API_KEY is required. Set it in .env or pass it directly."
    );
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}

// ─── Response Parsing ────────────────────────────────────────────────────────

/**
 * Parse and validate Gemini's raw text response into structured data.
 *
 * @param {string} rawText - Raw text from Gemini API.
 * @returns {{material: string, confidence: number, condition: string}}
 * @throws {Error} If response is not valid JSON or has invalid fields.
 */
function parseGeminiResponse(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("imageAnalysis: empty response from Gemini");
  }

  // Strip markdown code fences if Gemini wraps response in ```json ... ```
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }

  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`imageAnalysis: invalid JSON from Gemini: ${cleaned.slice(0, 200)}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("imageAnalysis: Gemini response is not a JSON object");
  }

  // ── Validate & normalize material ──────────────────────────────────────
  let material = parsed.material;
  if (typeof material !== "string" || !material.trim()) {
    material = "unknown";
  } else {
    material = material.toLowerCase().trim();
    // Normalize aliases
    if (material === "aluminium") material = "aluminum";
    if (!VALID_MATERIALS.includes(material)) material = "unknown";
  }

  // ── Validate & normalize confidence ────────────────────────────────────
  let confidence = parsed.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    confidence = 0;
  }
  // Clamp to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));
  // Round to 2 decimals
  confidence = Math.round(confidence * 100) / 100;

  // ── Validate & normalize condition ─────────────────────────────────────
  let condition = parsed.condition;
  if (typeof condition !== "string" || !condition.trim()) {
    condition = "uncertain";
  } else {
    condition = condition.toLowerCase().trim();
    // Map common aliases
    if (condition === "rusted" || condition === "broken" || condition === "corroded") {
      condition = "damaged";
    }
    if (condition === "working" || condition === "new" || condition === "clean") {
      condition = "good";
    }
    if (!VALID_CONDITIONS.includes(condition)) condition = "uncertain";
  }

  return { material, confidence, condition };
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Analyze an image using Gemini Vision API.
 *
 * NON-THROWING: This function NEVER throws. It always returns a valid object.
 *
 * @param {Buffer} imageBuffer - The image file as a Buffer.
 * @param {Object} [options]
 * @param {string} [options.mimeType="image/jpeg"] - MIME type of the image.
 * @param {string} [options.apiKey] - Gemini API key (overrides env).
 * @param {GenerativeModel} [options.model] - Pre-built model (for testing/DI).
 * @returns {Promise<{material: string|null, confidence: number, condition: string|null, error?: string, source?: string}>}
 */
async function analyzeImage(imageBuffer, options = {}) {
  // ── MOCK MODE (DEV SAFE MODE) ─────────────────────────────
  if (USE_MOCK) {
    console.log("⚠️ Using MOCK image analysis");

    return {
      material: "copper",
      condition: "damaged",
      confidence: 0.9,
      source: "mock"
    };
  }

  // ── Validate input ────────────────────────────────────────
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return {
      material: null,
      condition: null,
      confidence: 0,
      error: "INVALID_IMAGE"
    };
  }

  const mimeType = options.mimeType || "image/jpeg";

  // ── Build model (NO THROW) ────────────────────────────────
  let model;
  try {
    model = options.model || createModel(options.apiKey);
  } catch (err) {
    console.error("⚠️ Gemini init failed:", err.message);

    return {
      material: null,
      condition: null,
      confidence: 0,
      error: "NO_API_KEY"
    };
  }

  // ── Prepare image part ────────────────────────────────────
  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType,
    },
  };

  // ── Call Gemini + Parse (NO THROW) ────────────────────────
  try {
    const result = await model.generateContent([ANALYSIS_PROMPT, imagePart]);

    const response = result.response;
    const rawText = response.text();

    return parseGeminiResponse(rawText);
  } catch (err) {
    console.error("⚠️ Gemini call failed:", err.message);

    return {
      material: null,
      condition: null,
      confidence: 0,
      error: "IMAGE_ANALYSIS_FAILED"
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  analyzeImage,
  parseGeminiResponse,
  createModel,
  // Constants exported for testing
  VALID_MATERIALS,
  VALID_CONDITIONS,
  ANALYSIS_PROMPT,
  GEMINI_MODEL,
};