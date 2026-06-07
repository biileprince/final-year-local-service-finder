import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "./error-codes";

export interface DomainErrorPayload {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Throw a `DomainError` (or one of its subclasses) anywhere in service code.
 * The global exception filter converts it to a structured JSON response with
 * the stable `code` field that the frontend matches on.
 *
 * Don't use generic `BadRequestException`/`NotFoundException` for business
 * rule violations — those don't carry a code.
 */
export class DomainError extends HttpException {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, statusCode);
    this.code = code;
    this.details = details;
  }
}

// =============================================================================
// Common subclasses — use these instead of constructing DomainError manually
// when the status code is well-defined for the error class.
// =============================================================================

export class NotFoundDomainError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.NOT_FOUND, details);
  }
}

export class ConflictDomainError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

export class ForbiddenDomainError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.FORBIDDEN, details);
  }
}

export class UnauthorizedDomainError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.UNAUTHORIZED, details);
  }
}

export class UnprocessableDomainError extends DomainError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

// =============================================================================
// Pre-baked errors for the highest-traffic violations. Add more as patterns
// emerge — the goal is one source of truth per business rule.
// =============================================================================

export const TimeSlotAlreadyBookedError = (slotId: string) =>
  new ConflictDomainError(
    ErrorCode.TIME_SLOT_ALREADY_BOOKED,
    "This time slot was just booked by someone else. Please choose another.",
    { slotId },
  );

export const ProviderNotVerifiedError = (providerId: string) =>
  new ForbiddenDomainError(
    ErrorCode.PROVIDER_NOT_VERIFIED,
    "Provider is not yet verified.",
    { providerId },
  );

export const ProviderInactiveError = (providerId: string) =>
  new ForbiddenDomainError(
    ErrorCode.PROVIDER_INACTIVE,
    "Provider is not currently accepting bookings.",
    { providerId },
  );

export const BookingVersionConflictError = (bookingId: string) =>
  new ConflictDomainError(
    ErrorCode.BOOKING_VERSION_CONFLICT,
    "This booking was modified by someone else. Refresh and try again.",
    { bookingId },
  );

export const EmailAlreadyRegisteredError = (email: string) =>
  new ConflictDomainError(
    ErrorCode.EMAIL_ALREADY_REGISTERED,
    "An account with this email already exists.",
    { email },
  );

export const InvalidCredentialsError = () =>
  new UnauthorizedDomainError(
    ErrorCode.INVALID_CREDENTIALS,
    "Email or password is incorrect.",
  );

export const InsufficientPermissionsError = () =>
  new ForbiddenDomainError(
    ErrorCode.INSUFFICIENT_PERMISSIONS,
    "You don't have permission to perform this action.",
  );

export const ResourceNotFoundError = (resource: string, id?: string) =>
  new NotFoundDomainError(
    ErrorCode.RESOURCE_NOT_FOUND,
    `${resource} not found.`,
    id ? { resource, id } : { resource },
  );
