import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { RateLimitObserverService } from "./rate-limit-observer.service";

interface MaybeAuthenticatedRequest extends Request {
  user?: { id?: string };
}

/**
 * Catches throttle rejections so we can: (a) record them in
 * RateLimitObserverService for the admin dashboard, (b) emit a structured
 * warning log line, and (c) preserve the standard 429 JSON response NestJS
 * would otherwise have produced.
 */
@Catch(ThrottlerException)
export class RateLimitObserverFilter implements ExceptionFilter {
  private readonly logger = new Logger("RateLimit");

  constructor(private readonly observer: RateLimitObserverService) {}

  catch(exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<MaybeAuthenticatedRequest>();
    const res = ctx.getResponse<Response>();

    // Express attaches `route` after routing — typed as required but in
    // practice can be undefined for unmatched paths. Use the URL as a fallback.
    const route = (req as unknown as { route?: { path?: string } }).route;
    const path = route?.path ?? (req.url ? req.url.split("?")[0] : "unknown");
    const ip = req.ip ?? "unknown";
    const at = new Date().toISOString();

    this.observer.record({
      at,
      method: req.method,
      path,
      ip,
      userAgent: req.headers["user-agent"]?.toString(),
      userId: req.user?.id,
    });

    this.logger.warn(
      `429 ${req.method} ${path} from ${ip}${req.user?.id ? ` user=${req.user.id}` : ""}`,
    );

    res.status(429).json({
      statusCode: 429,
      message: exception.message || "Too Many Requests",
      error: "Too Many Requests",
    });
  }
}
