import { AsyncLocalStorage } from "async_hooks";

export interface AuditActor {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Per-request actor context. Populated by `AuditContextMiddleware` on every
 * HTTP request so the Prisma audit extension can attribute writes to the
 * correct user without each service signature taking a `req` argument.
 *
 * Outside an HTTP request (seed scripts, cron jobs) the store returns
 * `undefined` and writes are recorded with `userId = null`.
 */
export const auditAls = new AsyncLocalStorage<AuditActor>();

export function getCurrentActor(): AuditActor | undefined {
  return auditAls.getStore();
}
