import { supabase } from "./supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  improvement?: Improvement;
  questionsAsked?: Array<{ type: string; value: string | number }>;
  answeredSoFar?: number;
  error?: string;
  confidenceLevel?: "high" | "medium" | "low";
  analysis_id?: string;
}

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

// ─── Error Handler ────────────────────────────────────────────────────────────

class APIError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function parseErrorResponse(res: Response): Promise<{ error: string; message: string }> {
  try {
    return await res.json();
  } catch {
    return { error: "UNKNOWN_ERROR", message: `HTTP ${res.status}` };
  }
}

// ─── Auth Headers Helper ──────────────────────────────────────────────────────

/**
 * Get Authorization headers with valid Supabase JWT token.
 * For optional routes, returns empty headers if token is unavailable.
 * For protected routes, throws if token is missing.
 *
 * @param options.required - If true, throws if no token. If false, returns empty object.
 * @returns Authorization header object or empty object
 * @throws {APIError} If required=true and no valid token
 */
async function getAuthHeaders(options?: { required?: boolean }): Promise<Record<string, string>> {
  const required = options?.required ?? false;

  try {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;

    if (!token) {
      if (required) {
        throw new APIError(
          "UNAUTHORIZED",
          401,
          "No authentication token available. Please log in."
        );
      }
      // For optional routes, return empty headers
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  } catch (err) {
    if (required) {
      if (err instanceof APIError) throw err;
      throw new APIError(
        "AUTH_ERROR",
        401,
        "Failed to retrieve authentication token"
      );
    }
    // For optional routes, silently fail and return empty headers
    return {};
  }
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Analyze with image file (multipart/form-data).
 * Optional auth — works with or without user token.
 */
export async function analyzeWithImage(
  file: File,
  description: string
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("image", file);
  if (description) formData.append("description", description);

  // Attempt to get auth token (but don't fail if unavailable)
  const authHeaders = await getAuthHeaders({ required: false });

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });

    if (!res.ok) {
      const err = await parseErrorResponse(res);
      throw new APIError(err.error, res.status, err.message);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(
      "NETWORK_ERROR",
      0,
      err instanceof Error ? err.message : "Failed to connect to API"
    );
  }
}

/**
 * Analyze with JSON input.
 * Optional auth — works with or without user token.
 */
export async function analyze(input: AnalyzeRequest): Promise<AnalyzeResponse> {
  const authHeaders = await getAuthHeaders({ required: false });

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await parseErrorResponse(res);
      throw new APIError(err.error, res.status, err.message);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(
      "NETWORK_ERROR",
      0,
      err instanceof Error ? err.message : "Failed to connect to API"
    );
  }
}

/**
 * Answer a question in an active session.
 * Optional auth — uses token if available.
 */
export async function answer(
  sessionId: string,
  answerData: { type: string; value: string | number }
): Promise<AnalyzeResponse> {
  const authHeaders = await getAuthHeaders({ required: false });

  try {
    const res = await fetch(`${API_BASE}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ sessionId, answer: answerData }),
    });

    if (!res.ok) {
      const err = await parseErrorResponse(res);
      throw new APIError(err.error, res.status, err.message);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(
      "NETWORK_ERROR",
      0,
      err instanceof Error ? err.message : "Failed to connect to API"
    );
  }
}

/**
 * Fetch session status.
 */
export async function getSessionStatus(sessionId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/session/${sessionId}`, {
      method: "GET",
    });

    if (!res.ok) {
      const err = await parseErrorResponse(res);
      throw new APIError(err.error, res.status, err.message);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(
      "NETWORK_ERROR",
      0,
      err instanceof Error ? err.message : "Failed to connect to API"
    );
  }
}

/**
 * Delete a session.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/session/${sessionId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await parseErrorResponse(res);
      throw new APIError(err.error, res.status, err.message);
    }
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(
      "NETWORK_ERROR",
      0,
      err instanceof Error ? err.message : "Failed to connect to API"
    );
  }
}

/**
 * Fetch analysis history for the authenticated user.
 * PROTECTED — requires valid JWT token.
 */
export async function fetchHistory(): Promise<HistoryResponse> {
  const authHeaders = await getAuthHeaders({ required: true });

  try {
    const res = await fetch(`${API_BASE}/history`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    if (!res.ok) {
      const err = await parseErrorResponse(res);
      throw new APIError(err.error, res.status, err.message);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(
      "NETWORK_ERROR",
      0,
      err instanceof Error ? err.message : "Failed to fetch history"
    );
  }
}

/**
 * Submit accuracy feedback for a completed analysis.
 * PROTECTED — requires valid JWT token.
 */
export async function submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  const authHeaders = await getAuthHeaders({ required: true });

  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await parseErrorResponse(res);
      throw new APIError(err.error, res.status, err.message);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(
      "NETWORK_ERROR",
      0,
      err instanceof Error ? err.message : "Failed to submit feedback"
    );
  }
}

/**
 * Check API health.
 */
export async function checkHealth(): Promise<{ status: string; service: string; activeSessions: number }> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: "GET",
    });

    if (!res.ok) {
      throw new APIError("SERVICE_UNAVAILABLE", res.status, "API is not responding");
    }

    return await res.json();
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError(
      "NETWORK_ERROR",
      0,
      err instanceof Error ? err.message : "Failed to check API health"
    );
  }
}

// ─── Error Utilities ──────────────────────────────────────────────────────────

export function isAuthError(err: unknown): boolean {
  return err instanceof APIError && (err.code === "UNAUTHORIZED" || err.code === "AUTH_ERROR");
}

export function isSessionExpired(err: unknown): boolean {
  return err instanceof APIError && err.code === "SESSION_EXPIRED";
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof APIError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred";
}
