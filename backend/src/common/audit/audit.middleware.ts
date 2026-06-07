import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { auditAls, AuditActor } from "./audit.context";

/**
 * Wraps every request in an AsyncLocalStorage scope carrying the actor's
 * identity. The Prisma audit extension reads from this scope when writing
 * to AuditLog.
 *
 * Note: this middleware runs *before* JWT auth, so `userId` may be undefined
 * here. The JWT strategy / guard should call `setActorUserId(req.user.id)`
 * once it resolves the user. As a fallback, the audit extension also reads
 * `req.user?.id` lazily via the request reference if available.
 */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(
    req: Request & { user?: { id?: string }; id?: string },
    res: Response,
    next: NextFunction,
  ) {
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    res.setHeader("x-request-id", requestId);
    req.id = requestId;

    const actor: AuditActor = {
      userId: undefined,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      requestId,
    };

    // Patch userId on the actor whenever req.user appears later (JWT guard
    // mutates req.user after middleware runs). The audit extension reads
    // this via getCurrentActor() at write time.
    Object.defineProperty(actor, "userId", {
      enumerable: true,
      get: () => req.user?.id,
    });

    auditAls.run(actor, () => next());
  }
}
