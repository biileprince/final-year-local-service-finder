// Sentry init — must run before any other import so instrumentation can
// patch http/express/prisma at require time.
import "./instrument";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, RequestMethod } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { json, urlencoded } from "express";
import type { Express } from "express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { MetricsInterceptor, MetricsService } from "./monitoring";
import { getAllowedOrigins } from "./common/security/cors";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Replace Nest's default logger with Pino — JSON in prod, pretty in dev,
  // request-id correlation, sensitive-field redaction (see logger.config.ts).
  app.useLogger(app.get(Logger));

  // Trust the first proxy hop (Heroku / nginx / Cloudflare) so `req.ip` and
  // `req.protocol` reflect the real client, not the load balancer. Required
  // for IP-based rate limiting + observability to mean anything in prod.
  const expressInstance = app.getHttpAdapter().getInstance() as Express;
  expressInstance.set("trust proxy", 1);

  // Security
  app.use(helmet());
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // Cap request bodies. File uploads go through the dedicated multipart
  // routes, so 1mb is plenty for JSON payloads.
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ limit: "1mb", extended: true }));

  const allowedOrigins = getAllowedOrigins();
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Server-to-server / curl / same-origin requests omit Origin.
      if (!origin) return cb(null, true);
      cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  });

  // Global prefix — /metrics stays unprefixed so Prometheus's default
  // scrape path works without per-job overrides. The Google OAuth
  // callback is also exposed without the prefix so the redirect URI
  // registered in Google Cloud Console can be the bare
  // `/auth/google/callback` (some deployments registered the URL
  // without the `/api` prefix; the frontend still hits the prefixed
  // `/api/auth/google` to start the flow, so we only drop the prefix
  // for the inbound bounce from Google).
  app.setGlobalPrefix("api", {
    exclude: [
      { path: "metrics", method: RequestMethod.GET },
      { path: "auth/google/callback", method: RequestMethod.GET },
    ],
  });

  // Prometheus HTTP metrics for every request
  app.useGlobalInterceptors(new MetricsInterceptor(app.get(MetricsService)));

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter — typed business errors + Prisma error translation
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("Local Service Finder API")
    .setDescription("API documentation for the Local Service Finder platform")
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("auth", "Authentication endpoints")
    .addTag("users", "User management")
    .addTag("providers", "Service provider endpoints")
    .addTag("bookings", "Booking management")
    .addTag("categories", "Service categories")
    .addTag("reviews", "Customer reviews")
    .addTag("availability", "Provider availability")
    .addTag("messages", "Real-time messaging")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Application is running on: http://localhost:${port}`, "Bootstrap");
  logger.log(
    `Swagger docs available at: http://localhost:${port}/api/docs`,
    "Bootstrap",
  );
}
bootstrap();
