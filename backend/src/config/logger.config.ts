import { Params } from "nestjs-pino";
import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";

const isProd = process.env.NODE_ENV === "production";

export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),

    // Pretty-print only in non-prod; in prod we ship JSON for log aggregation.
    transport: isProd
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            singleLine: true,
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,req.headers,res.headers",
          },
        },

    // Use the same request-id the AuditContextMiddleware sets on the response.
    // Honour an inbound x-request-id header so traces compose across services.
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const inbound = req.headers["x-request-id"];
      const id = (Array.isArray(inbound) ? inbound[0] : inbound) ?? randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },

    // Redact secrets so they never hit the log pipeline.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'req.body.token',
        'req.body.refreshToken',
      ],
      censor: "[REDACTED]",
      remove: false,
    },

    customLogLevel: (
      _req: IncomingMessage,
      res: ServerResponse,
      err?: Error,
    ) => {
      if (err) return "error";
      const status = res.statusCode;
      if (status >= 500) return "error";
      if (status >= 400) return "warn";
      return "info";
    },

    customSuccessMessage: (req: IncomingMessage, res: ServerResponse) =>
      `${req.method} ${req.url} → ${res.statusCode}`,
    customErrorMessage: (
      req: IncomingMessage,
      res: ServerResponse,
      err: Error,
    ) =>
      `${req.method} ${req.url} → ${res.statusCode} ${err?.message ?? ""}`,

    // Slim per-request log: keep what's useful for debugging, strip the rest.
    serializers: {
      req(req: IncomingMessage & { id?: string; remoteAddress?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        };
      },
      res(res: ServerResponse) {
        return { statusCode: res.statusCode };
      },
    },
  },
};
