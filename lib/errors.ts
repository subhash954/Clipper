/**
 * CLIPPER STANDARDIZED ERROR ARCHITECTURE
 * Step 23: Structured, secure, non-leaking server error handling
 */

export type ClipperErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'MEDIA_UNAVAILABLE'
  | 'MEDIA_INVALID'
  | 'STORAGE_UNAVAILABLE'
  | 'DATABASE_ERROR'
  | 'TRANSCRIPTION_FAILED'
  | 'ANALYSIS_FAILED'
  | 'RENDER_FAILED'
  | 'RENDER_CANCELLED'
  | 'RATE_LIMITED'
  | 'CONFIGURATION_ERROR'
  | 'PROJECT_VERSION_CONFLICT'
  | 'INVALID_PROJECT_STATE'
  | 'MEDIA_NOT_OWNED'
  | 'PROJECT_NOT_OWNED'
  | 'STORAGE_ERROR'
  | 'MEDIA_REQUIRED'
  | 'RAW_AUDIO_BYPASS_FORBIDDEN'
  | 'SSRF_VIOLATION'
  | 'CONCURRENT_TRANSCRIPTION'
  | 'TIMELINE_VERSION_CONFLICT'
  | 'INVALID_TIMELINE_MATH'
  | 'INVALID_SPLIT_POINT'
  | 'INVALID_TRIM_RANGE'
  | 'INVALID_TRIM_BOUNDS'
  | 'INVALID_RANGE'
  | 'INVALID_SPEED';

export interface StructuredErrorResponse {
  code: ClipperErrorCode;
  message: string;
  statusCode: number;
  retryable: boolean;
  details?: Record<string, any>;
}

export class ClipperError extends Error {
  public code: ClipperErrorCode;
  public statusCode: number;
  public retryable: boolean;
  public details?: Record<string, any>;

  constructor(
    code: ClipperErrorCode,
    message: string,
    statusCode: number = 400,
    retryable: boolean = false,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ClipperError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;

    // Maintain prototype chain
    Object.setPrototypeOf(this, ClipperError.prototype);
  }

  toResponse(): StructuredErrorResponse {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

/**
 * Maps arbitrary runtime errors into structured, client-safe error payloads.
 * Strips stack traces, credentials, and internal query details from client responses.
 */
export function formatErrorResponse(error: any): { body: StructuredErrorResponse; status: number } {
  if (error instanceof ClipperError) {
    return {
      body: error.toResponse(),
      status: error.statusCode,
    };
  }

  // Handle generic error without exposing internal stack traces
  const defaultMessage = error?.message || 'An unexpected internal processing error occurred.';
  const safeMessage = sanitizeErrorMessage(defaultMessage);

  return {
    body: {
      code: 'DATABASE_ERROR',
      message: safeMessage,
      statusCode: error?.statusCode || 500,
      retryable: false,
    },
    status: error?.statusCode || 500,
  };
}

function sanitizeErrorMessage(msg: string): string {
  // Strip potential database connection strings, passwords, or token keys
  return msg
    .replace(/(?:key|token|password|secret)=[^\s&]+/gi, '$1=[REDACTED]')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://[REDACTED]@')
    .slice(0, 300);
}
