import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Request, Response } from "express";
import { MetricsService } from "./metrics.service";

// Normalise dynamic path segments so we don't blow up Prometheus cardinality
// (e.g. /api/users/abc-123 → /api/users/:id). Uses the matched route pattern
// when Nest exposes one; falls back to the raw URL with id-like segments
// replaced.
function normalisePath(req: Request): string {
  const route = (req as Request & { route?: { path?: string } }).route?.path;
  if (route) return route;
  const url = req.originalUrl || req.url || "";
  return url
    .split("?")[0]
    .replace(/\/[0-9a-fA-F-]{20,}/g, "/:id")
    .replace(/\/\d+/g, "/:id");
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const method = req.method;
    const start = process.hrtime.bigint();

    this.metrics.httpActiveRequests.inc();

    const record = () => {
      const path = normalisePath(req);
      if (path === "/metrics") return; // don't measure the scrape itself
      const status = String(res.statusCode);
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.httpRequestsTotal.inc({ method, path, status });
      this.metrics.httpRequestDuration.observe({ method, path }, durationSec);
      this.metrics.httpActiveRequests.dec();
    };

    return next.handle().pipe(
      tap({
        next: () => record(),
        error: () => record(),
      }),
    );
  }
}
