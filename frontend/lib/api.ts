const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ─── Existing Types ───────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  imageAnalysis?: {
    material: string;
    confidence: number;
    condition?: string;
  } | null;
  description: string;
  userInputs: Record<string, string | number | null>;
}

export interface Question {
  type: string;
  question: string;
  category: string;
}

export interface PricingBreakdown {
  materialRate: number;
  weight: number;
  conditionFactor: number;
  adjustmentFactor: number;
  categoryAdjustment?: {
    field: string;
    value: string;
    factor: number;
  };
}

// Phase 11: Rich Explainability
export interface RichExplanation {
  summary: string;
  positives: string[];
  negatives: string[];
  tips: string[];
}

export interface Pricing {
  basePrice: number;
  finalPrice: number;
  currency: string;
  priceRange?: { min: number; max: number };
  negotiation?: {
    dealerOffer: number;
    targetPrice: number;
    minAcceptable: number;
  };
  breakdown: PricingBreakdown;
  explanation?: Record<string, string>;
  richExplanation?: RichExplanation;
}

// Value Improvement Engine result
export interface Improvement {
  improvedPrice: number;
  delta: number;
  suggestions: string[];
}

export interface AnalyzeResponse {
  status: "NEEDS_INPUT" | "COMPLETE";
  sessionId?: string;
  question?: Question;
  data?: Record<string, string | number>;
  source?: Record<string, string>;
  category?: string;
  categoryData?: Record<string, string>;
  pricing?: Pricing;
  improvement?: Improvement;           // NEW — value improvement suggestions
  questionsAsked?: Array<{ type: string; value: string | number }>;
  answeredSoFar?: number;
  error?: string;
  confidenceLevel?: "high" | "medium" | "low";
  analysis_id?: string;               // NEW — Supabase row ID (if DB enabled)
}

// ─── History Types ────────────────────────────────────────────────────────────

export interface AnalysisRecord {
  id: string;
  created_at: string;
  material: string | null;
  weight: number | null;
  condition: string | null;
  category: string | null;
  subtype: string | null;
  cleanliness: string | null;
  final_price: number | null;
  confidence_level: string | null;
  summary: string | null;
}

export interface HistoryResponse {
  analyses: AnalysisRecord[];
}

// ─── Feedback Types ───────────────────────────────────────────────────────────

export interface FeedbackRequest {
  analysis_id: string;
  is_accurate: boolean;
  note?: string;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId: string | null;
  message: string;
}

// ─── Existing API Functions ───────────────────────────────────────────────────

export async function analyzeWithImage(
  file: File,
  description: string
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("image", file);
  if (description) formData.append("description", description);

  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function analyze(input: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function answer(
  sessionId: string,
  answerData: { type: string; value: string | number }
): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, answer: answerData }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── New API Functions ────────────────────────────────────────────────────────

/**
 * Fetch analysis history, sorted by date descending.
 */
export async function fetchHistory(): Promise<HistoryResponse> {
  const res = await fetch(`${API_BASE}/history`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Submit accuracy feedback for a completed analysis.
 */
export async function submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}