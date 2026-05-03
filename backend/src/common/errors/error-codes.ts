/**
 * Stable, machine-readable business-error codes. The frontend keys off these
 * to render targeted UX (toasts, inline form errors). Add new codes here —
 * never inline strings in `throw new DomainError(...)`.
 *
 * Naming: SCREAMING_SNAKE, namespaced by domain.
 */
export enum ErrorCode {
  // -- Auth / users ---------------------------------------------------------
  EMAIL_ALREADY_REGISTERED = "EMAIL_ALREADY_REGISTERED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  REFRESH_TOKEN_REVOKED = "REFRESH_TOKEN_REVOKED",
  EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED",
  PHONE_NOT_VERIFIED = "PHONE_NOT_VERIFIED",
  ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED",
  PASSWORD_RESET_TOKEN_INVALID = "PASSWORD_RESET_TOKEN_INVALID",

  // -- Authorization --------------------------------------------------------
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ROLE_REQUIRED = "ROLE_REQUIRED",

  // -- Providers ------------------------------------------------------------
  PROVIDER_NOT_FOUND = "PROVIDER_NOT_FOUND",
  PROVIDER_NOT_VERIFIED = "PROVIDER_NOT_VERIFIED",
  PROVIDER_INACTIVE = "PROVIDER_INACTIVE",
  PROVIDER_PROFILE_INCOMPLETE = "PROVIDER_PROFILE_INCOMPLETE",

  // -- Bookings -------------------------------------------------------------
  BOOKING_NOT_FOUND = "BOOKING_NOT_FOUND",
  TIME_SLOT_ALREADY_BOOKED = "TIME_SLOT_ALREADY_BOOKED",
  TIME_SLOT_UNAVAILABLE = "TIME_SLOT_UNAVAILABLE",
  AVAILABILITY_NOT_FOUND = "AVAILABILITY_NOT_FOUND",
  BOOKING_VERSION_CONFLICT = "BOOKING_VERSION_CONFLICT",
  INVALID_BOOKING_TRANSITION = "INVALID_BOOKING_TRANSITION",
  CANNOT_CANCEL_COMPLETED_BOOKING = "CANNOT_CANCEL_COMPLETED_BOOKING",
  CANNOT_REVIEW_INCOMPLETE_BOOKING = "CANNOT_REVIEW_INCOMPLETE_BOOKING",

  // -- Reviews --------------------------------------------------------------
  REVIEW_NOT_FOUND = "REVIEW_NOT_FOUND",
  REVIEW_ALREADY_EXISTS = "REVIEW_ALREADY_EXISTS",
  REVIEW_HIDDEN = "REVIEW_HIDDEN",

  // -- Files ----------------------------------------------------------------
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_TYPE_NOT_ALLOWED = "FILE_TYPE_NOT_ALLOWED",
  UPLOAD_FAILED = "UPLOAD_FAILED",

  // -- Generic --------------------------------------------------------------
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  CONFLICT = "CONFLICT",
}
