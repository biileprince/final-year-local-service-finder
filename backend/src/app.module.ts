import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env.validation";
import { loggerConfig } from "./config/logger.config";
import { AuditContextMiddleware } from "./common/audit/audit.middleware";
import { CsrfGuard } from "./common/security/csrf.guard";

// Core modules
import { DatabaseModule } from "./database/database.module";
import { CacheModule } from "./cache/cache.module";
import { MonitoringModule } from "./monitoring/monitoring.module";

// Feature modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { HealthModule } from "./modules/health/health.module";
import { FilesModule } from "./modules/files/files.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      validate: validateEnv,
    }),

    // Structured logging (Pino) — JSON in prod, pretty in dev
    LoggerModule.forRoot(loggerConfig),

    // Rate limiting. Per-route @Throttle() overrides on auth-sensitive
    // endpoints handle abuse cases; these defaults are intentionally loose
    // because dashboards fan out 5+ parallel calls per page load.
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 30,
      },
      {
        name: "medium",
        ttl: 10000,
        limit: 200,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 1000,
      },
    ]),

    // Core infrastructure
    DatabaseModule,
    CacheModule,
    MonitoringModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ProvidersModule,
    CategoriesModule,
    BookingsModule,
    ReviewsModule,
    AvailabilityModule,
    MessagesModule,
    HealthModule,
    FilesModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // CSRF guard is no-op unless CSRF_ENABLED=true (see CsrfGuard).
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditContextMiddleware).forRoutes("*");
  }
}
