import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nestjs";
import { randomUUID } from "crypto";
import { DomainError } from "../errors/domain-error";
import { ErrorCode } from "../errors/error-codes";

interface ErrorResponseBody {
  statusCode: number;
  code: ErrorCode | string;
  message: string | string[];
  details?: Record<string, unknown>;
  requestId: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId =
      (request.id as string | undefined) ??
      (request.headers["x-request-id"] as string | undefined) ??
      randomUUID();

    const body = this.toErrorResponse(exception, request, requestId);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode} ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Only server-side faults reach Sentry; 4xx are client errors and would
      // be noise. requestId ties the Sentry event back to the API response and
      // the correlated Pino log line. No-op when SENTRY_DSN is unset.
      Sentry.withScope((scope) => {
        scope.setTag("requestId", requestId);
        scope.setContext("request", {
          method: request.method,
          path: request.url,
          code: body.code,
        });
        Sentry.captureException(exception);
      });
    } else {
      this.logger.debug(
        `${request.method} ${request.url} → ${body.statusCode} ${body.code}`,
      );
    }

    response.setHeader("x-request-id", requestId);
    response.status(body.statusCode).json(body);
  }

  private toErrorResponse(
    exception: unknown,
    request: Request,
    requestId: string,
  ): ErrorResponseBody {
    const base = {
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 1. Domain errors — preferred path
    if (exception instanceof DomainError) {
      return {
        ...base,
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    // 2. Other HttpExceptions (Nest built-ins, validation pipe)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const { message, code } = this.unwrapHttpResponse(res, status);
      return {
        ...base,
        statusCode: status,
        code,
        message,
      };
    }

    // 3. Prisma known errors → translate to stable codes
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        ...base,
        ...this.fromPrismaKnown(exception),
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        ...base,
        statusCode: HttpStatus.BAD_REQUEST,
        code: ErrorCode.VALIDATION_FAILED,
        message: "Invalid query input.",
      };
    }

    // 4. Anything else — log full and respond opaquely
    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: "Internal server error",
    };
  }

  private unwrapHttpResponse(
    res: string | object,
    status: number,
  ): { message: string | string[]; code: string } {
    if (typeof res === "string") {
      return { message: res, code: this.codeForStatus(status) };
    }
    const r = res as Record<string, unknown>;
    const code =
      (r.code as string | undefined) ?? this.codeForStatus(status);
    const message =
      (r.message as string | string[] | undefined) ??
      (r.error as string | undefined) ??
      "Request failed";
    return { message, code };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.TOKEN_INVALID;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.INSUFFICIENT_PERMISSIONS;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  private fromPrismaKnown(e: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    code: ErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
  } {
    switch (e.code) {
      case "P2002": {
        // Unique constraint violation
        const target = e.meta?.target;
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: "A record with these values already exists.",
          details: target ? { fields: target } : undefined,
        };
      }
      case "P2025":
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: "The requested record was not found.",
        };
      case "P2003":
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: ErrorCode.VALIDATION_FAILED,
          message: "Foreign key constraint failed.",
          details: e.meta,
        };
      case "P2034":
        // Transaction conflict / serialization failure
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: "Conflicting concurrent update. Please retry.",
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: "Database error",
          details: { prismaCode: e.code },
        };
    }
  }
}
