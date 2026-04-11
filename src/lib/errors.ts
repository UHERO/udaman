/**
 * Structured error hierarchy for the application.
 *
 * Each subclass sets a standard HTTP status code, a category (for grouping
 * in app_logs), and optional structured metadata.
 */

export type ErrorCategory =
  | "bad_request"
  | "auth"
  | "not_found"
  | "validation"
  | "internal"
  | "external_service"
  | "service_unavailable"
  | "error";

export class HttpError extends Error {
  readonly statusCode: number;
  readonly category: ErrorCategory;
  readonly metadata: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    category: ErrorCategory,
    metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.category = category;
    this.metadata = metadata;
  }
}

/** 400 — malformed request or missing required parameters */
export class BadRequestError extends HttpError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 400, "bad_request", metadata);
  }
}

/** 401 — not logged in or session expired */
export class AuthenticationError extends HttpError {
  constructor(message = "Unauthorized", metadata?: Record<string, unknown>) {
    super(message, 401, "auth", metadata);
  }
}

/** 403 — logged in but insufficient privileges */
export class AuthorizationError extends HttpError {
  constructor(message = "Forbidden", metadata?: Record<string, unknown>) {
    super(message, 403, "auth", metadata);
  }
}

/** 404 — resource not found */
export class NotFoundError extends HttpError {
  constructor(
    resource: string,
    id?: string | number,
    metadata?: Record<string, unknown>,
  ) {
    const msg = id != null ? `${resource} not found: ${id}` : `${resource} not found`;
    super(msg, 404, "not_found", { resource, id, ...metadata });
  }
}

/** 422 — input fails validation rules */
export class ValidationError extends HttpError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 422, "validation", metadata);
  }
}

/** 500 — unexpected internal failure */
export class InternalError extends HttpError {
  constructor(message = "Internal server error", metadata?: Record<string, unknown>) {
    super(message, 500, "internal", metadata);
  }
}

/** 502 — upstream API / external service failure */
export class ExternalServiceError extends HttpError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 502, "external_service", metadata);
  }
}

/** 503 — service temporarily unavailable */
export class ServiceUnavailableError extends HttpError {
  constructor(message = "Service unavailable", metadata?: Record<string, unknown>) {
    super(message, 503, "service_unavailable", metadata);
  }
}
