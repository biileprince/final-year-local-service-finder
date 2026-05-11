import { NestFactory } from "@nestjs/core";
import { ValidationPipe, RequestMethod } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { MetricsInterceptor, MetricsService } from "./monitoring";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Replace Nest's default logger with Pino — JSON in prod, pretty in dev,
  // request-id correlation, sensitive-field redaction (see logger.config.ts).
  app.useLogger(app.get(Logger));

  // Security
  app.use(helmet());
  app.use(cookieParser(process.env.COOKIE_SECRET));
  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });

  // Global prefix — /metrics stays unprefixed so Prometheus's default
  // scrape path works without per-job overrides.
  app.setGlobalPrefix("api", {
    exclude: [{ path: "metrics", method: RequestMethod.GET }],
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
