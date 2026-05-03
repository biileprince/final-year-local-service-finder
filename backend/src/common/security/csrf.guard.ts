import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME } from "./cookies";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Double-submit-cookie CSRF protection.
 *
 * Activates only when:
 *   1. The request method is mutating (POST/PUT/PATCH/DELETE), AND
 *   2. The request carries a refresh-token cookie (i.e., is using the
 *      cookie-based session, not bearer-token-only), AND
 *   3. The env flag `CSRF_ENABLED=true`.
 *
 * Validation is a constant-time compare of the `x-csrf-token` header against
 * the `lsf_csrf_token` cookie value. The cookie is set by the auth flow when
 * the session begins; the frontend reads it and echoes it on every mutating
 * request.
 *
 * The env-flag gating exists so this guard can ship dormant alongside the
 * cookie-set code, then flip on once the frontend reliably sends the header.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (process.env.CSRF_ENABLED !== "true") return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Public auth endpoints (login, register, forgot-password) need to set
    // the cookie but cannot have one yet — exempt them.
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();

    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return true;

    // Only enforce when the session is cookie-based; pure bearer-token clients
    // (mobile apps, server-to-server) are out of scope for CSRF.
    const hasCookieSession = !!req.cookies?.[REFRESH_COOKIE_NAME];
    if (!hasCookieSession) return true;

    const headerToken = req.headers["x-csrf-token"];
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

    if (
      !headerToken ||
      !cookieToken ||
      typeof headerToken !== "string" ||
      typeof cookieToken !== "string"
    ) {
      throw new ForbiddenException("Missing CSRF token");
    }

    if (!constantTimeEqual(headerToken, cookieToken)) {
      throw new ForbiddenException("Invalid CSRF token");
    }

    return true;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
